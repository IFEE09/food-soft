/**
 * OfflineIndicator — Banner de estado de red para el POS
 *
 * Muestra:
 * - Barra verde cuando online
 * - Barra roja cuando offline con contador de pedidos en cola
 * - Barra amarilla cuando está sincronizando
 * - Modal expandible con detalle de la cola
 */
import { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, X, Trash2 } from 'lucide-react';

export function OfflineIndicator({
  isOnline, isSyncing, pendingCount, failedCount, queue,
  onSync, onDequeue, onClearQueue, lastSyncAt
}) {
  const [expanded, setExpanded] = useState(false);

  // No mostrar nada si todo está bien y no hay cola
  if (isOnline && !isSyncing && pendingCount === 0 && failedCount === 0) return null;

  const bgColor   = !isOnline ? '#ff4444' : isSyncing ? '#ffaa00' : failedCount > 0 ? '#ff8800' : '#ccff00';
  const textColor = !isOnline || isSyncing || failedCount > 0 ? '#000' : '#000';

  const statusText = !isOnline
    ? `SIN CONEXIÓN — ${pendingCount} pedido(s) en cola`
    : isSyncing
    ? 'SINCRONIZANDO PEDIDOS...'
    : failedCount > 0
    ? `${failedCount} pedido(s) fallaron — revisa la cola`
    : `${pendingCount} pedido(s) pendientes de sincronizar`;

  const StatusIcon = !isOnline ? WifiOff : isSyncing ? RefreshCw : failedCount > 0 ? AlertTriangle : CheckCircle;

  return (
    <>
      {/* Banner superior */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: bgColor, color: textColor,
        padding: '0.45rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
        cursor: 'pointer', userSelect: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }} onClick={() => setExpanded(e => !e)}>
        <StatusIcon size={15} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{statusText}</span>
        {!isOnline && (
          <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Los pedidos se guardan localmente y se enviarán al recuperar la conexión</span>
        )}
        {isOnline && pendingCount > 0 && !isSyncing && (
          <button
            onClick={e => { e.stopPropagation(); onSync(); }}
            style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '2px', padding: '0.25rem 0.6rem', cursor: 'pointer', color: textColor, fontWeight: 800, fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <RefreshCw size={11} /> Sincronizar ahora
          </button>
        )}
        <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>▾</span>
      </div>

      {/* Panel expandido con detalle de la cola */}
      {expanded && (
        <div style={{
          position: 'fixed', top: '34px', left: 0, right: 0, zIndex: 9998,
          background: 'var(--surface-color)', border: `1px solid ${bgColor}44`,
          borderTop: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          maxHeight: '320px', overflowY: 'auto',
          padding: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>
              COLA DE PEDIDOS OFFLINE ({queue.length})
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {queue.length > 0 && (
                <button onClick={onClearQueue} style={{ background: 'none', border: '1px solid rgba(255,68,68,0.4)', borderRadius: '2px', padding: '0.25rem 0.6rem', cursor: 'pointer', color: '#ff4444', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Trash2 size={11} /> Limpiar cola
                </button>
              )}
              <button onClick={() => setExpanded(false)} style={{ background: 'none', border: '1px solid var(--surface-border)', borderRadius: '2px', padding: '0.25rem 0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <X size={13} />
              </button>
            </div>
          </div>

          {lastSyncAt && (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
              Última sincronización: {lastSyncAt.toLocaleTimeString('es-MX')}
            </p>
          )}

          {queue.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', textAlign: 'center', margin: '1rem 0' }}>No hay pedidos en cola.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {queue.map((item, idx) => (
                <div key={item.id} style={{
                  background: item.failed ? 'rgba(255,68,68,0.08)' : 'var(--neutral-bg)',
                  border: `1px solid ${item.failed ? 'rgba(255,68,68,0.3)' : 'var(--surface-border)'}`,
                  borderRadius: '3px', padding: '0.6rem 0.75rem',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.failed ? '❌' : '⏳'} Pedido #{idx + 1} — {item.payload.client_name || 'Sin nombre'}
                    </p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                      {item.payload.items?.length || 0} producto(s) · Encolado: {new Date(item.enqueuedAt).toLocaleTimeString('es-MX')}
                      {item.retries > 0 && ` · Intentos: ${item.retries}/${3}`}
                    </p>
                    {item.failed && (
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.62rem', color: '#ff4444', fontWeight: 700 }}>
                        Falló después de 3 intentos. Revisa la conexión y elimina o reintenta.
                      </p>
                    )}
                  </div>
                  <button onClick={() => onDequeue(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
