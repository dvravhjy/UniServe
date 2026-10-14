import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api') });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('uniserve_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Expired / invalid session: clear and send to login
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('uniserve_token');
      localStorage.removeItem('uniserve_user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errorMessage = (err) => {
  const d = err.response?.data;
  if (d?.details?.length) return d.details.map((x) => x.message).join('. ');
  return d?.error || err.message || 'Something went wrong';
};

export default api;
