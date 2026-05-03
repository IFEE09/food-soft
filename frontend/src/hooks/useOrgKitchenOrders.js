import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

/** WebSocket URL (sin JWT en query; auth vía primer mensaje JSON en onopen). */
export function buildKitchenWsUrl(orgId) {
  const token = localStorage.getItem('token');
  if (!token) return null;
  const api = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
  const base = api.replace(/\/api\/v1\/?$/, '');
  const wsBase = base.startsWith('https')
    ? base.replace(/^https/, 'wss')
    : base.replace(/^http/, 'ws');
  return `${wsBase}/ws/${orgId}`;
}

/**
 * Pending orders for the logged-in org + WebSocket/polling so WhatsApp/bot orders appear live.
 */
export function useOrgKitchenOrders() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/orders/?status=pending');
      setOrders(data);
    } catch (err) {
      console.error('Pending orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await apiClient.get('/users/me');
        if (data.organization_id != null) {
          localStorage.setItem('organizationId', String(data.organization_id));
        }
      } catch (_) {
        /* sin sesión o error */
      }
      if (!cancelled) await fetchPending();
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchPending]);

  useEffect(() => {
    const orgRaw = localStorage.getItem('organizationId');
    const orgId = orgRaw ? parseInt(orgRaw, 10) : NaN;

    let ws;
    const wsUrl = buildKitchenWsUrl(orgId);
    if (!Number.isNaN(orgId) && orgId > 0 && wsUrl) {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          const t = localStorage.getItem('token');
          if (t) ws.send(JSON.stringify({ type: 'auth', token: t }));
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'new_order') fetchPending();
          } catch (_) {
            /* ignore */
          }
        };
      } catch (_) {
        /* WebSocket no disponible */
      }
    }

    const poll = setInterval(fetchPending, 8000);
    return () => {
      if (ws && ws.readyState <= 1) ws.close();
      clearInterval(poll);
    };
  }, [fetchPending]);

  return { orders, setOrders, refetch: fetchPending, isLoading };
}
