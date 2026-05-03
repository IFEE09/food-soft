import axios from 'axios';

// Detect if we are running in a production environment (non-localhost)
const isProduction = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');

// El backend está en un servicio distinto de Railway
const BACKEND_PROD_URL = 'https://food-soft-production.up.railway.app/api/v1';
const DEFAULT_DEV_URL = 'http://localhost:8000/api/v1';

const API_URL = import.meta.env.VITE_API_URL || (isProduction ? BACKEND_PROD_URL : DEFAULT_DEV_URL);

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject token if we have one
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

/** POST sin este interceptor (evita bucle en refresh). */
let refreshPromise = null;

async function refreshAccessToken() {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return null;
  const { data } = await axios.post(
    `${API_URL}/auth/refresh`,
    { refresh_token: refresh },
    { headers: { 'Content-Type': 'application/json' } },
  );
  localStorage.setItem('token', data.access_token);
  if (data.refresh_token) {
    localStorage.setItem('refresh_token', data.refresh_token);
  }
  if (data.role != null) localStorage.setItem('role', data.role);
  if (data.full_name != null) localStorage.setItem('userName', data.full_name);
  if (data.organization_id != null) {
    localStorage.setItem('organizationId', String(data.organization_id));
  }
  return data.access_token;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url = original?.url || '';
    if (
      error.response?.status === 401
      && !original?._retry
      && !url.includes('/auth/login')
      && !url.includes('/auth/refresh')
      && localStorage.getItem('refresh_token')
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newAccess = await refreshPromise;
        if (!newAccess) return Promise.reject(error);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(original);
      } catch (_) {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('role');
        localStorage.removeItem('organizationId');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
