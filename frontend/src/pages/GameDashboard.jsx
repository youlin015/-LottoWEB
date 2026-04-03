import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import clsx from 'clsx';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import zhTW from 'date-fns/locale/zh-TW';
registerLocale('zh-TW', zhTW);

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const TABS = [
  { id: 'stats', label: '📊 數據統計圖表' },
  { id: 'ai', label: '🔮 AI 推薦號碼' },
  { id: 'filter', label: '🎯 自訂號碼篩選器' },
  { id: 'history', label: '📅 歷史中獎查詢' },
  { id: 'duplicate_check', label: '🔍 歷史重複號碼檢驗' },
  { id: 'pattern', label: '📈 大數據拖牌預測' }
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
  const [apiError, setApiError] = useState(false);
  // 顯示載入狀態提示文字（例如：喚醒後端中...）
  const [loadingStatus, setLoadingStatus] = useState('連線後端伺服器中...');

  const [limit, setLimit] = useState(100);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  const parseStrDate = (str) => {
    if (!str) return null;
    const [y, m] = str.split('-');
    return new Date(y, m - 1);
  };
  const formatStrDate = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const fetchData = (filters = null, overrides = {}) => {
    setLoading(true);
    const effectiveLimit = overrides.limit ?? limit;
    const effectiveStart = overrides.startMonth ?? startMonth;
    const effectiveEnd = overrides.endMonth ?? endMonth;

    let url = `${API_BASE}/api/ai_recommend/${gameId}`;

    const params = new URLSearchParams();

    // Global filters
    params.append('limit', effectiveLimit);
    if(effectiveStart) params.append('start_month', effectiveStart);
    if(effectiveEnd) params.append('end_month', effectiveEnd);

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
        setApiError(false);
        setLoading(false);
        if(filters) setActiveTab('ai'); // Switch to AI tab after filtering
      })
      .catch(err => {
        console.error("API error, using mock data.", err);
        setApiError(true);
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
    setData(null);
    setActiveTab('stats');
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

      {/* 歷史數據全局分析範圍面板 (僅在數據、AI、篩選三大頁籤顯示以節省空間) */}
      <AnimatePresence>
        {['stats', 'ai', 'filter'].includes(activeTab) && (
          <motion.div 
            initial={{ height: 0, opacity: 0, marginBottom: 0 }} 
            animate={{ height: 'auto', opacity: 1, marginBottom: 24 }} 
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-800/60 border border-cyan-500/30 rounded-2xl p-4 md:p-6 flex flex-col xl:flex-row gap-6 xl:items-end">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-slate-400 text-sm mb-2 font-medium">擷取最大期數</label>
                  <div className="flex gap-2">
                    {[50, 100, 200].map(val => (
                      <button
                        key={val}
                        onClick={() => { setLimit(val); fetchData(null, { limit: val }); }}
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
                  <DatePicker
                    locale="zh-TW"
                    selected={parseStrDate(startMonth)}
                    onChange={(date) => { const v = formatStrDate(date); setStartMonth(v); fetchData(null, { startMonth: v }); }}
                    dateFormat="yyyy-MM" showMonthYearPicker placeholderText="選擇年份及月份"
                    className="w-full xl:w-40 bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2 font-medium">結束月份 (選填)</label>
                  <DatePicker
                    locale="zh-TW"
                    selected={parseStrDate(endMonth)}
                    onChange={(date) => { const v = formatStrDate(date); setEndMonth(v); fetchData(null, { endMonth: v }); }}
                    dateFormat="yyyy-MM" showMonthYearPicker placeholderText="選擇年份及月份"
                    className="w-full xl:w-40 bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* API 錯誤警告：後端連線失敗，顯示模擬數據 */}
      {apiError && (
        <div className="mb-4 px-4 py-3 bg-amber-900/40 border border-amber-500/50 rounded-xl text-amber-300 text-sm flex items-center gap-3">
          <span className="text-lg shrink-0">⚠️</span>
          <span>後端伺服器連線失敗，以下數據為<strong className="text-amber-200">模擬數據</strong>，僅供介面展示，請勿作為投注參考。</span>
        </div>
      )}

      {/* Tab Content Area */}
      <div className="flex-1 bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 min-h-[50vh] relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'stats' && data && <StatsTab key="stats" data={data} />}
            {activeTab === 'ai' && data && <AITab key="ai" data={data} onRefresh={() => fetchData(null)} gameId={gameId} />}
            {activeTab === 'filter' && data && <FilterTab key={`filter-${gameId}`} data={data} onApply={fetchData} />}
            {activeTab === 'history' && <HistoryTab key="history" gameId={gameId} />}
            {activeTab === 'duplicate_check' && <DuplicateCheckTab key="duplicate_check" gameId={gameId} data={data} />}
            {activeTab === 'pattern' && <PatternTab key="pattern" gameId={gameId} />}
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

function AITab({ data, onRefresh, gameId }) {
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  // 換組推薦後重置比對結果
  useEffect(() => {
    setCheckResult(null);
  }, [data.recommendation]);

  const mainNums = data.has_special ? data.recommendation.slice(0, -1) : data.recommendation;
  const specialNum = data.has_special ? data.recommendation[data.recommendation.length - 1] : null;

  const handleCheck = () => {
    setChecking(true);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const params = new URLSearchParams();
    params.append('nums', mainNums.join(','));
    if (specialNum !== null) params.append('special', specialNum);
    params.append('start_month', '2010-01');
    params.append('end_month', currentMonth);
    fetch(`${API_BASE}/api/check_duplicate/${gameId}?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setCheckResult({ matches: d.matches || [], total_checked: d.total_checked || 0 });
        setChecking(false);
      })
      .catch(() => {
        setCheckResult({ error: true });
        setChecking(false);
      });
  };

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

        {/* 歷史比對區塊 */}
        <div className="mt-6 w-full text-left">
          {!checkResult && !checking && (
            <button
              onClick={handleCheck}
              className="w-full py-3 bg-slate-700/60 hover:bg-slate-600/80 text-slate-200 font-bold rounded-xl transition-all active:scale-95 border border-slate-600 text-sm"
            >
              📅 查詢此組號碼是否曾在歷史中完全開出（2010-01 至今）
            </button>
          )}

          {checking && (
            <div className="flex items-center justify-center gap-3 py-4 text-slate-400">
              <div className="w-5 h-5 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin" />
              <span className="text-sm">正在比對 2010-01 至今的歷史紀錄...</span>
            </div>
          )}

          {checkResult && !checkResult.error && (
            <div className="bg-slate-900/80 rounded-2xl border border-slate-600/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={clsx("text-3xl font-black", checkResult.matches.length > 0 ? 'text-green-400' : 'text-rose-400')}>
                    {checkResult.matches.length}
                  </span>
                  <div>
                    <div className="text-white font-bold text-sm">次完整吻合</div>
                    <div className="text-slate-400 text-xs">共比對 {checkResult.total_checked} 期歷史紀錄（2010-01 至今）</div>
                  </div>
                </div>
                <button onClick={() => setCheckResult(null)} className="text-slate-500 hover:text-slate-300 text-sm transition-colors px-2">✕</button>
              </div>

              {checkResult.matches.length === 0 ? (
                <div className="px-6 py-6 text-center">
                  <div className="text-2xl mb-2">🏆</div>
                  <p className="text-slate-300 font-bold text-sm">史無前例的組合！</p>
                  <p className="text-slate-500 text-xs mt-1">這組號碼從未在歷史中完整出現過。</p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-700/50">
                  {checkResult.matches.map((m, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-4">
                      <span className="text-cyan-400 font-bold text-sm w-16 shrink-0">{m.period} 期</span>
                      <span className="text-slate-400 text-xs w-24 shrink-0">{m.date}</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {m.numbers.map(n => (
                          <span key={n} className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs">{String(n).padStart(2, '0')}</span>
                        ))}
                        {m.special !== null && (
                          <span className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/50 flex items-center justify-center font-bold text-xs ml-1">{String(m.special).padStart(2, '0')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {checkResult?.error && (
            <p className="text-amber-400 text-sm text-center py-3">⚠️ 查詢失敗，請確認後端服務是否正常。</p>
          )}
        </div>

        <button
          onClick={onRefresh}
          className="mt-4 px-8 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl transition-all active:scale-95 border border-slate-600"
        >
          🔄 重新推薦
        </button>
      </div>
    </motion.div>
  );
}

function FilterTab({ data, onApply }) {
  const [excludeNums, setExcludeNums] = useState([]);
  const [excludeSpecialNums, setExcludeSpecialNums] = useState([]);
  const [oddEvenRatio, setOddEvenRatio] = useState('ALL'); // ALL, ODD, EVEN, MIX
  const [validationError, setValidationError] = useState('');

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
    const needed = data.max_num === 39 ? 5 : 6;
    if ((data.max_num || 49) - excludeNums.length < needed) {
      setValidationError(`排除號碼過多，至少需保留 ${needed} 顆可選號碼（目前剩 ${(data.max_num || 49) - excludeNums.length} 顆）`);
      return;
    }
    setValidationError('');
    onApply({ excludeNums, excludeSpecialNums, oddEvenRatio });
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

          <div className="mt-8 flex flex-col items-end gap-2">
            {validationError && (
              <p className="text-rose-400 text-sm font-medium">{validationError}</p>
            )}
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
  const [error, setError] = useState(false);
  const [searchStart, setSearchStart] = useState('');
  const [searchEnd, setSearchEnd] = useState('');

  const parseStrDate = (str) => {
    if (!str) return null;
    const [y, m] = str.split('-');
    return new Date(y, m - 1);
  };
  const formatStrDate = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const fetchHistory = (start = '', end = '') => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (start) params.append('start_month', start);
    if (end) params.append('end_month', end);
    fetch(`${API_BASE}/api/history/${gameId}?${params.toString()}`)
      .then(res => res.json())
      .then(d => {
        setHistoryDocs(d.data || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchHistory('', '');
  }, [gameId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto pr-4 pb-12 w-full">
       <div className="flex flex-col gap-4 mb-8 bg-slate-800/60 p-6 rounded-2xl border border-cyan-500/30">
         <h3 className="text-xl font-bold text-cyan-400">📅 歷史開獎區間查詢</h3>
         <div className="flex flex-col sm:flex-row items-end gap-3">
           <div className="flex-1">
             <label className="text-slate-400 text-xs mb-1 block font-medium">開始月份（選填）</label>
             <DatePicker
               locale="zh-TW"
               selected={parseStrDate(searchStart)}
               onChange={(date) => setSearchStart(formatStrDate(date))}
               dateFormat="yyyy-MM" showMonthYearPicker placeholderText="不限（最早期）"
               className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-cyan-500 transition-colors text-white text-sm"
             />
           </div>
           <div className="text-slate-500 font-bold pb-2 hidden sm:block">—</div>
           <div className="flex-1">
             <label className="text-slate-400 text-xs mb-1 block font-medium">結束月份（選填）</label>
             <DatePicker
               locale="zh-TW"
               selected={parseStrDate(searchEnd)}
               onChange={(date) => setSearchEnd(formatStrDate(date))}
               dateFormat="yyyy-MM" showMonthYearPicker placeholderText="不限（最新期）"
               className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-cyan-500 transition-colors text-white text-sm"
             />
           </div>
           <button
             onClick={() => fetchHistory(searchStart, searchEnd)}
             className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-6 py-2 rounded-lg font-bold transition-all shadow-lg active:scale-95 whitespace-nowrap"
           >
             查詢
           </button>
         </div>
       </div>

       {loading ? (
         <div className="flex justify-center items-center h-48">
           <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin"></div>
         </div>
       ) : error ? (
         <div className="text-center py-20 text-amber-400 font-medium bg-amber-900/20 rounded-2xl border border-dashed border-amber-700">
           <div className="text-3xl mb-3">⚠️</div>
           無法連線後端伺服器，請確認服務是否正常後再試一次。
         </div>
       ) : historyDocs.length === 0 ? (
         <div className="text-center py-20 text-slate-500 font-medium bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">指定區間查無開獎資料</div>
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

function DuplicateCheckTab({ gameId, data }) {
  const [selectedNums, setSelectedNums] = useState([]);
  const [selectedSpecial, setSelectedSpecial] = useState(null);
  const [limitWarning, setLimitWarning] = useState(false);
  const [startMonth, setStartMonth] = useState('2010-01');
  const [endMonth, setEndMonth] = useState('');
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(false);
  const [totalChecked, setTotalChecked] = useState(0);

  const parseStrDate = (str) => {
    if (!str) return null;
    const [y, m] = str.split('-');
    return new Date(y, m - 1);
  };
  const formatStrDate = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const handleSearch = () => {
    if (selectedNums.length === 0 && !selectedSpecial) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedNums.length > 0) params.append('nums', selectedNums.join(','));
    if (selectedSpecial) params.append('special', selectedSpecial);
    if (startMonth) params.append('start_month', startMonth);
    if (endMonth) params.append('end_month', endMonth);

    fetch(`${API_BASE}/api/check_duplicate/${gameId}?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setMatches(d.matches || []);
        setTotalChecked(d.total_checked || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const maxAllowed = data.max_num === 39 ? 5 : 6;

  const toggleNum = (n, isSpecial = false) => {
    if (isSpecial) {
      if (selectedSpecial === n) setSelectedSpecial(null);
      else setSelectedSpecial(n);
    } else {
      if (selectedNums.includes(n)) {
        setSelectedNums(selectedNums.filter(x => x !== n));
      } else if (selectedNums.length < maxAllowed) {
        setSelectedNums([...selectedNums, n].sort((a,b)=>a-b));
      } else {
        setLimitWarning(true);
        setTimeout(() => setLimitWarning(false), 2000);
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto pr-4 pb-12 w-full">
      <div className="flex flex-col md:flex-row gap-8">
        {/* 左側：控制面板 */}
        <div className="flex-1">
           <h3 className="text-2xl font-bold mb-6">🔍 驗證號碼是否曾開出</h3>
           <div className="bg-slate-800/60 p-6 rounded-2xl border border-cyan-500/30 mb-6">
             <h4 className="text-cyan-400 font-bold mb-4">分析資料區間</h4>
             <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-slate-400 text-sm mb-1 block">開始月份</label>
                  <DatePicker 
                    locale="zh-TW"
                    selected={parseStrDate(startMonth)}
                    onChange={(date) => setStartMonth(formatStrDate(date))}
                    dateFormat="yyyy-MM" showMonthYearPicker placeholderText="選擇年份及月份"
                    className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg font-mono outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-slate-400 text-sm mb-1 block">結束月份</label>
                  <DatePicker 
                    locale="zh-TW"
                    selected={parseStrDate(endMonth)}
                    onChange={(date) => setEndMonth(formatStrDate(date))}
                    dateFormat="yyyy-MM" showMonthYearPicker placeholderText="選擇年份及月份"
                    className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg font-mono outline-none focus:border-cyan-500"
                  />
                </div>
             </div>
           </div>
           
           <div className="mb-6">
             <div className="flex justify-between items-center mb-4">
               <h4 className="font-bold text-lg">選擇您的第一區號碼</h4>
               <div className="flex items-center gap-3">
                 {limitWarning && (
                   <span className="text-rose-400 text-xs font-bold animate-pulse">已達上限 {maxAllowed} 顆</span>
                 )}
                 <span className="text-cyan-400 text-sm font-bold">已選 {selectedNums.length} / {maxAllowed}</span>
               </div>
             </div>
             <div className="grid grid-cols-7 sm:grid-cols-10 gap-2">
                {Array.from({length: data.max_num || 49}, (_, i) => i+1).map(n => (
                   <button 
                     key={n} 
                     onClick={() => toggleNum(n)}
                     className={`w-10 h-10 rounded-full font-bold text-sm transition-all shadow-md active:scale-90 ${selectedNums.includes(n) ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                   >
                     {String(n).padStart(2, '0')}
                   </button>
                ))}
             </div>
           </div>

           {data.has_special && (
             <div className="mb-8 p-4 bg-rose-950/30 border border-rose-500/30 rounded-xl">
               <div className="flex justify-between items-center mb-4">
                 <h4 className="font-bold text-rose-400 text-lg">專屬第二區號碼</h4>
                 <span className="text-rose-400 text-sm font-bold">{selectedSpecial ? '已選 1 顆' : '未選擇'}</span>
               </div>
               <div className="flex gap-2 flex-wrap">
                  {Array.from({length: data.special_max || 8}, (_, i) => i+1).map(n => (
                     <button 
                       key={n} 
                       onClick={() => toggleNum(n, true)}
                       className={`w-10 h-10 rounded-full font-bold text-sm transition-all shadow-md active:scale-90 ${selectedSpecial === n ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.6)]' : 'bg-slate-800 text-rose-500/50 hover:bg-slate-700'}`}
                     >
                       {String(n).padStart(2, '0')}
                     </button>
                  ))}
               </div>
             </div>
           )}

           <button onClick={handleSearch} disabled={selectedNums.length === 0 && !selectedSpecial} className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(8,145,178,0.5)] transition-all active:scale-95">送出歷史比對驗證</button>
        </div>

        {/* 右側：比對結果 */}
        <div className="flex-1 md:max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 h-full flex flex-col items-center justify-start min-h-[400px]">
           {loading ? (
             <div className="m-auto flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin mb-4" />
                <span className="text-slate-400 font-bold animate-pulse">正在穿梭時空比對萬筆資料...</span>
             </div>
           ) : matches !== null ? (
             <div className="w-full">
                <div className="text-center mb-6 border-b border-slate-700 pb-6">
                   <div className="text-5xl font-black mb-2 flex items-center justify-center gap-2">
                     <span className={matches.length > 0 ? 'text-green-400' : 'text-rose-500'}>{matches.length}</span>
                     <span className="text-xl text-slate-400">次中獎</span>
                   </div>
                   <div className="text-slate-400 text-sm">於 {totalChecked} 期歷史紀錄中進行號碼吻合檢測的結果</div>
                </div>

                {matches.length > 0 ? (
                  <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                     {matches.map((m, i) => (
                       <div key={i} className="bg-slate-800 p-4 rounded-xl border border-white/5">
                          <div className="flex justify-between items-center mb-3">
                             <div className="text-cyan-400 font-bold">{m.period}期</div>
                             <div className="text-slate-400 text-sm">{m.date}</div>
                          </div>
                          <div className="flex items-center flex-wrap gap-1">
                             {m.numbers.map(n => (
                               <span key={n} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm text-white shadow-inner">{String(n).padStart(2, '0')}</span>
                             ))}
                             {m.special !== null && (
                               <span className="w-8 h-8 rounded-full ml-1 bg-rose-500/20 text-rose-400 border border-rose-500/50 flex items-center justify-center font-bold text-sm">{String(m.special).padStart(2, '0')}</span>
                             )}
                          </div>
                       </div>
                     ))}
                  </div>
                ) : (
                  <div className="text-center py-10 opacity-60">
                     <div className="text-4xl mb-4">🏆</div>
                     <h4 className="text-lg text-white font-bold mb-2">這組號碼史無前例！</h4>
                     <p className="text-sm text-slate-400">這是一組從您選擇的年代至今，從來沒有完美吻合過的傳說級稀有組合。</p>
                  </div>
                )}
             </div>
           ) : (
             <div className="m-auto text-center opacity-50">
                <div className="text-4xl mb-4">💡</div>
                <h4 className="text-lg text-white font-bold mb-2">等待檢驗輸入號碼</h4>
                <p className="text-sm text-slate-400 w-3/4 mx-auto">請在左側點選您預測的中獎號碼，按下送出後即可立刻檢視這組號碼在歷史中是否曾出現過相同的軌跡。</p>
             </div>
           )}
        </div>
      </div>
    </motion.div>
  );
}

function PatternTab({ gameId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`${API_BASE}/api/pattern_analysis/${gameId}?limit=${limit}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [gameId, limit]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto pr-4 pb-12 w-full">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/40 p-6 rounded-2xl border border-white/5">
         <div>
           <h3 className="text-2xl font-bold mb-2 text-cyan-400">📈 近期熱門拖牌與規律預測</h3>
           <p className="text-slate-400 text-sm">動態掃描您指定的近期範圍開獎紀錄，找出正在處於「火熱狀態」的連續性特殊規律。<br/>（過濾掉雜訊，僅顯示近期內關聯命中率大於 <strong className="text-white">50%</strong> 以上的參考指標）。</p>
         </div>
         <div className="flex gap-2 flex-wrap">
           {[30, 50, 100, 200].map(val => (
             <button
               key={val}
               onClick={() => setLimit(val)}
               className={clsx(
                 "px-4 py-2 rounded-lg text-sm font-bold transition-all border",
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
      
      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 gap-4">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin"></div>
          <div className="text-slate-400 font-bold animate-pulse text-lg">正在深度運算近 {limit} 期歷史拖牌指引...</div>
        </div>
      ) : error ? (
        <div className="text-center py-20 text-amber-400 font-medium bg-amber-900/20 rounded-3xl border border-dashed border-amber-700">
          <div className="text-4xl mb-4">⚠️</div>
          無法連線後端伺服器，請確認服務是否正常後再試一次。
        </div>
      ) : !data || !data.patterns || data.patterns.length === 0 ? (
        <div className="text-center py-20 text-slate-500 font-medium bg-slate-800/60 rounded-3xl border border-dashed border-slate-600">
           <div className="text-4xl mb-4">🔎</div>
           在此區間內查無發生至少 2 次以上且命中率過半的短期強規律。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.patterns.map((p, i) => (
             <div key={i} className="bg-slate-800/60 p-6 rounded-2xl border border-white/10 hover:border-cyan-500/50 hover:bg-slate-800/90 transition-all relative overflow-hidden group">
                <div className={`absolute top-0 right-0 ${p.probability === 100 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : p.probability >= 80 ? 'bg-gradient-to-r from-rose-500 to-pink-600' : 'bg-gradient-to-r from-blue-600 to-cyan-500'} text-white font-black px-4 py-1.5 rounded-bl-xl shadow-lg z-10 text-sm drop-shadow-md`}>
                   命中機率 {p.probability}%
                </div>
                
                <div className="flex items-center justify-between mb-6 mt-4 px-2">
                   <div className="flex flex-col items-center">
                     <span className="text-xs text-slate-400 mb-2 font-medium">觸發號碼 (當開出)</span>
                     <span className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center font-black text-2xl text-white shadow-[inset_0_4px_6px_rgba(0,0,0,0.4)] border border-slate-600">{String(p.trigger).padStart(2, '0')}</span>
                   </div>
                   
                   <div className="flex-1 flex flex-col items-center justify-center px-2">
                     <span className="text-xs font-bold px-3 py-1.5 bg-slate-900/80 rounded-full border border-slate-600/50 whitespace-nowrap mb-1">
                       {p.interval === 1 ? '➡ 下期即開 ➡' : `➡ 隔 ${p.interval-1} 期開 ➡`}
                     </span>
                     <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
                   </div>

                   <div className="flex flex-col items-center">
                     <span className="text-xs text-slate-400 mb-2 font-medium">高機率跟隨號碼</span>
                     <span className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-black text-2xl text-white shadow-[0_0_20px_rgba(6,182,212,0.6)] border border-cyan-300">
                       {String(p.target).padStart(2, '0')}
                     </span>
                   </div>
                </div>

                <div className="bg-slate-900/80 p-4 rounded-xl border border-white/5 text-sm text-slate-300 leading-relaxed shadow-inner">
                  在近 <strong>{data.analyzed_draws}</strong> 期的歷史中，當開出 {p.trigger} 之後，有 <strong className="text-white text-base">{p.appearances}</strong> 次滿足指定期數。其中高達 <strong className={p.probability === 100 ? 'text-yellow-400 text-lg' : 'text-cyan-400 text-lg'}>{p.hits}</strong> 次如期開出了 <strong>{p.target}</strong>！
                </div>
             </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
