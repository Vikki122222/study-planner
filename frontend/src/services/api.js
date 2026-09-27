import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
    const isPasswordChange = url.includes('/profile/password');
    if (error.response?.status === 401 && !isAuthEndpoint && !isPasswordChange && !error.config?.skipAuthLogout) {
      const message = error.response?.data?.error || 'Сессия завершена. Войдите снова.';
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.setItem('authNotice', message);
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: message }));
    }
    return Promise.reject(error);
  }
);

export const normalizeId = (item) => ({
  ...item,
  id: item.id || item._id,
});
