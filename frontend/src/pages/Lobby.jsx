import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const GAMES = [
  { id: 'lotto638', name: '威力彩', desc: '最高獎金 充滿奇蹟', gradient: 'from-rose-500 to-orange-500', shadow: 'shadow-orange-500/30', drawDays: [1, 4], cutoffHour: 20, cutoffMinute: 30 },
  { id: 'lotto649', name: '大樂透', desc: '農曆年加碼 最多得主', gradient: 'from-amber-400 to-yellow-600', shadow: 'shadow-yellow-500/30', drawDays: [2, 5], cutoffHour: 20, cutoffMinute: 30 },
  { id: 'daily539', name: '今彩539', desc: '週一至六 週週有獎', gradient: 'from-sky-400 to-indigo-500', shadow: 'shadow-sky-500/30', drawDays: [1, 2, 3, 4, 5, 6], cutoffHour: 21, cutoffMinute: 30 }
];

function getNextDrawDate(daysOfWeek, cutoffHour, cutoffMinute) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const pastCutoff =
    currentHour > cutoffHour ||
    (currentHour === cutoffHour && currentMinute >= cutoffMinute);
  const cutoffLabel = `${cutoffHour}:${String(cutoffMinute).padStart(2, '0')}`;

  if (daysOfWeek.includes(currentDay) && !pastCutoff) {
    return `今日 ${cutoffLabel} 截止`;
  }

  for (let i = 1; i <= 7; i++) {
    const nextDay = (currentDay + i) % 7;
    if (daysOfWeek.includes(nextDay)) {
       const nextDate = new Date(now);
       nextDate.setDate(now.getDate() + i);
       const days = ["日", "一", "二", "三", "四", "五", "六"];
       return `${nextDate.getMonth() + 1}/${nextDate.getDate()} (週${days[nextDate.getDay()]})`;
    }
  }
  return '';
}

export default function Lobby() {
  const navigate = useNavigate();
  const [hoveredIndex, setHoveredIndex] = React.useState(null);
  const [lobbyData, setLobbyData] = React.useState({});

  React.useEffect(() => {
    // 近 30 期只需往前約 5 個月資料，縮短後端向台灣彩券 API 的抓取量
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // 各彩券獨立 fetch，誰先回來誰先顯示，不需等全部完成
    GAMES.forEach(game => {
      fetch(`${API_BASE}/api/ai_recommend/${game.id}?limit=30&start_month=${startMonth}`)
        .then(res => res.json())
        .then(data => {
          if (!data || !data.frequency_distribution) {
            setLobbyData(prev => ({ ...prev, [game.id]: { hotNums: [], hotSpecial: [] } }));
            return;
          }
          // 抓出出現次數最高的前 3 名號碼
          const hotNums = data.frequency_distribution
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(d => d.num);

          // 特殊號碼（威力彩第二區）
          let hotSpecial = [];
          if (data.has_special && data.special_frequency_distribution) {
            hotSpecial = data.special_frequency_distribution
              .sort((a, b) => b.count - a.count)
              .slice(0, 1)
              .map(d => d.num);
          }
          // 每張卡片獨立更新，先回來的先顯示
          setLobbyData(prev => ({ ...prev, [game.id]: { hotNums, hotSpecial } }));
        })
        .catch(() => {
          setLobbyData(prev => ({ ...prev, [game.id]: { hotNums: [], hotSpecial: [] } }));
        });
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-16"
      >
        <h2 className="text-4xl md:text-6xl font-black mb-4 tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
          選擇您的戰場
        </h2>
        <p className="text-slate-400 text-lg">透過數據與運算，預見下一個幸運組合</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 w-full max-w-5xl px-4 perspective-1000">
        {GAMES.map((game, index) => {
          const isHovered = hoveredIndex === index;
          return (
            <motion.div
              layoutId={`game-card-${game.id}`}
              key={game.id}
              onClick={() => navigate(`/game/${game.id}`)}
              onHoverStart={() => setHoveredIndex(index)}
              onHoverEnd={() => setHoveredIndex(null)}
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay: index * 0.15,
                type: 'spring',
                stiffness: 100,
                damping: 15
              }}
              whileHover={{ scale: 1.05, y: -10 }}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                'relative flex flex-col items-center justify-center p-8 rounded-3xl cursor-pointer overflow-hidden transition-all duration-300',
                'bg-slate-800/80 backdrop-blur-xl border border-white/10 shadow-xl',
                `hover:${game.shadow} hover:shadow-2xl`
              )}
              style={{
                transformStyle: 'preserve-3d',
              }}
            >
              <div 
                className={clsx(
                  'absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300',
                  game.gradient,
                  { 'opacity-20': isHovered }
                )} 
              />
              
              {/* 球體噴發感動畫 */}
              <AnimatePresence>
                {isHovered && (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                        animate={{ 
                          opacity: 0, 
                          scale: Math.random() * 1.5 + 0.5,
                          x: (Math.random() - 0.5) * 150,
                          y: (Math.random() - 0.5) * 150 - 50
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={clsx('absolute w-4 h-4 rounded-full bg-gradient-to-br', game.gradient)}
                      />
                    ))}
                  </>
                )}
              </AnimatePresence>

              <motion.div 
                layoutId={`game-title-${game.id}`}
                className={clsx(
                  "text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r mb-2",
                  game.gradient
                )}
              >
                {game.name}
              </motion.div>
              <motion.div 
                layoutId={`game-desc-${game.id}`}
                className="text-slate-400 font-medium tracking-wide z-10 mb-6 text-center"
              >
                {game.desc}
              </motion.div>

              <div className="z-10 text-sm bg-slate-900/50 px-4 py-2 rounded-lg border border-white/5 w-full text-center">
                 <span className="text-cyan-400 font-medium">下次開獎：</span> 
                 <span className="text-white font-bold">{getNextDrawDate(game.drawDays, game.cutoffHour, game.cutoffMinute)}</span>
              </div>

              {/* 熱門號碼區塊 */}
              <div className="z-10 mt-4 w-full bg-slate-800/40 rounded-xl p-3 border border-white/5">
                <div className="text-xs text-slate-400 text-center mb-2 font-medium">近 30 期最熱門號碼</div>
                
                {lobbyData[game.id] ? (
                  <div className="flex justify-center flex-wrap gap-2">
                     {lobbyData[game.id].hotNums.map(n => (
                       <span key={n} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm shadow-inner text-white">
                         {String(n).padStart(2, '0')}
                       </span>
                     ))}
                     {lobbyData[game.id].hotSpecial.length > 0 && (
                       <span className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500/80 to-rose-700/80 text-white flex items-center justify-center font-bold text-sm shadow-[0_0_10px_rgba(225,29,72,0.4)]">
                         {String(lobbyData[game.id].hotSpecial[0]).padStart(2, '0')}
                       </span>
                     )}
                  </div>
                ) : (
                  <div className="h-8 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-slate-500 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
