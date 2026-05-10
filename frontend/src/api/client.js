import axios from 'axios';

// ── URL resolution ─────────────────────────────────────────────────────────────
// ELECTRON COMPATIBILITY: Never rely on window.location.hostname for env
// detection — Electron renders from file:// so hostname is an empty string.
//
// Resolution priority:
//   1. VITE_API_URL env var (Vite dev server, Docker, Electron packaged build)
//   2. window.__ELECTRON_API_URL__  (injected by Electron main process via preload)
//   3. file:// protocol  → assume Electron pointing to cloud backend
//   4. localhost / 127.0.0.1 → local dev backend
//   5. anything else → production Railway backend

const BACKEND_PROD_URL = 'https://food-soft-production.up.railway.app/api/v1';
const DEFAULT_DEV_URL  = 'http://localhost:8000/api/v1';

function resolveApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    if (window.__ELECTRON_API_URL__) return window.__ELECTRON_API_URL__;
    if (window.location.protocol === 'file:') return BACKEND_PROD_URL;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') return DEFAULT_DEV_URL;
  }
  return BACKEND_PROD_URL;
}

export const API_URL = resolveApiUrl();

/**
 * Build a WebSocket URL from the REST API base URL.
 * Works in browser (http/https → ws/wss) and Electron (file:// → wss://).
 */
export function buildWsUrl(path) {
  const base = API_URL.replace(/\/api\/v1\/?$/, '');
  const wsBase = base.startsWith('https')
    ? base.replace(/^https/, 'wss')
    : base.startsWith('http')
      ? base.replace(/^http/, 'ws')
      : `wss://${base.replace(/^file:\/\//, '')}`;
  return `${wsBase}${path}`;
}

// ── Axios instance ─────────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Inject token + active org on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const orgId = localStorage.getItem('organizationId');
  if (token  && config.headers) config.headers.Authorization = `Bearer ${token}`;
  if (orgId  && config.headers) config.headers['X-Organization-ID'] = orgId;
  return config;
}, (error) => Promise.reject(error));

// ── Token refresh + redirect ───────────────────────────────────────────────────
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
  if (data.refresh_token)    localStorage.setItem('refresh_token', data.refresh_token);
  if (data.role != null)     localStorage.setItem('role', data.role);
  if (data.full_name != null) localStorage.setItem('userName', data.full_name);
  if (data.organization_id != null)
    localStorage.setItem('organizationId', String(data.organization_id));
  return data.access_token;
}

/**
 * Redirect to /login in a way that works both in the browser and in Electron.
 * In Electron (file:// protocol) we cannot use window.location.href = '/login'
 * because there is no web server to resolve relative paths.
 * Instead we dispatch a custom event that the React router can listen to.
 */
function redirectToLogin() {
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'file:') {
      // Electron: dispatch event so the React app can navigate programmatically
      window.dispatchEvent(new CustomEvent('omnikook:session-expired'));
    } else {
      window.location.href = '/login';
    }
  }
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
          refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
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
        redirectToLogin();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
