import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

// 使用 lazy loading，讓 Lobby 和 GameDashboard 分開打包，不在首屏一次載入
const Lobby = lazy(() => import("./pages/Lobby"));
const GameDashboard = lazy(() => import("./pages/GameDashboard"));

// 獨立組件以便在 Router 內使用 useLocation hook
function AnimatedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/game/:gameId" element={<GameDashboard />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-white overflow-hidden relative selection:bg-cyan-500/30 flex flex-col">
        <BackgroundEffects />
        <DisclaimerBanner />
        <Header />

        <main className="relative z-10 container mx-auto px-4 py-8 flex-1">
          {/* Suspense 讓 lazy 元件在載入時顯示 loading 畫面 */}
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          }>
            <AnimatedRoutes />
          </Suspense>
        </main>

        <FeedbackButton />
      </div>
    </Router>
  );
}

// 頂端全局免責聲明 (為符合 Google AdSense 放行標準設計)
function DisclaimerBanner() {
  return (
    <div className="relative z-30 bg-rose-950/40 text-rose-200/80 text-[10px] md:text-sm text-center py-2 px-2 md:px-4 border-b border-rose-900/50 w-full flex items-center justify-center">
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <span className="text-rose-500 font-black animate-pulse">⚠️</span>
        <span className="tracking-wide">
          <strong className="text-rose-400 mr-2">免責聲明：</strong>
          本站僅提供歷史數據分析與演算法引擎，非官方投注平台。購買彩券敬請量力而為，未滿 18 歲不得購買及兌領。
        </span>
      </div>
    </div>
  );
}

// 頂部導航組件：顯示今天時間
function Header() {
  const navigate = useNavigate();
  const today = new Date();
  const [timeStr, setTimeStr] = React.useState(today.toLocaleTimeString());

  React.useEffect(() => {
    const timer = setInterval(() => setTimeStr(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][today.getDay()];
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="relative z-20 flex justify-between items-center px-8 py-4 bg-slate-800/50 backdrop-blur-md border-b border-white/5"
    >
      <h1 
        className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent cursor-pointer"
        onClick={() => navigate('/')}
      >
        台灣彩券戰情室
      </h1>
      <div className="text-right flex items-center gap-4">
        <div className="text-sm text-slate-400 font-medium tracking-wide">
          {dateStr} (星期{dayOfWeek})
        </div>
        <div className="font-mono text-xl text-cyan-400 bg-cyan-950/50 px-3 py-1 rounded-lg shadow-[0_0_15px_rgba(34,211,238,0.2)]">
          {timeStr}
        </div>
      </div>
    </motion.header>
  );
}

// Antigravity 物理感背景組件 (模擬漂浮或深空)
function BackgroundEffects() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] mix-blend-screen" />
    </div>
  );
}

// 收集用戶回饋浮動按鈕 (方案A)
function FeedbackButton() {
  return (
    <motion.a
      href="https://docs.google.com/forms/d/e/1FAIpQLSchmQ8p3XkpfTn84rPevqmFRZn22lTircAZeqwX9C9P4Vw2rw/viewform"
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.1, rotate: 5 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-8 right-8 z-50 flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-6 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(225,29,72,0.5)] hover:shadow-[0_0_30px_rgba(225,29,72,0.8)] transition-all cursor-pointer"
    >
      <span className="text-xl">💬</span>
      <span>給我們建議</span>
    </motion.a>
  );
}
