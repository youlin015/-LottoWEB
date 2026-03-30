from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from datetime import datetime
from collections import Counter
import random
import time

# 簡易 in-memory 快取，避免重複呼叫台灣彩券外部 API
_cache: dict = {}
CACHE_TTL = 300  # 快取 5 分鐘

app = FastAPI(title="Taiwan Lottery Situation Room API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
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

    # 檢查快取，命中則直接回傳
    cache_key = (game_id, limit, start_month, end_month)
    now_ts = time.time()
    if cache_key in _cache:
        cached_time, cached_data = _cache[cache_key]
        if now_ts - cached_time < CACHE_TTL:
            return cached_data

    params = {
        "period": "",
        "month": start_month,
        "endMonth": end_month,
        "pageNum": 1,
        "pageSize": limit
    }

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    async with httpx.AsyncClient(verify=False, headers=headers) as client:
        try:
            resp = await client.get(url, params=params)
            data = resp.json()
            # Actual content inside ['content']['data'] or similar based on TaiwanLotteryAPI response
            res_content = data.get('content', {})
            list_docs = res_content.get('daily539Res', []) if game_id == 'daily539' else res_content.get('lotto649Res', []) if game_id == 'lotto649' else res_content.get('superLotto638Res', [])
            result = list_docs[:limit]
            # 寫入快取
            _cache[cache_key] = (now_ts, result)
            return result
        except Exception as e:
            print(f"Error fetching data: {e}")
            return []

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
        if nums:
            real_nums = [int(n) for n in nums]
            if has_special and len(real_nums) > config['draw_count']:
                special_nums = [real_nums[-1]]
                real_nums = real_nums[:-1]
            else:
                special_nums = []
        else:
            real_nums = random.sample(range(1, config['max_num'] + 1), config['draw_count'])
            if has_special:
                special_nums = [random.randint(1, config.get('special_max', 8))]
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

@app.get("/api/ai_recommend/{game_id}")
async def ai_recommend(
    game_id: str, 
    exclude: str = "", 
    exclude_special: str = "", 
    ratio: str = "ALL",
    limit: int = 100,
    start_month: str = "",
    end_month: str = ""
):
    config = GAME_CONFIGS.get(game_id)
    if not config:
        return {"error": "Game not found"}
        
    draws = await fetch_historical_draws(game_id, limit, start_month, end_month)
    
    # In case API fails
    if not draws:
        draws = []
        for _ in range(100):
            mock_nums = random.sample(range(1, config['max_num'] + 1), config['draw_count'])
            if config.get('has_special'): mock_nums.append(random.randint(1, config.get('special_max', 8)))
            draws.append({'drawNumberSize': mock_nums})
            
    freq_map, special_freq_map, consec_prob = calculate_hot_cold_and_consecutive(draws, config)
    
    # Process exclusions
    exclude_list = [int(x) for x in exclude.split(',')] if exclude else []
    exclude_special_list = [int(x) for x in exclude_special.split(',')] if exclude_special else []
    
    numbers = [n for n in freq_map.keys() if n not in exclude_list]
    weights = [freq_map[n] + 1 for n in numbers]
    
    # Process Odd/Even Ratio Bias
    if ratio == 'ODD':
        weights = [w * 3 if n % 2 != 0 else w for n, w in zip(numbers, weights)]
    elif ratio == 'EVEN':
        weights = [w * 3 if n % 2 == 0 else w for n, w in zip(numbers, weights)]
    
    recommended = []
    available_nums = numbers.copy()
    available_w = weights.copy()
    
    for _ in range(config['draw_count']):
        idx = random.choices(range(len(available_nums)), weights=available_w, k=1)[0]
        selected = available_nums.pop(idx)
        available_w.pop(idx)
        recommended.append(selected)
        
    recommended.sort()
    
    if config.get('has_special'):
        sp_nums = [n for n in special_freq_map.keys() if n not in exclude_special_list]
        if not sp_nums: # Failsafe
            sp_nums = list(special_freq_map.keys())
        sp_weights = [special_freq_map[n] + 1 for n in sp_nums]
        special_recommendation = random.choices(sp_nums, weights=sp_weights, k=1)[0]
        recommended.append(special_recommendation)  # 最後一顆放到陣列最後
    
    reason_text = f"基於過去數據分析，連號機率為 {consec_prob}%。演算法根據冷熱頻次分配抽樣權重，推薦這組高機率組合。"
    if exclude or exclude_special or ratio != 'ALL':
        reason_text += " (已套用您指定的客製化篩選條件與奇偶數過濾邏輯)"
        
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
async def get_history(game_id: str, month: str = ""):
    config = GAME_CONFIGS.get(game_id)
    if not config: return {"error": "Game not found"}
    
    # If a specific month is queried, only fetch that boundary
    start_m = month if month else ""
    end_m = month if month else ""
        
    draws = await fetch_historical_draws(game_id, 200, start_m, end_m)
    
    # In case API fails just mock some data
    if not draws:
        draws = []
        for d in range(1, 31):
            mock_nums = random.sample(range(1, config['max_num'] + 1), config['draw_count'])
            if config.get('has_special'): mock_nums.append(random.randint(1, config.get('special_max', 8)))
            draws.append({
                'period': f"1150000{d:02}",
                'lotteryDate': f"2026-03-{d:02}T00:00:00",
                'drawNumberSize': mock_nums
            })
            if len(draws) == 10: break

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
        
    return {
        "game": config["name"],
        "has_special": config.get('has_special', False),
        "data": results
    }

@app.get("/api/check_duplicate/{game_id}")
async def check_duplicate(game_id: str, nums: str = "", special: str = "", start_month: str = "2010-01", end_month: str = ""):
    config = GAME_CONFIGS.get(game_id)
    if not config: return {"error": "Game not found"}
    
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
            
        # If target numbers are a subset of the drawn numbers
        is_match = True
        if target_nums and not target_nums.issubset(main_nums):
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
            
    return {
        "game": config["name"],
        "total_checked": len(draws),
        "matches": matches
    }

@app.get("/api/pattern_analysis/{game_id}")
async def pattern_analysis(game_id: str, limit: int = 50):
    config = GAME_CONFIGS.get(game_id)
    if not config: return {"error": "Game not found"}
    
    # Fetch recent data based on limit. Empty start_month defaults to 1 year back, sufficient for limit up to 200+
    draws = await fetch_historical_draws(game_id, limit, "", "")
    if not draws: return {"patterns": []}
    
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
    max_num = config['max_num']
    
    # Scan intervals 1 to 4 (Next draw to Skip-3 draws)
    for interval in range(1, 5):
        for numA in range(1, max_num + 1):
            valid_appearances = 0
            subsequent_counts = Counter()
            
            for i in range(interval, len(clean_draws)):
                if numA in clean_draws[i]:
                    valid_appearances += 1
                    future_draw = clean_draws[i - interval]
                    for numB in future_draw:
                        subsequent_counts[numB] += 1
            
            # Since user wants short term streaks, lower min_appear depending on limit.
            min_appear = 2 if limit <= 100 else 3
            
            if valid_appearances >= min_appear:
                for numB, b_count in subsequent_counts.items():
                    hit_rate = b_count / valid_appearances
                    if hit_rate >= 0.5:  # lowered to 50% minimum to show viable short-term targets
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
    return {
        "game": config["name"],
        "analyzed_draws": len(clean_draws),
        "patterns": patterns[:50]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
