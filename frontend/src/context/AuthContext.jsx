import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const saveSession = (payload) => {
    localStorage.setItem('token', payload.token);
    localStorage.setItem('user', JSON.stringify(payload.user));
    setToken(payload.token);
    setUser(payload.user);
  };

  const login = async (data) => {
    const response = await api.post('/auth/login', data);
    saveSession(response.data);
  };

  const register = async (data) => {
    const response = await api.post('/auth/register', data);
    saveSession(response.data);
  };

  const clearSession = ({ keepNotice = false } = {}) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!keepNotice) {
      localStorage.removeItem('authNotice');
    }
    setToken(null);
    setUser(null);
  };

  const logout = async ({ revoke = false } = {}) => {
    if (revoke && localStorage.getItem('token')) {
      try {
        await api.delete('/sessions/current', { skipAuthLogout: true });
      } catch {
        // Local logout should still work even if backend is temporarily unavailable.
      }
    }
    clearSession();
  };

  useEffect(() => {
    const resetAuth = () => clearSession({ keepNotice: true });
    window.addEventListener('auth:unauthorized', resetAuth);
    return () => window.removeEventListener('auth:unauthorized', resetAuth);
  }, []);

  const value = useMemo(() => ({ token, user, setUser, login, register, logout }), [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
