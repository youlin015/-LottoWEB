import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import ReactECharts from 'echarts-for-react';

const TABS = [
  { id: 'stats', label: '📊 數據統計圖表' },
  { id: 'ai', label: '🔮 AI 推薦號碼' },
  { id: 'filter', label: '🎯 自訂號碼篩選器' },
  { id: 'history', label: '📅 歷史中獎查詢' }
];

const QUICK_GAMES = [
  { id: 'lotto638', name: '威力彩' },
  { id: 'lotto649', name: '大樂透' },
  { id: 'daily539', name: '今彩539' }
];

export default function GameDashboard() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stats');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [limit, setLimit] = useState(100);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  const fetchData = (filters = null) => {
    setLoading(true);
    let url = `http://127.0.0.1:8000/api/ai_recommend/${gameId}`;
    
    const params = new URLSearchParams();
    
    // Global filters
    params.append('limit', limit);
    if(startMonth) params.append('start_month', startMonth);
    if(endMonth) params.append('end_month', endMonth);

    // Custom Filters from AI/Filter tab
    if (filters) {
       if(filters.excludeNums?.length) params.append('exclude', filters.excludeNums.join(','));
       if(filters.excludeSpecialNums?.length) params.append('exclude_special', filters.excludeSpecialNums.join(','));
       if(filters.oddEvenRatio && filters.oddEvenRatio !== 'ALL') params.append('ratio', filters.oddEvenRatio);
    }
    url += `?${params.toString()}`;

    fetch(url)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
        if(filters) setActiveTab('ai'); // Switch to AI tab after filtering
      })
      .catch(err => {
        console.error("API error, using mock data.", err);
        const mockFreq = Array.from({length: 39}, (_, i) => ({num: i+1, count: Math.floor(Math.random() * 20 + 5)}));
        const mockSpecialFreq = Array.from({length: 8}, (_, i) => ({num: i+1, count: Math.floor(Math.random() * 10 + 2)}));
        const hasSpecial = gameId === 'lotto638';
        const rec = hasSpecial ? [5, 12, 19, 23, 33, 38, 7] : [5, 12, 19, 23, 33];
        setData({
          game: gameId === 'lotto638' ? '威力彩' : gameId === 'lotto649' ? '大樂透' : '今彩539',
          drawn_from_total: 100,
          consecutive_probability_hist: 45.2,
          recommendation: rec,
          has_special: hasSpecial,
          max_num: gameId === 'lotto638' ? 38 : gameId === 'lotto649' ? 49 : 39,
          special_max: 8,
          frequency_distribution: mockFreq,
          special_frequency_distribution: mockSpecialFreq,
          reason: "基於過去的數據分析，連號機率高於平均。演算法根據冷熱頻次分配抽樣權重，推薦這組高機率組合。"
        });
        setLoading(false);
        if(filters) setActiveTab('ai');
      });
  };

  useEffect(() => {
    fetchData(null);
  }, [gameId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-6xl mx-auto flex flex-col h-full mt-4"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 p-2 rounded-lg hover:bg-white/5"
          >
            ← 返回大廳
          </button>
          <motion.h2 
            layoutId={`game-title-${gameId}`}
            className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500"
          >
            {data ? data.game : '載入中...'}
          </motion.h2>
          <motion.div layoutId={`game-desc-${gameId}`} className="text-slate-400 ml-4 hidden md:block">
            戰情情報切換區
          </motion.div>
        </div>

        {/* 快速切換其他遊戲戰場 */}
        <div className="flex gap-2">
          {QUICK_GAMES.map(g => (
            <button
              key={g.id}
              onClick={() => {
                setLoading(true);
                navigate(`/game/${g.id}`);
              }}
              className={clsx(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all border",
                gameId === g.id 
                  ? "bg-cyan-500/20 text-cyan-400 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-default pointer-events-none" 
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:border-cyan-500 hover:text-cyan-400"
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* 歷史數據全局分析範圍面板 */}
      <div className="bg-slate-800/60 border border-cyan-500/30 rounded-2xl p-4 md:p-6 mb-6 flex flex-col xl:flex-row gap-6 xl:items-end">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-slate-400 text-sm mb-2 font-medium">擷取最大期數</label>
            <div className="flex gap-2">
              {[50, 100, 200].map(val => (
                <button
                  key={val}
                  onClick={() => setLimit(val)}
                  className={clsx(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all border",
                    limit === val 
                      ? "bg-cyan-500/20 text-cyan-400 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]" 
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:border-cyan-500/50"
                  )}
                >
                  {val} 期
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-2 font-medium">開始月份 (選填)</label>
            <input 
              type="month" 
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-2 font-medium">結束月份 (選填)</label>
            <input 
              type="month" 
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
          </div>
        </div>
        <div>
          <button 
            onClick={() => fetchData()} 
            className="w-full xl:w-auto h-10 px-8 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 font-bold rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
          >
            更新時間區間數據
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 mb-6 border-b border-slate-700/50 pb-2 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-6 py-3 rounded-t-xl font-medium transition-all relative whitespace-nowrap',
              activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            )}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-tab"
                className="absolute inset-0 bg-slate-800/80 border-t-2 border-cyan-400 rounded-t-xl -z-10"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 min-h-[50vh] relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'stats' && data && <StatsTab key="stats" data={data} />}
            {activeTab === 'ai' && data && <AITab key="ai" data={data} />}
            {activeTab === 'filter' && data && <FilterTab key="filter" data={data} onApply={fetchData} />}
            {activeTab === 'history' && <HistoryTab key="history" gameId={gameId} />}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

// ======================== TABS 組件 ======================== //

function StatsTab({ data }) {
  const [sortBy, setSortBy] = useState('num'); // 'num' | 'count'

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-2xl font-bold mb-1">各號碼歷史頻率 (最近 {data.drawn_from_total} 期)</h3>
          <p className="text-slate-400 text-sm">點擊按鈕可切換排序維度 (X軸: 號碼, Y軸: 出現次數)</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setSortBy('num')}
            className={clsx("px-4 py-2 rounded-lg text-sm font-medium transition", sortBy === 'num' ? "bg-cyan-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
          >
            依號碼 (X軸)
          </button>
          <button 
            onClick={() => setSortBy('count')}
            className={clsx("px-4 py-2 rounded-lg text-sm font-medium transition", sortBy === 'count' ? "bg-cyan-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
          >
            依次數 (Y軸)
          </button>
        </div>
      </div>
      <div className="flex-1 w-full overflow-y-auto pr-2 pb-8">
        <ChartBlock key="zone1" title={data.has_special ? "第一區獎號" : null} distribution={data.frequency_distribution} sortBy={sortBy} />
        {data.has_special && data.special_frequency_distribution && (
          <ChartBlock key="zone2" title="第二區特殊獎號" distribution={data.special_frequency_distribution} sortBy={sortBy} isSpecial />
        )}
      </div>
    </motion.div>
  );
}

function ChartBlock({ title, distribution, sortBy, isSpecial }) {
  const chartData = [...distribution].sort((a, b) => {
    if (sortBy === 'num') return a.num - b.num;
    return b.count - a.count;
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: chartData.map(d => d.num),
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      name: '出現次數',
      nameTextStyle: { color: '#94a3b8' },
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
    },
    series: [
      {
        name: '次數',
        type: 'bar',
        barWidth: '60%',
        data: chartData.map(d => d.count),
        itemStyle: {
          color: function(params) {
            const count = params.value;
            if(isSpecial) return '#f43f5e'; // rose-500 for special
            if(count > 20) return '#ef4444'; // red-500
            if(count > 15) return '#f59e0b'; // amber-500
            if(count > 10) return '#3b82f6'; // blue-500
            return '#06b6d4'; // cyan-500
          },
          borderRadius: [4, 4, 0, 0]
        }
      }
    ],
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { start: 0, end: 100 }
    ],
  };

  return (
    <div className="mb-12">
      {title && <h4 className="text-xl font-bold mb-4 text-cyan-400">{title}</h4>}
      <div style={{ height: '400px', width: '100%' }}>
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}

function AITab({ data }) {
  // 模擬數字球一顆顆跳出 (Canvas/CSS Animation 概念使用 Framer Motion 實作)
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="h-full flex flex-col items-center justify-center p-8">
      <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-700/50 shadow-2xl w-full max-w-3xl text-center backdrop-blur-md relative overflow-hidden">
        {/* 背景光暈 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 blur-[50px] pointer-events-none" />

        <h3 className="text-3xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
          核心演算法產出推薦
        </h3>
        
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-12">
          {data.recommendation.map((num, i) => {
            const isSpecial = data.has_special && i === data.recommendation.length - 1;
            return (
              <React.Fragment key={`${num}-${i}`}>
                {isSpecial && <div className="text-rose-500/80 font-black text-4xl mx-2">+</div>}
                <motion.div
                  initial={{ scale: 0, y: 100, rotate: -180 }}
                  animate={{ scale: 1, y: 0, rotate: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 20,
                    delay: i * 0.4
                  }}
                  className={clsx(
                    "relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-3xl font-black text-slate-900 border-4",
                    isSpecial 
                      ? "bg-gradient-to-br from-red-400 to-rose-600 shadow-[0_0_30px_rgba(225,29,72,0.6)] border-rose-200" 
                      : "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_0_30px_rgba(245,158,11,0.5)] border-yellow-200"
                  )}
                >
                  {String(num).padStart(2, '0')}
                  {isSpecial && <span className="absolute -bottom-7 text-sm text-rose-400 font-bold whitespace-nowrap tracking-widest drop-shadow-md">第二區</span>}
                </motion.div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-600/50 text-left">
          <h4 className="text-cyan-400 font-bold mb-2 flex items-center gap-2">
            <span className="text-xl">🤖</span> AI 推薦邏輯
          </h4>
          <p className="text-slate-300 leading-relaxed">
            {data.reason}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function FilterTab({ data, onApply }) {
  const [excludeNums, setExcludeNums] = useState([]);
  const [excludeSpecialNums, setExcludeSpecialNums] = useState([]);
  const [oddEvenRatio, setOddEvenRatio] = useState('ALL'); // ALL, ODD, EVEN, MIX

  const toggleExclude = (num, isSpecial = false) => {
    if (isSpecial) {
      if (excludeSpecialNums.includes(num)) setExcludeSpecialNums(excludeSpecialNums.filter(n => n !== num));
      else setExcludeSpecialNums([...excludeSpecialNums, num]);
    } else {
      if (excludeNums.includes(num)) setExcludeNums(excludeNums.filter(n => n !== num));
      else setExcludeNums([...excludeNums, num]);
    }
  };

  const handleApply = () => {
    onApply({
      excludeNums,
      excludeSpecialNums,
      oddEvenRatio
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto pr-4 pb-12">
      <h3 className="text-2xl font-bold mb-6">自訂號碼篩選器</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h4 className="text-lg font-medium text-cyan-400 mb-4">{data.has_special ? "排除第一區特定號碼" : "排除特定號碼"} (點擊選擇)</h4>
          <div className="flex flex-wrap gap-2">
            {Array.from({length: data.max_num || 49}, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => toggleExclude(num, false)}
                className={clsx(
                  "w-10 h-10 rounded-full font-bold transition-all",
                  excludeNums.includes(num) 
                    ? "bg-red-500/20 text-red-500 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)] line-through"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                )}
              >
                {String(num).padStart(2, '0')}
              </button>
            ))}
          </div>

          {data.has_special && (
            <div className="mt-8">
              <h4 className="text-lg font-medium text-rose-400 mb-4">排除第二區特定號碼</h4>
              <div className="flex flex-wrap gap-2">
                {Array.from({length: data.special_max || 8}, (_, i) => i + 1).map(num => (
                  <button
                    key={`sp-${num}`}
                    onClick={() => toggleExclude(num, true)}
                    className={clsx(
                      "w-10 h-10 rounded-full font-bold transition-all",
                      excludeSpecialNums.includes(num) 
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.2)] line-through"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    )}
                  >
                    {String(num).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-lg font-medium text-cyan-400 mb-4">指定奇偶數比例</h4>
          <div className="flex flex-col gap-3">
             <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-700/80 transition">
              <input type="radio" name="ratio" checked={oddEvenRatio === 'ALL'} onChange={() => setOddEvenRatio('ALL')} className="w-5 h-5 accent-cyan-500" />
              <span>不限制 (推薦)</span>
             </label>
             <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-700/80 transition">
              <input type="radio" name="ratio" checked={oddEvenRatio === 'ODD'} onChange={() => setOddEvenRatio('ODD')} className="w-5 h-5 accent-cyan-500" />
              <span>偏重奇數 (奇數占 60% 以上)</span>
             </label>
             <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-700/80 transition">
              <input type="radio" name="ratio" checked={oddEvenRatio === 'EVEN'} onChange={() => setOddEvenRatio('EVEN')} className="w-5 h-5 accent-cyan-500" />
              <span>偏重偶數 (偶數占 60% 以上)</span>
             </label>
          </div>

          <div className="mt-8 flex justify-end">
            <button 
              onClick={handleApply}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-3 px-8 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:scale-105 active:scale-95 transition-all"
            >
              套用篩選並重新運算 ✨
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function HistoryTab({ gameId }) {
  const [historyDocs, setHistoryDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchMonth, setSearchMonth] = useState('');

  const fetchHistory = (month = '') => {
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/history/${gameId}?month=${month}`)
      .then(res => res.json())
      .then(d => {
        setHistoryDocs(d.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    // 進入時自動抓取最新歷史資料
    fetchHistory('');
  }, [gameId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto pr-4 pb-12 w-full">
       <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 bg-slate-800/60 p-6 rounded-2xl border border-cyan-500/30">
         <h3 className="text-xl font-bold text-cyan-400">📅 指定單月歷史查詢</h3>
         <div className="flex items-center gap-3">
           <input 
             type="month" 
             value={searchMonth} 
             onChange={e => setSearchMonth(e.target.value)} 
             className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-cyan-500 transition-colors" 
           />
           <button 
             onClick={() => fetchHistory(searchMonth)} 
             className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-6 py-2 rounded-lg font-bold transition-all shadow-lg active:scale-95"
           >
             查詢
           </button>
         </div>
       </div>

       {loading ? (
         <div className="flex justify-center items-center h-48">
           <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin"></div>
         </div>
       ) : historyDocs.length === 0 ? (
         <div className="text-center py-20 text-slate-500 font-medium bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">該月份查無開獎資料</div>
       ) : (
         <div className="grid grid-cols-1 gap-4">
           {historyDocs.map((doc, idx) => (
              <div key={idx} className="bg-slate-800/40 p-5 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/60 transition-colors">
                
                <div className="flex flex-col gap-1 w-full md:w-32">
                   <div className="text-cyan-400 font-black tracking-wider">{doc.period} 期</div>
                   <div className="text-slate-400 text-sm font-mono">{doc.date}</div>
                </div>
                
                <div className="flex-1 flex gap-2 flex-wrap items-center">
                   {doc.numbers.map(n => (
                     <span key={n} className="w-10 h-10 rounded-full bg-slate-700/80 flex items-center justify-center font-bold text-base shadow-inner border border-white/5">{String(n).padStart(2, '0')}</span>
                   ))}
                   {doc.special !== null && (
                     <span className="w-10 h-10 ml-2 rounded-full bg-gradient-to-b from-rose-500 to-rose-700 text-white border border-rose-400/50 flex items-center justify-center font-bold text-base shadow-[0_0_15px_rgba(225,29,72,0.4)]">
                       {String(doc.special).padStart(2, '0')}
                     </span>
                   )}
                </div>

                <div className="w-full md:w-auto flex justify-start md:justify-end mt-2 md:mt-0">
                   {doc.oddCount > doc.evenCount ? (
                     <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">奇數偏多 ({doc.oddCount}:{doc.evenCount})</span>
                   ) : doc.evenCount > doc.oddCount ? (
                     <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">偶數偏多 ({doc.oddCount}:{doc.evenCount})</span>
                   ) : (
                     <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-slate-700 text-slate-300 border border-slate-500/50">奇偶均衡 ({doc.oddCount}:{doc.evenCount})</span>
                   )}
                </div>
              </div>
           ))}
         </div>
       )}
    </motion.div>
  );
}
