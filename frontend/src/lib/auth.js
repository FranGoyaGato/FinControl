import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = 'auth_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Global axios interceptors: attach Bearer + auto-logout on 401
axios.interceptors.request.use((config) => {
  const t = getToken();
  if (t) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

axios.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401 && getToken()) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email, password) =>
    axios.post(`${API}/auth/login`, { email, password }).then((r) => r.data),
  me: () => axios.get(`${API}/auth/me`).then((r) => r.data),
  logout: () => axios.post(`${API}/auth/logout`).catch(() => null),
  changePassword: (current_password, new_password) =>
    axios.post(`${API}/auth/change-password`, { current_password, new_password }).then((r) => r.data),
};
