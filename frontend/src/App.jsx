import React from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Lobby from "./pages/Lobby";
import GameDashboard from "./pages/GameDashboard";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-white overflow-hidden relative selection:bg-cyan-500/30">
        <BackgroundEffects />
        <Header />
        
        <main className="relative z-10 container mx-auto px-4 py-8 h-full">
          <Routes>
            <Route path="/" element={<Lobby />} />
            <Route path="/game/:gameId" element={<GameDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
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
