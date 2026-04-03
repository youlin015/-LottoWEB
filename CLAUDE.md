# CLAUDE.md — Taiwan Lottery Situation Room

## Project Overview

Taiwan lottery analytics app — React 19 SPA + Python FastAPI backend. No database; all data fetched from Taiwan Lottery public API in real time (with 5-min in-memory cache).

---

## Commands

**Frontend** (`frontend/`):
```bash
npm run dev      # Dev server at http://localhost:5173
npm run build    # Production build → frontend/dist/
npm run lint     # ESLint
npm run preview  # Preview production build locally
```

**Backend** (`backend/`):
```bash
# Activate venv first (Windows):
.\venv\Scripts\activate.bat

uvicorn main:app --reload   # API at http://localhost:8000
```

**Start both together** (from repo root):
```bash
start.bat   # Opens two CMD windows: backend (8000) + frontend (5173)
```

---

## Architecture

### Frontend (`frontend/src/`)

| File | Role |
|---|---|
| `main.jsx` | Entry point — React Router setup |
| `App.jsx` | Root: global header, live clock, lazy page loading, disclaimer banner |
| `pages/Lobby.jsx` | Game selection — 3 lottery cards with particle animations |
| `pages/GameDashboard.jsx` | Main analytics dashboard — monolithic ~900 lines, 6 tabs |
| `components/` | Empty — sub-components are inlined in pages |

**Tech stack:**
- React 19 + React Router 7 (`/` → Lobby, `/game/:gameId` → GameDashboard)
- Vite 8 with manual chunk splitting (see `vite.config.js`)
- Tailwind CSS 4 (via Vite plugin, not PostCSS)
- ECharts 6 (`echarts-for-react`) for charts
- Framer Motion 12 for animations
- Native `fetch` for API calls — no axios/react-query
- `VITE_API_URL` env var controls backend URL (default: `http://127.0.0.1:8000`)

**Vite code splitting chunks:**
- `vendor-react` — React core + React Router
- `vendor-echarts` — ECharts
- `vendor-motion` — Framer Motion
- `vendor-datepicker` — date-fns + react-datepicker

**State management:** Plain `useState` / `useEffect` — no Redux/Zustand.

**Fallback:** Frontend uses mock/random data if backend API call fails.

---

### Backend (`backend/main.py`)

Single-file FastAPI app (~390 lines). No database.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/healthz` | Health check for Render ping |
| GET | `/api/ai_recommend/{game_id}` | Hot/cold analysis + weighted random picks |
| GET | `/api/history/{game_id}` | Raw historical draw results |
| GET | `/api/check_duplicate/{game_id}` | Check if a number combo ever won |
| GET | `/api/pattern_analysis/{game_id}` | Co-occurrence pattern analysis |

**`/api/ai_recommend` query params:** `limit`, `start_month` (YYYY-MM), `end_month`, `exclude`, `exclude_special`, `ratio` (ALL/ODD/EVEN)

**Caching:** 5-minute in-memory dict cache on `fetch_historical_draws()` — prevents hammering the upstream API.

**CORS:** All origins allowed (`*`) — suitable for current deployment model.

---

### Game IDs

| `gameId` (route) | Chinese name | Pool | Special | Draw days |
|---|---|---|---|---|
| `lotto638` | 威力彩 | 6 of 1–38 | 1 of 1–8 | Mon / Thu |
| `lotto649` | 大樂透 | 6 of 1–49 | — | Tue / Fri |
| `daily539` | 今彩539 | 5 of 1–39 | — | Mon – Sat |

---

### GameDashboard — 6 Tabs

| Tab key | Label | Content |
|---|---|---|
| `stats` | 📊 數據分布 | Frequency bar charts for all numbers |
| `ai` | 🔮 AI 推薦 | Weighted-random recommendation result |
| `filter` | 🎯 自訂篩選 | Exclude numbers, odd/even ratio, special exclusion |
| `history` | 📅 歷史開獎 | Past draw search by month |
| `duplicate_check` | 🔍 重複檢查 | Did this combo ever win? |
| `pattern` | 📈 模式分析 | Co-occurrence pattern predictions |

---

## Deployment

| Layer | Platform | Notes |
|---|---|---|
| Frontend | Vercel | `vercel.json` at repo root rewrites all paths → `index.html` (SPA) |
| Backend | Render | `uvicorn main:app`, health-checked via `/healthz` |

**Environment variables:**
- Frontend: `VITE_API_URL` — production backend URL (set in Vercel dashboard)
