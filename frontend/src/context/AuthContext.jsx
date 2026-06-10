import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // 應用啟動時從 localStorage 恢復登入狀態
  useEffect(() => {
    const savedToken = localStorage.getItem('lottoweb_token');
    const savedUser = localStorage.getItem('lottoweb_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('lottoweb_token');
        localStorage.removeItem('lottoweb_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error('登入嘗試過於頻繁，請稍後再試（每分鐘最多 5 次）');
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '登入失敗，請稍後再試');
    }
    const data = await res.json();
    _persist(data);
    return data;
  };

  const register = async (email, password, display_name) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error('註冊嘗試過於頻繁，請稍後再試（每分鐘最多 5 次）');
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '註冊失敗，請稍後再試');
    }
    const data = await res.json();
    _persist(data);
    return data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('lottoweb_token');
    localStorage.removeItem('lottoweb_user');
  };

  /** 帶 Authorization header 的 fetch wrapper */
  const authFetch = (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}${path}`, { ...options, headers });
  };

  const _persist = (data) => {
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('lottoweb_token', data.access_token);
    localStorage.setItem('lottoweb_user', JSON.stringify(data.user));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
