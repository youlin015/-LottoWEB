from dotenv import load_dotenv
load_dotenv()  # 載入 backend/.env，必須在其他 import 之前

from contextlib import asynccontextmanager
from typing import Optional
import os
from fastapi import FastAPI, HTTPException, Response, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import httpx
from datetime import datetime
from collections import Counter
import asyncio
import random
import math
import time

from slowapi.errors import RateLimitExceeded

import database
import models
import auth as auth_utils
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from rate_limit import limiter
from routers.auth_router import router as auth_router
from routers.user_router import router as user_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """啟動時建立 DB 資料表；關閉時釋放連線池"""
    await database.init_db()
    yield
    await database.engine.dispose()

# 簡易 in-memory 快取，避免重複呼叫台灣彩券外部 API
_cache: dict = {}
_inflight: dict = {}  # 進行中的請求，避免同 key 重複打外部 API
CACHE_TTL = 300  # 快取 5 分鐘

app = FastAPI(title="Taiwan Lottery Situation Room API", lifespan=lifespan)

# CORS 白名單：預設為 Vercel 正式網域與本地 dev，可用 CORS_ORIGINS 環境變數覆寫（逗號分隔）
_default_origins = [
    "https://lotto-web-ruddy.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_env_origins = os.getenv("CORS_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _env_origins.split(",") if o.strip()] or _default_origins
print(f"[CORS] Allowed origins: {ALLOWED_ORIGINS}")


# Rate Limiter：所有受限端點共用 rate_limit.limiter，超限自動回 429
app.state.limiter = limiter


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    自訂 429 handler：FastAPI exception handler 不會經過 CORSMiddleware，
    必須手動補上 Access-Control-Allow-Origin，否則瀏覽器會把 429 當成 CORS 錯誤，
    前端 fetch 拿不到正確 status code。
    """
    origin = request.headers.get("origin", "")
    headers = {"Retry-After": "60"}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return JSONResponse(
        status_code=429,
        content={"detail": f"請求過於頻繁（{exc.detail}），請稍後再試"},
        headers=headers,
    )


app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

app.include_router(auth_router)
app.include_router(user_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/")
@app.get("/healthz")
async def health_check():
    return {"status": "ok", "message": "Taiwan Lottery Situation Room API is running healthy!"}

GAMES_URLS = {
    'lotto638': 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery/SuperLotto638Result',
    'lotto649': 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Lotto649Result',
    'daily539': 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Daily539Result',
}

GAME_CONFIGS = {
    'lotto638': {'draw_count': 6, 'max_num': 38, 'name': '威力彩', 'has_special': True, 'special_max': 8},
    'lotto649': {'draw_count': 6, 'max_num': 49, 'name': '大樂透', 'has_special': False},
    'daily539': {'draw_count': 5, 'max_num': 39, 'name': '今彩539', 'has_special': False}
}

async def fetch_historical_draws(game_id: str, limit: int = 100, start_month: str = "", end_month: str = "") -> list:
    """Fetch recent data for the given game，結果快取 5 分鐘避免重複打外部 API。"""
    url = GAMES_URLS.get(game_id)
    if not url: return []

    # Taiwan Lottery requires month bounds
    now = datetime.now()

    if not end_month:
        end_month = now.strftime('%Y-%m')
    if not start_month:
        # 預設往前推一年，確保有足夠期數
        start_month = f"{now.year - 1}-01"

    # 台灣彩券 API 僅提供近 10 年資料，超出範圍自動截斷
    ten_years_ago = f"{now.year - 10}-{now.strftime('%m')}"
    if start_month < ten_years_ago:
        start_month = ten_years_ago

    # Cache key 不含 limit，同一日期範圍共用快取
    cache_key = (game_id, start_month, end_month)
    now_ts = time.time()
    if cache_key in _cache:
        cached_time, cached_data = _cache[cache_key]
        if now_ts - cached_time < CACHE_TTL:
            return cached_data[:limit]

    # 若相同 key 的請求已在進行中，等待其完成再從快取讀取（避免 race condition 重複打外部 API）
    if cache_key in _inflight:
        await _inflight[cache_key].wait()
        if cache_key in _cache:
            return _cache[cache_key][1][:limit]
        return []

    event = asyncio.Event()
    _inflight[cache_key] = event

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    all_docs = []
    page_num = 1

    try:
        async with httpx.AsyncClient(verify=False, headers=headers, timeout=30.0) as client:
            while True:
                params = {
                    "period": "",
                    "month": start_month,
                    "endMonth": end_month,
                    "pageNum": page_num,
                    "pageSize": 5000
                }
                try:
                    resp = await client.get(url, params=params)
                    print(f"[DEBUG] {game_id} page={page_num} status={resp.status_code}")
                    if resp.status_code != 200:
                        print(f"[ERROR] upstream returned HTTP {resp.status_code}: {resp.text[:200]}")
                        break
                    data = resp.json()
                    res_content = data.get('content', {})
                    if res_content is None:
                        print(f"[ERROR] upstream response missing 'content': {str(data)[:200]}")
                        break
                    list_docs = res_content.get('daily539Res', []) if game_id == 'daily539' else res_content.get('lotto649Res', []) if game_id == 'lotto649' else res_content.get('superLotto638Res', [])
                    print(f"[DEBUG] {game_id} page={page_num} got {len(list_docs)} records")
                    all_docs.extend(list_docs)
                    # 若這一頁不足 5000 筆，代表已是最後一頁
                    if len(list_docs) < 5000:
                        break
                    page_num += 1
                except Exception as e:
                    print(f"[ERROR] fetching {game_id} page {page_num}: {type(e).__name__}: {e}")
                    break

        # 快取完整資料集（不加 limit），不同 limit 的呼叫可共用同一份快取
        if len(_cache) >= 100:
            oldest_key = min(_cache, key=lambda k: _cache[k][0])
            del _cache[oldest_key]
        _cache[cache_key] = (time.time(), all_docs)
    finally:
        _inflight.pop(cache_key, None)
        event.set()

    return all_docs[:limit]

def calculate_hot_cold_and_consecutive(draws: list, config: dict):
    """
    Returns cold/hot number frequencies and connection probabilities
    """
    all_numbers = []
    special_numbers = []
    consecutive_counts = 0
    total_draws = len(draws)
    has_special = config.get('has_special', False)
    
    for draw in draws:
        nums = draw.get('drawNumberSize', [])
        if not nums:
            continue
        real_nums = [int(n) for n in nums]
        if has_special and len(real_nums) > config['draw_count']:
            special_nums = [real_nums[-1]]
            real_nums = real_nums[:-1]
        else:
            special_nums = []
                
        all_numbers.extend(real_nums[:config['draw_count']])
        if has_special and special_nums:
            special_numbers.extend(special_nums)
            
        real_nums.sort()
        has_consec = any(real_nums[i]+1 == real_nums[i+1] for i in range(len(real_nums)-1))
        if has_consec:
            consecutive_counts += 1

    counts = Counter(all_numbers)
    freq_map = {n: counts.get(n, 0) for n in range(1, config['max_num'] + 1)}
    
    special_freq_map = {}
    if has_special:
        sp_counts = Counter(special_numbers)
        special_freq_map = {n: sp_counts.get(n, 0) for n in range(1, config.get('special_max', 8) + 1)}
    
    consec_prob = round((consecutive_counts / total_draws) * 100, 2) if total_draws else 0
    return freq_map, special_freq_map, consec_prob

def calculate_gaps(draws: list, config: dict) -> dict:
    """每個號碼距今多少期未出現（gap 越大 = 越久沒出現）"""
    last_seen: dict = {}
    for i, draw in enumerate(draws):  # draws[0] = 最新一期
        nums = draw.get('drawNumberSize', [])
        if not nums:
            continue
        real_nums = [int(n) for n in nums]
        if config.get('has_special') and len(real_nums) > config['draw_count']:
            main_nums = real_nums[:-1]
        else:
            main_nums = real_nums[:config['draw_count']]
        for n in main_nums:
            if n not in last_seen:
                last_seen[n] = i  # 第一次出現即為最近一次
    total = len(draws)
    return {n: last_seen.get(n, total) for n in range(1, config['max_num'] + 1)}


def softmax_weights(values: list, temperature: float = 1.0) -> list:
    """
    Temperature Softmax：先正規化到 0~1 再套用 softmax，攤平熱號獨大。
    temperature=1.0 → 冷熱差距約 2.7 倍；temperature=0.5 → 約 7 倍；
    temperature=2.0 → 約 1.6 倍（接近均勻）。
    """
    if not values:
        return []
    min_v, max_v = min(values), max(values)
    if max_v == min_v:
        return [1.0] * len(values)
    norm = [(v - min_v) / (max_v - min_v) for v in values]   # 正規化 0~1
    exp_vals = [math.exp(n / temperature) for n in norm]
    total = sum(exp_vals)
    scale = len(values)   # 平均值 ≈ 1，與 gap bonus 量級一致
    return [e / total * scale for e in exp_vals]


def segment_aware_pick(numbers: list, weights: list, draw_count: int, max_num: int) -> list:
    """
    號碼分區平衡選號（低/中/高三段）。
    軟約束：當剩餘抽選次數 == 尚未出現的分區數時，強制從空白分區挑選。
    """
    third = max_num // 3

    def get_seg(n: int) -> int:
        if n <= third: return 0
        if n <= 2 * third: return 1
        return 2

    result: list = []
    seg_counts = [0, 0, 0]
    nums = numbers[:]
    ws = weights[:]

    for pick_idx in range(draw_count):
        remaining = draw_count - pick_idx
        empty_segs = sum(1 for c in seg_counts if c == 0)

        adj = []
        for n, w in zip(nums, ws):
            if seg_counts[get_seg(n)] == 0 and remaining <= empty_segs:
                adj.append(w * 8)   # 強制補齊空白分區
            else:
                adj.append(w)

        idx = random.choices(range(len(nums)), weights=adj, k=1)[0]
        picked = nums.pop(idx)
        ws.pop(idx)
        seg_counts[get_seg(picked)] += 1
        result.append(picked)

    return result


@app.get("/api/ai_recommend/{game_id}")
@limiter.limit("30/minute")
async def ai_recommend(
    request: Request,
    game_id: str,
    exclude: str = "",
    exclude_special: str = "",
    ratio: str = "ALL",
    limit: int = 100,
    start_month: str = "",
    end_month: str = "",
    response: Response = None,
    current_user: Optional[models.User] = Depends(auth_utils.get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    config = GAME_CONFIGS.get(game_id)
    if not config:
        raise HTTPException(status_code=404, detail="Game not found")

    draws = await fetch_historical_draws(game_id, limit, start_month, end_month)

    if not draws:
        raise HTTPException(status_code=503, detail="無法取得彩券開獎資料，請稍後再試")

    freq_map, special_freq_map, consec_prob = calculate_hot_cold_and_consecutive(draws, config)
    gap_map = calculate_gaps(draws, config)

    exclude_list = [int(x) for x in exclude.split(',')] if exclude else []
    exclude_special_list = [int(x) for x in exclude_special.split(',')] if exclude_special else []

    # ── 方法五：取得登入用戶近 20 筆推薦組合，用來排除重複 ──────────────
    recent_combos: set = set()
    if current_user:
        q = (select(models.Recommendation)
             .where(models.Recommendation.user_id == current_user.id,
                    models.Recommendation.game_id == game_id)
             .order_by(desc(models.Recommendation.created_at))
             .limit(20))
        rows = await db.execute(q)
        for rec in rows.scalars().all():
            recent_combos.add(frozenset(rec.numbers))

    numbers = [n for n in freq_map.keys() if n not in exclude_list]

    # ── 方法一：Softmax 溫度採樣（攤平熱號獨大問題）────────────────────
    raw_freqs = [freq_map[n] + 1 for n in numbers]
    sm_weights = softmax_weights(raw_freqs, temperature=1.5)

    # ── 方法二：Gap bonus 混合（久未出現號碼加權 0~30%）────────────────
    gap_vals = [gap_map.get(n, 0) for n in numbers]
    max_gap = max(gap_vals) if gap_vals else 1
    norm_gap = [g / (max_gap + 1) for g in gap_vals]   # normalize 到 0~1
    combined = [sm * (1.0 + ng * 0.3) for sm, ng in zip(sm_weights, norm_gap)]

    # ── 奇偶比例偏置 ─────────────────────────────────────────────────
    if ratio == 'ODD':
        combined = [w * 3 if n % 2 != 0 else w for n, w in zip(numbers, combined)]
    elif ratio == 'EVEN':
        combined = [w * 3 if n % 2 == 0 else w for n, w in zip(numbers, combined)]

    # ── 方法三 + 方法五：分區平衡選號 ─────────────────────────────────
    # 登入用戶最多重試 10 次避免重複；BALANCED 模式拉到 30 次以找到符合奇偶均衡的組合
    need_balance = (ratio == 'BALANCED')
    # 偶數抽幾顆 → 必須 N/N；奇數抽幾顆 → 容差 1（如 5 顆抽 3-2 或 2-3）
    balance_tolerance = config['draw_count'] % 2
    max_attempts = 30 if need_balance else (10 if current_user else 1)

    picked: list = []
    last_balanced: list = []
    for _ in range(max_attempts):
        picked = segment_aware_pick(numbers, combined, config['draw_count'], config['max_num'])
        is_balanced = True
        if need_balance:
            odd_c = sum(1 for n in picked if n % 2 != 0)
            even_c = config['draw_count'] - odd_c
            is_balanced = abs(odd_c - even_c) <= balance_tolerance
            if is_balanced:
                last_balanced = picked
        if is_balanced and frozenset(picked) not in recent_combos:
            break
    # 全試完仍沒命中時：優先回最後一組「均衡」的；都沒有就回最後一組普通的
    recommended = sorted(last_balanced or picked)

    if config.get('has_special'):
        sp_nums = [n for n in special_freq_map.keys() if n not in exclude_special_list]
        if not sp_nums:
            sp_nums = list(special_freq_map.keys())
        sp_weights = [special_freq_map[n] + 1 for n in sp_nums]
        recommended.append(random.choices(sp_nums, weights=sp_weights, k=1)[0])

    algo_tags = ["Softmax 溫度採樣", "Gap 久未出現加分", "號碼分區平衡"]
    reason_text = (
        f"基於過去 {len(draws)} 期資料，連號機率 {consec_prob}%。"
        f"融合演算法（{'、'.join(algo_tags)}）產生高多樣性組合。"
    )
    if exclude or exclude_special or ratio != 'ALL':
        reason_text += " ｜ 已套用自訂篩選條件。"
    if current_user:
        reason_text += " ｜ ✓ 已排除您近期推薦過的重複組合。"

    if response:
        response.headers["Cache-Control"] = "no-store"   # 每次都要重新計算，不可快取
    return {
        "game": config["name"],
        "drawn_from_total": len(draws),
        "consecutive_probability_hist": consec_prob,
        "recommendation": recommended,
        "has_special": config.get('has_special', False),
        "max_num": config['max_num'],
        "special_max": config.get('special_max', 8),
        "frequency_distribution": [
            {"num": k, "count": v} for k, v in freq_map.items()
        ],
        "special_frequency_distribution": [
            {"num": k, "count": v} for k, v in special_freq_map.items()
        ],
        "reason": reason_text
    }

@app.get("/api/history/{game_id}")
@limiter.limit("60/minute")
async def get_history(request: Request, game_id: str, start_month: str = "", end_month: str = "", response: Response = None):
    config = GAME_CONFIGS.get(game_id)
    if not config:
        raise HTTPException(status_code=404, detail="Game not found")

    draws = await fetch_historical_draws(game_id, 5000, start_month, end_month)

    results = []
    for draw in draws:
        date_str = draw.get('lotteryDate', '')
        nums = draw.get('drawNumberSize', [])
        if not nums: continue
        
        real_nums = [int(n) for n in nums]
        if config.get('has_special') and len(real_nums) > config['draw_count']:
            sp = real_nums[-1]
            main_nums = real_nums[:-1]
        else:
            sp = None
            main_nums = real_nums[:config['draw_count']]
            
        odd_count = sum(1 for n in main_nums if n % 2 != 0)
        even_count = len(main_nums) - odd_count
        
        results.append({
            "period": draw.get('period', ''),
            "date": date_str.split('T')[0] if date_str else "",
            "numbers": sorted(main_nums),
            "special": sp,
            "oddCount": odd_count,
            "evenCount": even_count
        })
        
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    return {
        "game": config["name"],
        "has_special": config.get('has_special', False),
        "data": results
    }

@app.get("/api/check_duplicate/{game_id}")
@limiter.limit("60/minute")
async def check_duplicate(request: Request, game_id: str, nums: str = "", special: str = "", start_month: str = "2010-01", end_month: str = "", response: Response = None):
    config = GAME_CONFIGS.get(game_id)
    if not config:
        raise HTTPException(status_code=404, detail="Game not found")

    # fetch potentially huge dataset
    now = datetime.now()
    if not end_month: end_month = now.strftime('%Y-%m')
    draws = await fetch_historical_draws(game_id, 5000, start_month, end_month)
    
    target_nums = set(int(x) for x in nums.split(',')) if nums else set()
    target_sp = int(special) if special else None
    
    matches = []
    
    for draw in draws:
        d_nums = draw.get('drawNumberSize', [])
        if not d_nums: continue
        
        real_nums = [int(n) for n in d_nums]
        if config.get('has_special') and len(real_nums) > config['draw_count']:
            sp = real_nums[-1]
            main_nums = set(real_nums[:-1])
        else:
            sp = None
            main_nums = set(real_nums[:config['draw_count']])
            
        # 完整吻合比對：目標號碼集合必須完全等同於開獎號碼集合
        is_match = True
        if target_nums and target_nums != main_nums:
            is_match = False
            
        if target_sp and config.get('has_special'):
            if sp != target_sp:
                is_match = False
                
        # Handle case where user searched empty numbers but didn't mean to
        if not target_nums and not target_sp:
            is_match = False
            
        if is_match:
            matches.append({
                "period": draw.get('period'),
                "date": draw.get('lotteryDate', '').split('T')[0],
                "numbers": sorted(list(main_nums)),
                "special": sp
            })
            
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    return {
        "game": config["name"],
        "total_checked": len(draws),
        "matches": matches
    }

@app.get("/api/pattern_analysis/{game_id}")
@limiter.limit("60/minute")
async def pattern_analysis(request: Request, game_id: str, limit: int = 50, response: Response = None):
    config = GAME_CONFIGS.get(game_id)
    if not config:
        raise HTTPException(status_code=404, detail="Game not found")

    # 檢查模式分析快取（O(N×M²) 計算成本高，TTL 內直接回傳快取）
    pattern_cache_key = ('pattern', game_id, limit)
    now_ts = time.time()
    if pattern_cache_key in _cache:
        cached_time, cached_data = _cache[pattern_cache_key]
        if now_ts - cached_time < CACHE_TTL:
            if response:
                response.headers["Cache-Control"] = "public, max-age=300"
            return cached_data

    # Fetch recent data based on limit. Empty start_month defaults to 1 year back, sufficient for limit up to 200+
    draws = await fetch_historical_draws(game_id, limit, "", "")
    if not draws:
        raise HTTPException(status_code=503, detail="無法取得彩券開獎資料，請稍後再試")
    
    clean_draws = []
    for d in draws:
        ns = d.get('drawNumberSize', [])
        if not ns: continue
        r = [int(x) for x in ns]
        if config.get('has_special') and len(r) > config['draw_count']:
            main_nums = set(r[:-1])
        else:
            main_nums = set(r[:config['draw_count']])
        clean_draws.append(main_nums)
        
    patterns = []
    min_appear = 2 if limit <= 100 else 3

    # 以共現矩陣取代雙層 numA 迴圈：O(intervals×draws×draw_count²) vs 原本的 O(intervals×max_num×draws×draw_count)
    for interval in range(1, 5):
        appearances: Counter = Counter()   # appearances[a] = a 在 draw[i] 出現的次數
        co_occur: Counter = Counter()      # co_occur[(a,b)] = a 在 draw[i] 且 b 在 draw[i-interval] 的次數

        for i in range(interval, len(clean_draws)):
            for numA in clean_draws[i]:
                appearances[numA] += 1
                for numB in clean_draws[i - interval]:
                    co_occur[(numA, numB)] += 1

        for (numA, numB), b_count in co_occur.items():
            valid_appearances = appearances[numA]
            if valid_appearances < min_appear:
                continue
            hit_rate = b_count / valid_appearances
            if hit_rate >= 0.5:
                patterns.append({
                    "trigger": numA,
                    "target": numB,
                    "interval": interval,
                    "appearances": valid_appearances,
                    "hits": b_count,
                    "probability": round(hit_rate * 100, 1)
                })
                        
    # Sort patterns by probability descending, then by sample size (valid_appearances)
    patterns.sort(key=lambda x: (x['probability'], x['appearances']), reverse=True)
    
    # Return top 50 robust patterns
    result = {
        "game": config["name"],
        "analyzed_draws": len(clean_draws),
        "patterns": patterns[:50]
    }
    # 寫入快取
    if len(_cache) >= 100:
        oldest_key = min(_cache, key=lambda k: _cache[k][0])
        del _cache[oldest_key]
    _cache[pattern_cache_key] = (now_ts, result)
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
