import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Clock, CheckCircle2, AlertCircle, ArrowUpRight, Send } from 'lucide-react';

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [supplies, setSupplies] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markingReady, setMarkingReady] = useState({});
  const [notification, setNotification] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { orderId, orderNum, total }

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiClient.get('/orders/?limit=20');
      setOrders(res.data);
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  }, []);

  const fetchSupplies = useCallback(async () => {
    try {
      const res = await apiClient.get('/supplies/?limit=5');
      setSupplies(res.data);
    } catch (err) {
      console.error('Error fetching supplies:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchOrders(), fetchSupplies()]).finally(() => setIsLoading(false));
    const poll = setInterval(fetchOrders, 8000);
    let ws;
    const orgRaw = localStorage.getItem('organizationId');
    const orgId = orgRaw ? parseInt(orgRaw, 10) : NaN;
    if (!Number.isNaN(orgId) && orgId > 0) {
      try {
        const api = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        const base = api.replace(/\/api\/v1\/?$/, '');
        const wsBase = base.startsWith('https')
          ? base.replace(/^https/, 'wss')
          : base.replace(/^http/, 'ws');
        ws = new WebSocket(`${wsBase}/ws/${orgId}`);
        ws.onopen = () => {
          const t = localStorage.getItem('token');
          if (t) ws.send(JSON.stringify({ type: 'auth', token: t }));
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'new_order' || msg.type === 'order_ready') fetchOrders();
          } catch (_) {}
        };
      } catch (_) {}
    }
    return () => {
      clearInterval(poll);
      if (ws && ws.readyState <= 1) ws.close();
    };
  }, [fetchOrders, fetchSupplies]);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleTerminadoClick = (order) => {
    setConfirmModal({
      orderId: order.id,
      orderNum: order.id.toString().padStart(4, '0'),
      total: order.total ? `$${order.total.toFixed(2)}` : '',
      clientName: order.client_name || 'Sin nombre',
    });
  };

  const handleConfirmReady = async () => {
    const { orderId, orderNum, total } = confirmModal;
    setConfirmModal(null);
    setMarkingReady(prev => ({ ...prev, [orderId]: true }));
    try {
      await apiClient.post(`/orders/${orderId}/mark-ready`);
      await fetchOrders();
      showNotification(
        `✅ Pedido #${orderNum} terminado${total ? ` — ${total}` : ''} — WhatsApp enviado al repartidor`,
        'success'
      );
    } catch (err) {
      console.error('Error marking order as ready:', err);
      showNotification('⚠️ Error al marcar el pedido como terminado', 'error');
    } finally {
      setMarkingReady(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const readyCount   = orders.filter(o => o.status === 'ready').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Toast de notificación */}
      {notification && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          padding: '0.9rem 1.4rem',
          background: notification.type === 'success' ? 'rgba(5,150,105,0.95)' : 'rgba(220,38,38,0.95)',
          color: '#fff', borderRadius: '6px', fontWeight: 700, fontSize: '0.9rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: '0.6rem', maxWidth: '440px'
        }}>
          <Send size={16} />
          {notification.msg}
        </div>
      )}

      {/* Modal de confirmación */}
      {confirmModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1px solid var(--surface-border)',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '380px',
            width: '90%',
            display: 'flex', flexDirection: 'column', gap: '1.5rem'
          }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800 }}>
                ¿Confirmar pedido listo?
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Pedido <strong style={{ color: 'var(--success-color)' }}>#{confirmModal.orderNum}</strong>
                {confirmModal.total && <> — <strong style={{ color: 'var(--success-color)' }}>{confirmModal.total}</strong></>}
                {' '}a nombre de <strong>{confirmModal.clientName}</strong>.
                <br />Se enviará WhatsApp al repartidor.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  flex: 1, padding: '0.7rem',
                  background: 'transparent',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '4px',
                  color: 'var(--text-secondary)',
                  fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReady}
                style={{
                  flex: 2, padding: '0.7rem',
                  background: '#059669',
                  border: '1px solid #059669',
                  borderRadius: '4px',
                  color: '#fff',
                  fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                <CheckCircle2 size={16} /> Sí, está listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1px', background: 'var(--surface-border)', border: '1px solid var(--surface-border)' }}>
        <div style={{ background: 'var(--surface-color)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '2px solid var(--danger-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>PENDING_ORDERS</h4>
            <AlertCircle size={14} style={{ color: 'var(--danger-color)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 className="mono" style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{pendingCount}</h3>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase' }}>In Queue // Real-Time</span>
          </div>
        </div>
        <div style={{ background: 'var(--surface-color)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '2px solid var(--success-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>READY_TO_SERVE</h4>
            <CheckCircle2 size={14} style={{ color: 'var(--success-color)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 className="mono" style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--success-color)', margin: 0, lineHeight: 1 }}>{readyCount}</h3>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase' }}>Awaiting Delivery</span>
          </div>
        </div>
      </div>

      {/* Tables Area */}
      <div className="dashboard-grid">

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>RECENT_TRANSACTIONS</h3>
            <button
              onClick={() => navigate('/dashboard/kitchen')}
              className="mono"
              style={{ background: 'transparent', border: 'none', color: 'var(--success-color)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase' }}
            >
              System Monitor <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}># PEDIDO</th>
                  <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ORDEN CON NOTA</th>
                  <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NOMBRE</th>
                  <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ESTATUS</th>
                  <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody className="mono">
                {isLoading ? (
                  <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>FETCHING_DATA...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>NO_RECORDS_FOUND</td></tr>
                ) : orders.map((row, i) => {
                  let badgeColor = 'var(--text-secondary)';
                  if (row.status === 'pending')    badgeColor = 'var(--danger-color)';
                  else if (row.status === 'ready') badgeColor = 'var(--success-color)';
                  else if (row.status === 'delivered') badgeColor = 'var(--primary-color)';

                  const itemsText = row.items && row.items.length > 0
                    ? row.items.map(it => `${it.product_name} x${it.quantity}`).join(', ')
                    : '—';
                  const notaText = row.notes ? ` ✎ ${row.notes}` : '';
                  const ordenConNota = itemsText + notaText;
                  const isMarking = markingReady[row.id];

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '1rem 0', color: 'var(--success-color)' }}>
                        #{row.id.toString().padStart(4, '0')}
                      </td>
                      <td style={{ padding: '1rem 0', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={ordenConNota} style={{ color: row.notes ? '#f0c040' : 'var(--text-primary)' }}>
                          {ordenConNota}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0', color: 'var(--text-primary)' }}>
                        {row.client_name || '—'}
                      </td>
                      <td style={{ padding: '1rem 0' }}>
                        <span style={{
                          fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '2px', fontWeight: 700,
                          border: `1px solid ${badgeColor}44`,
                          color: badgeColor,
                          whiteSpace: 'nowrap',
                          textTransform: 'uppercase'
                        }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0' }}>
                        {row.status === 'pending' ? (
                          <button
                            onClick={() => handleTerminadoClick(row)}
                            disabled={isMarking}
                            style={{
                              padding: '0.35rem 0.85rem',
                              background: isMarking ? '#047857' : '#059669',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: isMarking ? 'not-allowed' : 'pointer',
                              opacity: isMarking ? 0.7 : 1,
                              display: 'flex', alignItems: 'center', gap: '0.4rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <CheckCircle2 size={13} />
                            {isMarking ? 'Enviando...' : 'Terminado'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>WEEKLY_ANALYTICS</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', flex: 1, fontFamily: 'JetBrains Mono, monospace' }}>STREAM_ACTIVE: Latency 0ms</p>
            <div style={{ height: '60px', borderBottom: '1px dashed var(--surface-border)', borderLeft: '1px solid var(--surface-border)' }}></div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>INVENTORY_STATUS</h3>
              <span
                className="mono"
                style={{ fontSize: '0.65rem', color: 'var(--success-color)', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}
                onClick={() => navigate('/dashboard/supplies')}
              >
                Configure
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {isLoading ? (
                <p className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SCANNING...</p>
              ) : supplies.length === 0 ? (
                <p className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>EMPTY_SLOTS</p>
              ) : supplies.map((stock, i) => {
                const isLow = stock.quantity <= stock.min_quantity;
                const isCritical = stock.quantity <= (stock.min_quantity / 2);
                const statusColor = isCritical ? 'var(--danger-color)' : isLow ? 'var(--warning-color)' : 'var(--text-secondary)';
                const statusLabel = isCritical ? 'CRITICAL' : isLow ? 'LOW' : 'OK';
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0, flex: 1, paddingRight: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{stock.name}</div>
                      <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{stock.quantity} {stock.unit}</div>
                    </div>
                    <div className="mono" style={{
                      fontSize: '0.6rem', fontWeight: 700, color: statusColor,
                      border: `1px solid ${statusColor}44`, padding: '0.1rem 0.4rem', borderRadius: '2px'
                    }}>
                      {statusLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
