import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Automatically attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('fw_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token has expired, clear it and send the user back to login.
// Login/register failures are excluded so their error messages still show.
api.interceptors.response.use(
  res => res,
  err => {
    const url = err.config?.url || '';
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/register');
    if (err.response?.status === 401 && !isAuthCall && localStorage.getItem('fw_token')) {
      localStorage.removeItem('fw_token');
      window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export default api;