# CONTEXT.md — 台灣彩券 AI 情報室 開發進度

> 最後更新：2026-04-12

---

## 專案概覽

**台灣彩券 AI 情報室** — React 19 SPA + Python FastAPI 全端應用。
資料來源：台灣彩券公開 API（即時抓取，5 分鐘 in-memory 快取）。
資料庫：Neon PostgreSQL（僅用於會員資料，彩券資料不落地）。

---

## 部署資訊

| 層 | 平台 | URL |
|---|---|---|
| Frontend | Vercel | 根目錄 `vercel.json` 處理 SPA routing |
| Backend | Render | `uvicorn main:app`，`/healthz` 供健康檢查 |
| Database | Neon (PostgreSQL) | 連線字串存於 `backend/.env` → `DATABASE_URL` |

---

## 已完成功能

### 彩券分析功能
- **6 個 Tab 的分析儀表板（GameDashboard）**
  - `stats` — 號碼頻率長條圖（ECharts）
  - `ai` — AI 推薦號碼（含重新推薦按鈕）
  - `filter` — 自訂號碼篩選器（排除號碼、奇偶比例）
  - `history` — 歷史開獎區間查詢
  - `duplicate_check` — 歷史重複號碼檢驗
  - `pattern` — 大數據拖牌預測（共現矩陣分析）

- **支援三種彩券**：威力彩 (lotto638)、大樂透 (lotto649)、今彩539 (daily539)

- **全局分析範圍控制**：擷取期數（50/100/200）、起訖月份（DatePicker）

### AI 推薦演算法（升級版）
三種方法混合：
1. **Temperature Softmax**（正規化後 temperature=1.0，冷熱比約 2.7x，攤平熱號獨大）
2. **Gap 久未出現加分**（距今越久加最多 30% 額外權重）
3. **號碼分區平衡**（低/中/高三段軟約束，避免號碼集中同一區間）
4. **排除近期重複組合**（登入用戶限定，取 DB 最近 20 筆，最多重試 10 次）

每次點擊保證不同結果：後端 `Cache-Control: no-store`，前端 URL 加 `_t=timestamp`。

### 會員系統（2026-04-12 完成）
- **JWT 認證**：Email + 密碼，Token 有效期 1 天，存於 localStorage
- **註冊/登入/登出**：`/login` 路由，AnimatePresence 切換動畫
- **推薦紀錄自動儲存**：點擊「套用篩選」或「重新推薦」後自動寫入 DB
- **推薦紀錄查詢**：`我的紀錄` Tab（僅登入用戶顯示），可依彩種篩選
- **篩選偏好儲存/載入**：FilterTab 可手動儲存，下次開啟自動回填

### 效能與架構
- Vite code splitting（vendor-react / vendor-echarts / vendor-motion / vendor-datepicker）
- React lazy loading + Suspense
- 後端 in-memory 快取（TTL 5 分鐘），防 race condition 的 inflight 機制
- 後端 cold start 自動重試（8s / 16s / 25s，最多 3 次），前端顯示喚醒提示

---

## 專案結構

```
react/latou/
├── start.bat                    # 一鍵啟動前後端
├── vercel.json                  # Vercel SPA routing（根目錄）
│
├── backend/
│   ├── main.py                  # FastAPI 主程式（API 端點、彩券邏輯、快取）
│   ├── auth.py                  # JWT 建立/驗證、bcrypt 密碼雜湊
│   ├── database.py              # SQLAlchemy asyncpg 引擎、init_db
│   ├── models.py                # ORM 模型：User / Recommendation / Preference
│   ├── schemas.py               # Pydantic schemas（request/response 型別）
│   ├── requirements.txt         # 依賴套件
│   ├── .env                     # 環境變數（不上傳）DATABASE_URL / JWT_SECRET
│   └── routers/
│       ├── auth_router.py       # POST /api/auth/register|login, GET /api/auth/me
│       └── user_router.py       # GET/POST /api/user/recommendations, PUT/GET /api/user/preferences
│
└── frontend/src/
    ├── main.jsx                 # React Router 入口
    ├── App.jsx                  # 全局 Header（登入狀態）、背景特效、路由
    ├── context/
    │   └── AuthContext.jsx      # user / token / login / logout / authFetch
    └── pages/
        ├── Lobby.jsx            # 首頁，三種彩券選擇卡片
        ├── GameDashboard.jsx    # 主分析頁（~900 行，含所有 Tab 子組件）
        └── AuthPage.jsx         # 登入/註冊頁
```

---

## 資料庫 Schema

```sql
users           (id UUID PK, email, password_hash, display_name, created_at)
recommendations (id UUID PK, user_id FK, game_id, numbers[], special, exclude_nums[],
                 exclude_sp[], ratio, limit_used, created_at)
preferences     (id UUID PK, user_id FK, game_id, exclude_nums[], exclude_sp[], ratio,
                 updated_at)  -- UNIQUE (user_id, game_id)
```

---

## API 端點一覽

| 方法 | 路徑 | 說明 | 需登入 |
|---|---|---|---|
| GET | `/healthz` | 健康檢查 | |
| GET | `/api/ai_recommend/{game_id}` | AI 推薦（含演算法升級） | 選填（登入後排除重複） |
| GET | `/api/history/{game_id}` | 歷史開獎查詢 | |
| GET | `/api/check_duplicate/{game_id}` | 歷史重複號碼檢驗 | |
| GET | `/api/pattern_analysis/{game_id}` | 拖牌模式分析 | |
| POST | `/api/auth/register` | 註冊 | |
| POST | `/api/auth/login` | 登入 | |
| GET | `/api/auth/me` | 取得當前用戶 | ✓ |
| POST | `/api/user/recommendations/{game_id}` | 儲存推薦紀錄 | ✓ |
| GET | `/api/user/recommendations` | 查詢推薦紀錄 | ✓ |
| PUT | `/api/user/preferences/{game_id}` | 儲存篩選偏好 | ✓ |
| GET | `/api/user/preferences/{game_id}` | 讀取篩選偏好 | ✓ |

---

## 本地啟動

```bat
# 第一次需安裝後端依賴
cd backend
.\venv\Scripts\activate.bat
pip install -r requirements.txt

# 之後直接啟動
start.bat
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 下次接手應從哪裡開始

### 環境確認
1. `backend/.env` 確認 `DATABASE_URL` 和 `JWT_SECRET` 存在
2. 執行 `pip install -r requirements.txt`（venv 內）
3. 執行 `start.bat` 確認前後端都啟動正常

### 潛在的後續需求（尚未實作）
- **忘記密碼 / Email 驗證**：目前無驗證流程，可串接 SendGrid 或 Supabase Auth
- **推薦紀錄刪除功能**：`我的紀錄` Tab 目前只能查看，無法刪除單筆
- **會員頁面**：顯示統計（總推薦次數、最常用彩種等）
- **Render 冷啟動優化**：免費方案 15 分鐘無活動會休眠，可考慮升級或定時 ping
- **前端測試**：目前無任何測試覆蓋
- **密碼變更**：目前無修改密碼功能

### 注意事項
- `backend/.env` 不在 git 中，部署 Render 時需手動設定環境變數
- Neon 免費方案：7 天無活動會暫停，需手動喚醒
- Code review 與 debug 使用 **Codex**
