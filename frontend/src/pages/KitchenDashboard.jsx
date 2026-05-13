import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useOrgKitchenOrders } from '../hooks/useOrgKitchenOrders';
import {
  Clock, CheckCircle2, ChefHat, Plus, PlusCircle,
  Monitor, Activity, Building2, AlertCircle, Flame, Timer
} from 'lucide-react';

// ── Urgency helpers ────────────────────────────────────────────────────────
function getMinutesInQueue(createdAt) {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function getUrgency(minutes) {
  if (minutes >= 15) return { level: 'critical', color: 'var(--danger-color)', bg: 'rgba(255,51,51,0.08)', border: 'rgba(255,51,51,0.35)', label: 'URGENTE' };
  if (minutes >= 7)  return { level: 'warning',  color: 'var(--warning-color)', bg: 'rgba(255,214,0,0.08)', border: 'rgba(255,214,0,0.35)', label: 'DEMORADO' };
  return               { level: 'ok',       color: 'var(--success-color)', bg: 'rgba(26, 86, 219, 0.05)', border: 'rgba(26, 86, 219, 0.2)', label: null };
}

// ── Timer badge (live) ─────────────────────────────────────────────────────
function TimerBadge({ createdAt }) {
  const [mins, setMins] = useState(getMinutesInQueue(createdAt));
  useEffect(() => {
    const id = setInterval(() => setMins(getMinutesInQueue(createdAt)), 30000);
    return () => clearInterval(id);
  }, [createdAt]);
  const urg = getUrgency(mins);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      fontSize: '0.65rem', fontWeight: 800, fontFamily: 'inherit',
      color: urg.color, background: urg.bg, border: `1px solid ${urg.border}`,
      padding: '0.15rem 0.45rem', borderRadius: '3px',
      animation: urg.level === 'critical' ? 'pulse-accent 1.2s ease-in-out infinite' : 'none'
    }}>
      {urg.level === 'critical' ? <Flame size={10} /> : <Timer size={10} />}
      {mins}m {urg.label ? `· ${urg.label}` : ''}
    </span>
  );
}

// ── Order Card ─────────────────────────────────────────────────────────────
function OrderCard({ row, selectedStation, onItemStatus, onMarkReady, isMarking }) {
  const mins = getMinutesInQueue(row.created_at);
  const urg  = getUrgency(mins);

  const visibleItems = row.items
    ? row.items.filter(it => !selectedStation || it.station_id === selectedStation)
    : [];

  const allDone = visibleItems.length > 0 && visibleItems.every(it => it.item_status === 'done');

  return (
    <div style={{
      background: 'var(--surface-color)',
      border: `1px solid ${urg.border}`,
      borderTop: `3px solid ${urg.color}`,
      borderRadius: '12px',
      padding: '1.1rem',
      display: 'flex', flexDirection: 'column', gap: '0.85rem',
      transition: 'transform 0.15s, box-shadow 0.15s',
      position: 'relative',
      animation: 'cardEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) both'
    }}>

      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: urg.color, fontFamily: 'inherit', letterSpacing: '-0.02em' }}>
            #{row.id.toString().padStart(4, '0')}
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {row.client_name || 'Sin nombre'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
          <TimerBadge createdAt={row.created_at} />
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: row.status === 'ready' ? 'var(--success-color)' : urg.color,
            border: `1px solid ${row.status === 'ready' ? 'var(--success-border)' : urg.border}`,
            background: row.status === 'ready' ? 'var(--success-bg)' : urg.bg,
            padding: '0.1rem 0.4rem', borderRadius: '2px'
          }}>
            {row.status === 'pending' ? '⏳ En preparación' : row.status === 'ready' ? '✅ Listo' : row.status === 'delivered' ? '🏃 Entregado' : row.status}
          </span>
        </div>
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {visibleItems.length > 0 ? visibleItems.map(it => {
          const done = it.item_status === 'done';
          const inProg = it.item_status === 'in_progress';
          return (
            <div key={it.id} style={{
              display: 'flex', flexDirection: 'column', gap: '0.25rem',
              padding: '0.55rem 0.65rem', borderRadius: '4px',
              background: done ? 'rgba(26, 86, 219, 0.04)' : inProg ? 'rgba(255,214,0,0.06)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${done ? 'rgba(26, 86, 219, 0.15)' : inProg ? 'rgba(255,214,0,0.2)' : 'var(--surface-border)'}`,
              opacity: done ? 0.6 : 1
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontSize: '0.85rem', fontWeight: done ? 400 : 700,
                  color: done ? 'var(--success-color)' : inProg ? '#FFD600' : 'var(--text-primary)',
                  textDecoration: done ? 'line-through' : 'none'
                }}>
                  {it.product_name} <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.7 }}>×{it.quantity}</span>
                </span>
                {row.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    {!inProg && !done && (
                      <button onClick={() => onItemStatus(it.id, 'in_progress')} style={{
                        fontSize: '0.6rem', padding: '0.15rem 0.45rem', borderRadius: '9999px', fontWeight: 700,
                        background: 'rgba(255,214,0,0.12)', border: '1px solid rgba(255,214,0,0.4)',
                        color: 'var(--warning-color)', cursor: 'pointer'
                      }}>⏳ Preparando</button>
                    )}
                    {!done && (
                      <button onClick={() => onItemStatus(it.id, 'done')} style={{
                        fontSize: '0.6rem', padding: '0.15rem 0.45rem', borderRadius: '9999px', fontWeight: 700,
                        background: 'rgba(26, 86, 219, 0.12)', border: '1px solid rgba(26, 86, 219, 0.4)',
                        color: 'var(--success-color)', cursor: 'pointer'
                      }}>✓ Listo</button>
                    )}
                    {done && (
                      <span style={{ fontSize: '0.6rem', color: 'var(--success-color)', fontWeight: 700 }}>✓</span>
                    )}
                  </div>
                )}
              </div>
              {it.note && (
                <span style={{ fontSize: '0.72rem', color: 'var(--warning-color)', fontStyle: 'italic' }}>✎ {it.note}</span>
              )}
            </div>
          );
        }) : (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {row.items?.map(i => `${i.product_name} ×${i.quantity}`).join(', ') || '—'}
          </span>
        )}
        {row.notes && (
          <div style={{ fontSize: '0.75rem', color: 'var(--warning-color)', padding: '0.35rem 0.5rem', background: 'rgba(255,214,0,0.06)', borderRadius: '3px', border: '1px solid rgba(255,214,0,0.2)' }}>
            ✎ Nota del pedido: {row.notes}
          </div>
        )}
      </div>

      {/* Footer action */}
      {row.status === 'pending' && (
        <button
          onClick={() => onMarkReady(row)}
          disabled={isMarking}
          style={{
            width: '100%', padding: '0.55rem', borderRadius: '4px',
            background: allDone ? '#059669' : 'rgba(5,150,105,0.15)',
            border: `1px solid ${allDone ? '#059669' : 'rgba(5,150,105,0.4)'}`,
            color: allDone ? '#fff' : 'var(--success-color)',
            fontWeight: 700, fontSize: '0.8rem', cursor: isMarking ? 'not-allowed' : 'pointer',
            opacity: isMarking ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            transition: 'all 0.2s'
          }}
        >
          <CheckCircle2 size={14} />
          {isMarking ? 'Enviando...' : allDone ? 'Marcar Pedido Listo' : 'Terminar Pedido'}
        </button>
      )}
      {row.status === 'ready' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', borderRadius: '4px', background: 'rgba(26, 86, 219, 0.06)', border: '1px solid rgba(26, 86, 219, 0.2)', color: 'var(--success-color)', fontSize: '0.78rem', fontWeight: 700 }}>
          <CheckCircle2 size={13} /> ✅ Listo — esperando al repartidor
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function KitchenDashboard() {
  const { orders, refetch, isLoading: ordersLoading } = useOrgKitchenOrders();
  const [kitchens, setKitchens]             = useState([]);
  const [stations, setStations]             = useState([]);
  const [selectedKitchen, setSelectedKitchen] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [loading, setLoading]               = useState(true);
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [modalType, setModalType]           = useState('kitchen');
  const [newName, setNewName]               = useState('');
  const [markingReady, setMarkingReady]     = useState({});
  const [notification, setNotification]     = useState(null);
  const [confirmModal, setConfirmModal]     = useState(null);

  useEffect(() => { fetchInitialData(); }, []);

  useEffect(() => {
    const savedId = localStorage.getItem('kitchenId');
    if (savedId && kitchens.length > 0) {
      const k = kitchens.find(item => String(item.id) === String(savedId));
      if (k) handleSelectKitchen(k, false);
    }
  }, [kitchens.length]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const kRes = await apiClient.get('/kitchens/');
      setKitchens(kRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSelectKitchen = async (kitchen, shouldReload = true) => {
    setSelectedKitchen(kitchen);
    setSelectedStation(null);
    localStorage.setItem('kitchenId', kitchen.id);
    localStorage.setItem('kitchenName', kitchen.name);
    try {
      const sRes = await apiClient.get(`/stations/?kitchen_id=${kitchen.id}`);
      setStations(sRes.data);
      if (shouldReload) window.location.reload();
    } catch (err) { console.error(err); }
  };

  const handleBackToSites = () => {
    localStorage.removeItem('kitchenId');
    localStorage.removeItem('kitchenName');
    window.location.reload();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (modalType === 'kitchen') {
        const res = await apiClient.post('/kitchens/', { name: newName });
        setKitchens([...kitchens, res.data]);
      } else {
        const res = await apiClient.post('/stations/', { name: newName, kitchen_id: selectedKitchen.id });
        setStations([...stations, res.data]);
      }
      setIsModalOpen(false);
      setNewName('');
    } catch (err) { console.error(err); }
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleItemStatus = async (itemId, newStatus) => {
    try {
      await apiClient.patch(`/orders/items/${itemId}/status`, { item_status: newStatus });
      await refetch();
    } catch (err) {
      console.error(err);
      showNotification('⚠️ Error al actualizar el ítem', 'error');
    }
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
      await refetch();
      showNotification(`✅ Pedido #${orderNum} terminado${total ? ` — ${total}` : ''} — WhatsApp enviado al repartidor`, 'success');
    } catch (err) {
      console.error(err);
      showNotification('⚠️ Error al marcar el pedido como listo', 'error');
    } finally {
      setMarkingReady(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────
  const filteredOrders = orders.filter(o => {
    if (!selectedKitchen) return false;
    const kitchenStationIds = stations.map(s => s.id);
    if (selectedStation) return o.items && o.items.some(it => it.station_id === selectedStation);
    if (kitchenStationIds.length === 0) return true;
    return o.items && (o.items.some(it => kitchenStationIds.includes(it.station_id)) || o.items.some(it => !it.station_id));
  });

  const pendingOrders = filteredOrders.filter(o => o.status === 'pending');
  const readyOrders   = filteredOrders.filter(o => o.status === 'ready');

  // ── Vista 1: Selección de cocinas ──────────────────────────────────────
  if (!selectedKitchen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Mis Sucursales</h1>
            <p className="page-subtitle">Selecciona una sucursal para gestionar sus áreas y pedidos</p>
          </div>
          <button onClick={() => { setModalType('kitchen'); setIsModalOpen(true); }} className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
            + Nueva Sucursal
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {kitchens.map(k => (
            <div
              key={k.id}
              onClick={() => handleSelectKitchen(k)}
              style={{
                background: 'var(--surface-color)',
                border: '1px solid var(--surface-border)',
                borderRadius: '16px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-border)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--surface-border)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Ícono de sucursal */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <Building2 size={22} color="var(--accent-blue)" />
              </div>
              {/* Jerarquía: etiqueta Sucursal */}
              <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>Sucursal</div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{k.name}</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{k.address || 'Sin dirección registrada'}</p>
              {/* Estado online */}
              <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success-color)' }}>En línea</span>
              </div>
            </div>
          ))}
          {kitchens.length === 0 && !loading && (
            <div style={{ gridColumn: '1/-1' }} className="empty-state">
              {/* Diagrama de jerarquía */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                marginBottom: '1.5rem', padding: '1rem 1.5rem',
                background: 'var(--neutral-bg)', borderRadius: '12px',
                border: '1px solid var(--surface-border)',
              }}>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.25rem' }}>
                    <Building2 size={18} color="var(--accent-blue)" />
                  </div>
                  <span style={{ fontWeight: 600 }}>Marca</span>
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '1rem' }}>→</div>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.25rem' }}>
                    <Building2 size={18} color="var(--warning-color)" />
                  </div>
                  <span style={{ fontWeight: 600 }}>Sucursal</span>
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '1rem' }}>→</div>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.25rem' }}>
                    <ChefHat size={18} color="var(--success-color)" />
                  </div>
                  <span style={{ fontWeight: 600 }}>Área</span>
                </div>
              </div>
              <p className="empty-state-title">Aún no tienes sucursales</p>
              <p className="empty-state-desc">Crea tu primera sucursal para empezar a gestionar pedidos, menú y equipo.</p>
              <button onClick={() => { setModalType('kitchen'); setIsModalOpen(true); }} className="btn-primary" style={{ marginTop: '0.5rem' }}>
                + Crear primera sucursal
              </button>
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><PlusCircle size={18} /> Nueva Sucursal</h2>
                <button onClick={() => setIsModalOpen(false)} className="modal-close">×</button>
              </div>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="kitchen-name" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Nombre de la sucursal</label>
                  <input id="kitchen-name" type="text" placeholder="Ej. Sucursal Centro, Polanco, Plaza..." value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>Guardar</button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Vista 2: KDS ──────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Toast */}
      {notification && (
        <div style={{
          position: 'fixed', top: '4rem', right: '1.5rem', zIndex: 9999,
          padding: '0.85rem 1.25rem',
          background: notification.type === 'success' ? 'rgba(5,150,105,0.95)' : 'rgba(220,38,38,0.95)',
          color: '#fff', borderRadius: '6px', fontWeight: 700, fontSize: '0.88rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', maxWidth: '420px'
        }}>
          {notification.msg}
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '2rem', maxWidth: '360px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800 }}>¿Confirmar pedido listo?</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Pedido <strong style={{ color: 'var(--success-color)' }}>#{confirmModal.orderNum}</strong>
                {confirmModal.total && <> — <strong style={{ color: 'var(--success-color)' }}>{confirmModal.total}</strong></>}
                {' '}a nombre de <strong>{confirmModal.clientName}</strong>.<br />Se enviará WhatsApp al repartidor.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmModal(null)} style={{ flex: 1, padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleConfirmReady} style={{ flex: 1, padding: '0.6rem', borderRadius: '4px', border: 'none', background: 'var(--ready-color)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={15} /> Sí, está listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={handleBackToSites} style={{ padding: '0.35rem 0.75rem', borderRadius: '3px', border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
  ← Sucursales
        </button>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{selectedKitchen.name}</h2>

        {/* Station tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', marginLeft: '0.5rem' }}>
          <button onClick={() => setSelectedStation(null)} style={{
            padding: '0.25rem 0.65rem', borderRadius: '3px', fontSize: '0.72rem', fontWeight: 700,
            border: selectedStation === null ? '1px solid var(--success-color)' : '1px solid var(--surface-border)',
            background: selectedStation === null ? 'rgba(26, 86, 219, 0.1)' : 'transparent',
            color: selectedStation === null ? 'var(--success-color)' : 'var(--text-secondary)',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
          }}>
            <Monitor size={11} /> Todas
          </button>
          {stations.map(s => (
            <button key={s.id} onClick={() => setSelectedStation(s.id)} style={{
              padding: '0.25rem 0.65rem', borderRadius: '3px', fontSize: '0.72rem', fontWeight: 700,
              border: selectedStation === s.id ? '1px solid var(--success-color)' : '1px solid var(--surface-border)',
              background: selectedStation === s.id ? 'rgba(26, 86, 219, 0.1)' : 'transparent',
              color: selectedStation === s.id ? 'var(--success-color)' : 'var(--text-secondary)',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
            }}>
              <Activity size={11} /> {s.name}
            </button>
          ))}
          <button onClick={() => { setModalType('station'); setIsModalOpen(true); }} style={{
            padding: '0.25rem 0.5rem', borderRadius: '3px', fontSize: '0.72rem', fontWeight: 700,
            border: '1px dashed var(--success-color)', background: 'transparent',
            color: 'var(--success-color)', cursor: 'pointer'
          }} title="Agregar área"><Plus size={11} /></button>
        </div>

        {/* Counters */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <span style={{ padding: '0.3rem 0.75rem', background: 'rgba(255,51,51,0.1)', color: 'var(--danger-color)', border: '1px solid rgba(255,51,51,0.3)', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>
            ⏳ {pendingOrders.length} pendientes
          </span>
          <span style={{ padding: '0.3rem 0.75rem', background: 'var(--success-bg)', color: 'var(--success-color)', border: '1px solid var(--success-border)', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>
            ✅ {readyOrders.length} listos
          </span>
        </div>
      </div>

      {/* ── Pending grid ── */}
      {pendingOrders.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <AlertCircle size={14} color="var(--danger-color)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger-color)' }}>⏳ En preparación ({pendingOrders.length})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {pendingOrders.map(row => (
              <OrderCard
                key={row.id} row={row} selectedStation={selectedStation}
                onItemStatus={handleItemStatus}
                onMarkReady={handleTerminadoClick}
                isMarking={!!markingReady[row.id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Ready grid ── */}
      {readyOrders.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <CheckCircle2 size={14} color="var(--success-color)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success-color)' }}>✅ Listos — esperando entrega ({readyOrders.length})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', opacity: 0.75 }}>
            {readyOrders.map(row => (
              <OrderCard
                key={row.id} row={row} selectedStation={selectedStation}
                onItemStatus={handleItemStatus}
                onMarkReady={handleTerminadoClick}
                isMarking={!!markingReady[row.id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!ordersLoading && filteredOrders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', opacity: 0.6 }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🍽️</div>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>Todo tranquilo por aquí</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Los nuevos pedidos aparecerán aquí automáticamente.</p>
        </div>
      )}
      {ordersLoading && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', opacity: 0.6 }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Cargando pedidos...</p>
        </div>
      )}

      {/* Station modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><PlusCircle size={18} /> Nueva Área</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="station-name" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Nombre del área</label>
                <input id="station-name" type="text" placeholder="Ej. Parrilla, Barra, Empaque, Fríos..." value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
