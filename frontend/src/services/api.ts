import axios from 'axios';
import { getToken, isLoggedIn, logoutAndReload } from '../utils/auth';

const rawBase = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:5252').replace(/\/+$, '');
const BASE_URL = `${rawBase}/api`;

export const publicApi = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

export const adminApi = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});
adminApi.interceptors.request.use((config) => {
  const t = getToken();
  if (t) (config.headers ||= {}).Authorization = `Bearer ${t}`;
  return config;
});
adminApi.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 401 && window.location.pathname !== '/login') {
      logoutAndReload('/login');
    }
    return Promise.reject(err);
  }
);

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token && isLoggedIn()) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      logoutAndReload('/login');
    }
    return Promise.reject(err);
  }
);

export default api;
