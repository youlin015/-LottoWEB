import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* 背景光暈 */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-8 relative z-10">
            <div className="text-4xl mb-3">🎯</div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              台灣彩券 AI 情報室
            </h2>
            <p className="text-slate-400 text-sm mt-1">登入以儲存你的 AI 推薦紀錄</p>
          </div>

          {/* Tab Switch */}
          <div className="flex bg-slate-900/60 rounded-xl p-1 mb-8 relative z-10">
            {['login', 'register'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  tab === t
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'login' ? '登入' : '註冊帳號'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {tab === 'login' ? (
                <LoginForm key="login" onSuccess={() => navigate('/')} />
              ) : (
                <RegisterForm key="register" onSuccess={() => navigate('/')} />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* back link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            ← 返回大廳（不登入繼續使用）
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function LoginForm({ onSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <InputField
        id="login-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="your@email.com"
        required
      />
      <InputField
        id="login-password"
        label="密碼"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        required
      />

      {error && <ErrorMsg msg={error} />}

      <SubmitButton loading={loading} label="登入" />
    </motion.form>
  );
}

function RegisterForm({ onSuccess }) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }
    if (password.length < 6) {
      setError('密碼至少需要 6 個字元');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(email, password, displayName);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <InputField
        id="reg-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="your@email.com"
        required
      />
      <InputField
        id="reg-name"
        label="顯示名稱（選填）"
        type="text"
        value={displayName}
        onChange={setDisplayName}
        placeholder="你的暱稱"
      />
      <InputField
        id="reg-password"
        label="密碼（至少 6 字元）"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        required
      />
      <InputField
        id="reg-confirm"
        label="確認密碼"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        placeholder="••••••••"
        required
      />

      {error && <ErrorMsg msg={error} />}

      <SubmitButton loading={loading} label="建立帳號" />
    </motion.form>
  );
}

function InputField({ id, label, type, value, onChange, placeholder, required }) {
  return (
    <div>
      <label htmlFor={id} className="block text-slate-300 text-sm font-medium mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-slate-900/80 border border-slate-700 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder-slate-600"
      />
    </div>
  );
}

function ErrorMsg({ msg }) {
  return (
    <div className="bg-rose-900/30 border border-rose-500/40 text-rose-300 text-sm px-4 py-3 rounded-xl">
      ⚠️ {msg}
    </div>
  );
}

function SubmitButton({ loading, label }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-2 w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          處理中...
        </span>
      ) : (
        label
      )}
    </button>
  );
}
