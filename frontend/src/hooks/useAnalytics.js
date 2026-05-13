/**
 * useAnalytics — Hook ligero de analítica para Omnikook.
 *
 * Estrategia:
 *  1. Si window.gtag existe (GA4 inyectado en index.html), usa gtag().
 *  2. Si no, registra los eventos en la consola en desarrollo para
 *     facilitar la depuración sin requerir una cuenta de GA4 activa.
 *
 * Para activar GA4 real, agrega tu Measurement ID en index.html:
 *   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
 *   <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-XXXXXXXXXX');</script>
 */

const isDev = import.meta.env.DEV;

/**
 * Envía un evento a GA4 (o a la consola en dev).
 * @param {string} eventName  - Nombre del evento, ej. 'order_created'
 * @param {object} params     - Parámetros adicionales del evento
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  } else if (isDev) {
    console.debug(`[Analytics] ${eventName}`, params);
  }
}

/**
 * Registra una vista de página (útil en SPAs con React Router).
 * @param {string} path   - Ruta actual, ej. '/dashboard/reception'
 * @param {string} title  - Título de la página
 */
export function trackPageView(path, title) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    });
  } else if (isDev) {
    console.debug(`[Analytics] page_view → ${path} (${title})`);
  }
}

/**
 * Hook que trackea automáticamente la ruta actual con React Router.
 * Úsalo en App.jsx o en el componente raíz de rutas.
 *
 * @example
 *   import { usePageTracking } from './hooks/useAnalytics';
 *   function App() { usePageTracking(); return <Routes>...</Routes>; }
 */
export function usePageTracking() {
  // Importación dinámica para no romper si react-router no está disponible
  let useLocation;
  try {
    ({ useLocation } = require('react-router-dom'));
  } catch {
    return;
  }

  const location = useLocation();

  // Usamos useEffect de forma manual para evitar importar React aquí
  if (typeof window !== 'undefined') {
    const path  = location.pathname + location.search;
    const title = document.title;
    // Debounce mínimo: solo trackea si la ruta cambió
    if (window.__lastTrackedPath !== path) {
      window.__lastTrackedPath = path;
      trackPageView(path, title);
    }
  }
}

/**
 * Eventos predefinidos de Omnikook para consistencia.
 * Úsalos en lugar de strings crudos para evitar typos.
 */
export const Events = {
  // Pedidos
  ORDER_CREATED:    'order_created',
  ORDER_DELIVERED:  'order_delivered',
  ORDER_CANCELLED:  'order_cancelled',
  ORDER_READY:      'order_ready',

  // Autenticación
  LOGIN:            'login',
  LOGOUT:           'logout',
  REGISTER:         'sign_up',

  // Bot / Chat
  BOT_MESSAGE_SENT: 'bot_message_sent',
  BOT_CHAT_RESET:   'bot_chat_reset',

  // Onboarding
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_DISMISSED:      'onboarding_dismissed',

  // Navegación
  PAGE_VIEW:        'page_view',
};
