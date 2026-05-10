/**
 * useOfflineQueue — Hook para modo offline en el POS
 *
 * Funcionalidad:
 * 1. Detecta el estado de la conexión (online/offline) en tiempo real
 * 2. Cuando offline: guarda los pedidos en localStorage en lugar de enviarlos
 * 3. Cuando vuelve online: sincroniza automáticamente todos los pedidos pendientes
 * 4. Expone el estado de la cola y funciones para interactuar con ella
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api/client';

const QUEUE_KEY = 'omnikook_offline_queue';
const MAX_RETRIES = 3;

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[OfflineQueue] Error saving queue:', e);
  }
}

export function useOfflineQueue({ onSyncSuccess, onSyncError } = {}) {
  const [isOnline, setIsOnline]       = useState(navigator.onLine);
  const [queue, setQueue]             = useState(loadQueue);
  const [isSyncing, setIsSyncing]     = useState(false);
  const [lastSyncAt, setLastSyncAt]   = useState(null);
  const syncRef = useRef(false);

  // ── Detectar cambios de conexión ──────────────────────────────────────────
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Sincronizar cuando vuelve la conexión ─────────────────────────────────
  useEffect(() => {
    if (isOnline && queue.length > 0 && !syncRef.current) {
      syncQueue();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Función de sincronización ─────────────────────────────────────────────
  const syncQueue = useCallback(async () => {
    if (syncRef.current) return;
    const pending = loadQueue();
    if (pending.length === 0) return;

    syncRef.current = true;
    setIsSyncing(true);

    const failed = [];
    let successCount = 0;

    for (const item of pending) {
      try {
        await apiClient.post('/orders/', item.payload);
        successCount++;
      } catch (err) {
        const retries = (item.retries || 0) + 1;
        if (retries < MAX_RETRIES) {
          failed.push({ ...item, retries });
        } else {
          // Después de MAX_RETRIES intentos, marcar como fallido permanente
          failed.push({ ...item, retries, failed: true });
        }
      }
    }

    saveQueue(failed);
    setQueue(failed);
    setIsSyncing(false);
    setLastSyncAt(new Date());
    syncRef.current = false;

    if (successCount > 0 && onSyncSuccess) {
      onSyncSuccess(successCount, failed.length);
    }
    if (failed.length > 0 && onSyncError) {
      onSyncError(failed);
    }
  }, [onSyncSuccess, onSyncError]);

  // ── Agregar pedido a la cola (cuando offline) ─────────────────────────────
  const enqueue = useCallback((payload) => {
    const item = {
      id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      payload,
      enqueuedAt: new Date().toISOString(),
      retries: 0,
      failed: false,
    };
    const updated = [...loadQueue(), item];
    saveQueue(updated);
    setQueue(updated);
    return item.id;
  }, []);

  // ── Eliminar un item de la cola (ej. pedido fallido permanente) ───────────
  const dequeue = useCallback((id) => {
    const updated = loadQueue().filter(i => i.id !== id);
    saveQueue(updated);
    setQueue(updated);
  }, []);

  // ── Limpiar toda la cola ──────────────────────────────────────────────────
  const clearQueue = useCallback(() => {
    saveQueue([]);
    setQueue([]);
  }, []);

  // ── Enviar pedido: online → API directa, offline → cola ──────────────────
  const submitOrder = useCallback(async (payload) => {
    if (isOnline) {
      // Intento directo — si falla por red, encolar
      try {
        const res = await apiClient.post('/orders/', payload);
        return { success: true, data: res.data, offline: false };
      } catch (err) {
        // Si es error de red (no de validación), encolar
        const isNetworkError = !err.response;
        if (isNetworkError) {
          const queueId = enqueue(payload);
          return { success: true, data: null, offline: true, queueId };
        }
        throw err; // Re-lanzar errores de validación (400, 422, etc.)
      }
    } else {
      // Offline directo → encolar
      const queueId = enqueue(payload);
      return { success: true, data: null, offline: true, queueId };
    }
  }, [isOnline, enqueue]);

  return {
    isOnline,
    isSyncing,
    lastSyncAt,
    queue,
    pendingCount: queue.filter(i => !i.failed).length,
    failedCount:  queue.filter(i =>  i.failed).length,
    submitOrder,
    syncQueue,
    enqueue,
    dequeue,
    clearQueue,
  };
}
