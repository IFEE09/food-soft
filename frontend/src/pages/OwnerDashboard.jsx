import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, buildWsUrl } from '../api/client';
import { Clock, CheckCircle2, AlertCircle, ArrowUpRight, Building2, Package, TrendingUp } from 'lucide-react';

const STATUS_MAP = {
  pending:   { label: 'Pendiente',  className: 'status-pending' },
  preparing: { label: 'En cocina',  className: 'status-preparing' },
  ready:     { label: 'Listo',      className: 'status-ready' },
  delivered: { label: 'Entregado',  className: 'status-delivered' },
  cancelled: { label: 'Cancelado',  className: 'status-cancelled' },
};

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [supplies, setSupplies] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markingReady, setMarkingReady] = useState({});
  const [notification, setNotification] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [orgName, setOrgName] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiClient.get('/orders/?limit=20');
      setOrders(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchSupplies = useCallback(async () => {
    try {
      const res = await apiClient.get('/supplies/?limit=5');
      setSupplies(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchOrgName = useCallback(async () => {
    try {
      const res = await apiClient.get('/users/me/organizations');
      const orgId = localStorage.getItem('organizationId');
      const active = res.data.find(o => String(o.id) === String(orgId)) || res.data[0];
      if (active) setOrgName(active.name);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    Promise.all([fetchOrders(), fetchSupplies(), fetchOrgName()]).finally(() => setIsLoading(false));
    const poll = setInterval(fetchOrders, 8000);
    let ws;
    const orgId = parseInt(localStorage.getItem('organizationId') || '0', 10);
    if (orgId > 0) {
      try {
        ws = new WebSocket(buildWsUrl(`/ws/${orgId}`));
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
    return () => { clearInterval(poll); if (ws && ws.readyState <= 1) ws.close(); };
  }, [fetchOrders, fetchSupplies, fetchOrgName]);

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
      showNotification(`Pedido #${orderNum} marcado como listo${total ? ` — ${total}` : ''}`, 'success');
    } catch (err) {
      showNotification('Error al marcar el pedido como listo', 'error');
    } finally {
      setMarkingReady(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const readyCount   = orders.filter(o => o.status === 'ready').length;
  const totalToday   = orders.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Toast */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
          padding: '0.875rem 1.25rem',
          background: notification.type === 'success' ? 'var(--ready-color)' : 'var(--danger-color)',
          color: '#fff', borderRadius: '12px', fontWeight: 600, fontSize: '0.875rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '400px',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <CheckCircle2 size={16} />
          {notification.msg}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>¿Confirmar pedido listo?</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Pedido <strong style={{ color: 'var(--text-primary)' }}>#{confirmModal.orderNum}</strong>
              {confirmModal.total && <> — <strong style={{ color: 'var(--text-primary)' }}>{confirmModal.total}</strong></>}
              {' '}a nombre de <strong style={{ color: 'var(--text-primary)' }}>{confirmModal.clientName}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmModal(null)}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReady}
                className="btn-primary"
                style={{ flex: 2, background: 'var(--ready-color)' }}
              >
                <CheckCircle2 size={16} /> Sí, está listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          {orgName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
              <Building2 size={13} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{orgName}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => navigate('/dashboard/kitchen')}
          className="btn-secondary"
          style={{ gap: '0.375rem', fontSize: '0.875rem', padding: '0.5rem 1rem', minHeight: '38px' }}
        >
          Ver cocinas <ArrowUpRight size={14} />
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Pending */}
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span className="stat-card-label">Pendientes</span>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Clock size={16} style={{ color: 'var(--warning-color)' }} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: pendingCount > 0 ? 'var(--warning-color)' : 'var(--text-primary)' }}>
            {pendingCount}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>En cola ahora</p>
        </div>

        {/* Ready */}
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span className="stat-card-label">Listos</span>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--ready-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <CheckCircle2 size={16} style={{ color: 'var(--ready-color)' }} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: readyCount > 0 ? 'var(--ready-color)' : 'var(--text-primary)' }}>
            {readyCount}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>Esperando entrega</p>
        </div>

        {/* Total */}
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span className="stat-card-label">Total hoy</span>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <TrendingUp size={16} style={{ color: 'var(--accent-blue)' }} />
            </div>
          </div>
          <div className="stat-card-value">{totalToday}</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>Pedidos registrados</p>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Orders table */}
        <div style={{
          background: 'var(--surface-color)',
          border: '1px solid var(--surface-border)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--surface-border)'
          }}>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.015em' }}>
                Pedidos recientes
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.125rem 0 0', fontWeight: 400 }}>
                Últimos 20 pedidos en tiempo real
              </p>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th># Pedido</th>
                  <th>Ítems</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    <span className="spinner" style={{ margin: '0 auto', display: 'block' }} />
                  </td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan="5">
                    <div className="empty-state">
                      <AlertCircle size={32} className="empty-state-icon" />
                      <p className="empty-state-title">Sin pedidos</p>
                      <p className="empty-state-desc">Los pedidos aparecerán aquí en tiempo real</p>
                    </div>
                  </td></tr>
                ) : orders.map((row) => {
                  const statusInfo = STATUS_MAP[row.status] || { label: row.status, className: 'badge-neutral' };
                  const itemsText = row.items?.length > 0
                    ? row.items.map(it => `${it.product_name} ×${it.quantity}`).join(', ')
                    : '—';
                  const isMarking = markingReady[row.id];

                  return (
                    <tr key={row.id}>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--accent-blue)', fontVariantNumeric: 'tabular-nums' }}>
                          #{row.id.toString().padStart(4, '0')}
                        </span>
                      </td>
                      <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={itemsText} style={{ color: 'var(--text-primary)' }}>{itemsText}</span>
                        {row.notes && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--warning-color)', marginTop: '2px' }}>
                            Nota: {row.notes}
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {row.client_name || '—'}
                      </td>
                      <td>
                        <span className={`status-badge ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td>
                        {row.status === 'pending' ? (
                          <button
                            onClick={() => handleTerminadoClick(row)}
                            disabled={isMarking}
                            style={{
                              padding: '0.375rem 0.875rem',
                              background: 'var(--ready-color)',
                              border: 'none',
                              borderRadius: '9999px',
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: '0.8125rem',
                              cursor: isMarking ? 'not-allowed' : 'pointer',
                              opacity: isMarking ? 0.6 : 1,
                              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                              whiteSpace: 'nowrap', fontFamily: 'inherit'
                            }}
                          >
                            <CheckCircle2 size={13} />
                            {isMarking ? 'Guardando...' : 'Listo'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Inventory */}
          <div style={{
            background: 'var(--surface-color)',
            border: '1px solid var(--surface-border)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--surface-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={15} style={{ color: 'var(--accent-blue)' }} />
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                  Inventario
                </h3>
              </div>
              <button
                onClick={() => navigate('/dashboard/supplies')}
                style={{
                  background: 'none', border: 'none', color: 'var(--accent-blue)',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'inherit'
                }}
              >
                Ver todo <ArrowUpRight size={13} />
              </button>
            </div>
            <div style={{ padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {isLoading ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>Cargando...</p>
              ) : supplies.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>Sin insumos registrados</p>
              ) : supplies.map((stock, i) => {
                const isLow = stock.quantity <= stock.min_quantity;
                const isCritical = stock.quantity <= (stock.min_quantity / 2);
                const statusColor = isCritical ? 'var(--danger-color)' : isLow ? 'var(--warning-color)' : 'var(--ready-color)';
                const statusLabel = isCritical ? 'Crítico' : isLow ? 'Bajo' : 'OK';
                const statusBg = isCritical ? 'var(--danger-bg)' : isLow ? 'var(--warning-bg)' : 'var(--ready-bg)';
                const statusBorder = isCritical ? 'var(--danger-border)' : isLow ? 'var(--warning-border)' : 'var(--ready-border)';
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{stock.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1px' }}>{stock.quantity} {stock.unit}</div>
                    </div>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700, color: statusColor,
                      background: statusBg, border: `1px solid ${statusBorder}`,
                      padding: '0.1875rem 0.5rem', borderRadius: '9999px', whiteSpace: 'nowrap'
                    }}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Responsive override */}
      <style>{`
        @media (max-width: 900px) {
          .dashboard-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
