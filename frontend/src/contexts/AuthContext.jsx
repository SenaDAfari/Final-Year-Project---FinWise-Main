import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app load, check if a token exists and fetch the user
  useEffect(() => {
    const token = localStorage.getItem('fw_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => localStorage.removeItem('fw_token'))
      .finally(() => setLoading(false));
  }, []);

  // Fetches the full, authoritative user object from the backend and
  // stores it. Use this after ANY action that might change fields on the
  // user (login, register, onboarding finish, settings save) instead of
  // trusting a partial response or hand-merging fields client-side —
  // that pattern is what caused the stale-user bug (blank Settings /
  // wrong default categories until a hard refresh).
  const refreshUser = async () => {
    const res = await api.get('/auth/me');
    setUser(res.data);
    return res.data;
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('fw_token', res.data.token);
    try {
      // Prefer the full /auth/me payload over the login response's
      // (possibly partial) user object.
      const fullUser = await refreshUser();
      return fullUser;
    } catch {
      // Login itself succeeded — don't fail the whole flow over a
      // transient GET failure. Fall back to what /auth/login gave us.
      setUser(res.data.user);
      return res.data.user;
    }
  };

  const register = async (full_name, email, university, password) => {
    const res = await api.post('/auth/register', { full_name, email, university, password });
    localStorage.setItem('fw_token', res.data.token);
    try {
      const fullUser = await refreshUser();
      return fullUser;
    } catch {
      setUser(res.data.user);
      return res.data.user;
    }
  };

  const logout = () => {
    localStorage.removeItem('fw_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};