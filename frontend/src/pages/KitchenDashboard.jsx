import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useOrgKitchenOrders } from '../hooks/useOrgKitchenOrders';
import {
  Clock,
  CheckCircle2,
  ChefHat,
  Plus,
  PlusCircle,
  Monitor,
  Activity,
  Send,
  ChevronDown,
  Building2,
  AlertCircle
} from 'lucide-react';

export default function KitchenDashboard() {
  const { orders, refetch, isLoading: ordersLoading } = useOrgKitchenOrders();
  const [kitchens, setKitchens] = useState([]);
  const [stations, setStations] = useState([]);
  const [selectedKitchen, setSelectedKitchen] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('kitchen');
  const [newName, setNewName] = useState('');
  const [markingReady, setMarkingReady] = useState({});
  const [notification, setNotification] = useState(null);
  const [showKitchenDropdown, setShowKitchenDropdown] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const savedKitchenId = localStorage.getItem('kitchenId');
    if (savedKitchenId && kitchens.length > 0) {
      const k = kitchens.find(item => String(item.id) === String(savedKitchenId));
      if (k) handleSelectKitchen(k, false);
    }
  }, [kitchens.length]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-kitchen-dropdown]')) {
        setShowKitchenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const kRes = await apiClient.get('/kitchens/');
      setKitchens(kRes.data);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectKitchen = async (kitchen, shouldReload = true) => {
    setSelectedKitchen(kitchen);
    setSelectedStation(null);
    setShowKitchenDropdown(false);
    localStorage.setItem('kitchenId', kitchen.id);
    localStorage.setItem('kitchenName', kitchen.name);
    try {
      const sRes = await apiClient.get(`/stations/?kitchen_id=${kitchen.id}`);
      setStations(sRes.data);
      if (shouldReload) window.location.reload();
    } catch (err) {
      console.error('Error fetching stations:', err);
    }
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
    } catch (err) {
      console.error('Error creating:', err);
    }
  };

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
      await refetch();
      showNotification(
        `✅ Pedido #${orderNum} terminado${total ? ` — ${total}` : ''} — WhatsApp enviado al repartidor`,
        'success'
      );
    } catch (err) {
      console.error('Error marking order as ready:', err);
      showNotification('⚠️ Error al marcar el pedido como listo', 'error');
    } finally {
      setMarkingReady(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!selectedKitchen) return false;
    const kitchenStationIds = stations.map(s => s.id);
    if (selectedStation) return o.station_id === selectedStation;
    return kitchenStationIds.includes(o.station_id);
  });

  const pendingCount = filteredOrders.filter(o => o.status === 'pending').length;
  const readyCount   = filteredOrders.filter(o => o.status === 'ready').length;

  // ── Vista 1: Selección de cocinas ─────────────────────────────────────────────
  if (!selectedKitchen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="mono" style={{ fontSize: '1.2rem', fontWeight: 800 }}>PRODUCTION_SITES</h2>
          <button
            onClick={() => { setModalType('kitchen'); setIsModalOpen(true); }}
            className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
          >
            + REGISTRAR COCINA
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {kitchens.map(k => (
            <div key={k.id}
              onClick={() => handleSelectKitchen(k)}
              className="glass-panel"
              style={{ padding: '2rem', cursor: 'pointer', transition: 'transform 0.2s', borderLeft: '4px solid var(--primary-color)' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <ChefHat size={32} style={{ marginBottom: '1rem', color: 'var(--primary-color)' }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{k.name}</h3>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {k.address || 'Ubicación remota activa'}
              </p>
              <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)' }}></span>
                <span className="mono" style={{ fontSize: '0.7rem', fontWeight: 700 }}>STATE::ONLINE</span>
              </div>
            </div>
          ))}
          {kitchens.length === 0 && !loading && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
              <p>No hay cocinas registradas para este restaurante.</p>
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PlusCircle size={20} /> Nueva Ubicación
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="modal-close">×</button>
              </div>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Nombre de Sucursal</label>
                  <input type="text" placeholder="Ej. Sucursal Roma" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>Guardar</button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Vista 2: Monitor de cocina — tabla RECENT_TRANSACTIONS ────────────────────
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
            borderRadius: '8px', padding: '2rem', maxWidth: '380px', width: '90%',
            display: 'flex', flexDirection: 'column', gap: '1.5rem'
          }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800 }}>¿Confirmar pedido listo?</h3>
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
                  flex: 1, padding: '0.7rem', background: 'transparent',
                  border: '1px solid var(--surface-border)', borderRadius: '4px',
                  color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
                }}
              >Cancelar</button>
              <button
                onClick={handleConfirmReady}
                style={{
                  flex: 2, padding: '0.7rem', background: '#059669',
                  border: '1px solid #059669', borderRadius: '4px', color: '#fff',
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

      {/* Métricas */}
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

      {/* Tabla RECENT_TRANSACTIONS */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>

        {/* Header de la tabla */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>RECENT_TRANSACTIONS</h3>

            {/* Selector de cocina bajo el título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              {/* Dropdown cocina */}
              <div data-kitchen-dropdown style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowKitchenDropdown(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '3px',
                    border: '1px solid rgba(204,255,0,0.35)',
                    background: 'rgba(204,255,0,0.08)',
                    color: 'var(--primary-color)',
                    fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
                  }}
                >
                  <Building2 size={11} />
                  {selectedKitchen.name}
                  <ChevronDown size={11} style={{ transform: showKitchenDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {showKitchenDropdown && kitchens.length > 1 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
                    background: 'var(--surface-color)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '4px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    minWidth: '200px', overflow: 'hidden'
                  }}>
                    {kitchens.map(k => (
                      <button
                        key={k.id}
                        onClick={() => handleSelectKitchen(k)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          width: '100%', padding: '0.75rem 1rem',
                          background: String(k.id) === String(selectedKitchen.id) ? 'rgba(204,255,0,0.1)' : 'transparent',
                          border: 'none', borderBottom: '1px solid var(--surface-border)',
                          color: String(k.id) === String(selectedKitchen.id) ? 'var(--primary-color)' : 'var(--text-primary)',
                          fontWeight: String(k.id) === String(selectedKitchen.id) ? 800 : 500,
                          fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left'
                        }}
                      >
                        <ChefHat size={14} />
                        {k.name}
                        {String(k.id) === String(selectedKitchen.id) && (
                          <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--success-color)', fontWeight: 700 }}>ACTIVA</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabs de estaciones */}
              <button
                onClick={() => setSelectedStation(null)}
                style={{
                  padding: '0.15rem 0.6rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700,
                  border: selectedStation === null ? '1px solid var(--success-color)' : '1px solid var(--surface-border)',
                  background: selectedStation === null ? 'rgba(204,255,0,0.1)' : 'transparent',
                  color: selectedStation === null ? 'var(--success-color)' : 'var(--text-secondary)',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textTransform: 'uppercase'
                }}
              >
                <Monitor size={11} /> ALL
              </button>
              {stations.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStation(s.id)}
                  style={{
                    padding: '0.15rem 0.6rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700,
                    border: selectedStation === s.id ? '1px solid var(--success-color)' : '1px solid var(--surface-border)',
                    background: selectedStation === s.id ? 'rgba(204,255,0,0.1)' : 'transparent',
                    color: selectedStation === s.id ? 'var(--success-color)' : 'var(--text-secondary)',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textTransform: 'uppercase'
                  }}
                >
                  <Activity size={11} /> {s.name}
                </button>
              ))}
              <button
                onClick={() => { setModalType('station'); setIsModalOpen(true); }}
                style={{
                  padding: '0.15rem 0.5rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700,
                  border: '1px dashed var(--success-color)', background: 'transparent',
                  color: 'var(--success-color)', cursor: 'pointer'
                }}
                title="Agregar estación"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>

          {/* Botón volver + contador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleBackToSites}
              style={{
                padding: '0.4rem 0.8rem', borderRadius: '2px',
                border: '1px solid var(--surface-border)', background: 'var(--surface-color)',
                color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
              }}
            >
              ← Cocinas
            </button>
            <div className="mono" style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: 'rgba(255,51,51,0.1)', color: 'var(--danger-color)',
              border: '1px solid var(--danger-color)', borderRadius: '2px',
              fontWeight: 700, fontSize: '0.7rem'
            }}>
              {filteredOrders.length} ORDERS
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}># PEDIDO</th>
                <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NEGOCIO</th>
                <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ORDEN CON NOTA</th>
                <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NOMBRE</th>
                <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ESTATUS</th>
                <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACCIÓN</th>
              </tr>
            </thead>
            <tbody className="mono">
              {ordersLoading ? (
                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>FETCHING_DATA...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>NO_RECORDS_FOUND</td></tr>
              ) : filteredOrders.map((row, i) => {
                let badgeColor = 'var(--text-secondary)';
                if (row.status === 'pending')      badgeColor = 'var(--danger-color)';
                else if (row.status === 'ready')   badgeColor = 'var(--success-color)';
                else if (row.status === 'delivered') badgeColor = 'var(--primary-color)';

                const itemsText = row.items && row.items.length > 0
                  ? row.items.map(it => {
                      const noteStr = it.note ? ` ✎${it.note}` : '';
                      return `${it.product_name} x${it.quantity}${noteStr}`;
                    }).join(', ')
                  : '—';
                const notaText = row.notes ? ` ✎ ${row.notes}` : '';
                const ordenConNota = itemsText + notaText;
                const hasNote = row.notes || (row.items && row.items.some(it => it.note));
                const isMarking = markingReady[row.id];

                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '1rem 0', color: 'var(--success-color)' }}>
                      #{row.id.toString().padStart(4, '0')}
                    </td>
                    <td style={{ padding: '1rem 0' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.7rem', fontWeight: 700,
                        color: 'var(--primary-color)',
                        background: 'rgba(204,255,0,0.08)',
                        border: '1px solid rgba(204,255,0,0.25)',
                        borderRadius: '3px', padding: '0.15rem 0.5rem', whiteSpace: 'nowrap'
                      }}>
                        <Building2 size={10} />
                        {selectedKitchen.name}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 0', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={ordenConNota} style={{ color: hasNote ? '#f0c040' : 'var(--text-primary)' }}>
                        {ordenConNota}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 0', color: 'var(--text-primary)' }}>
                      {row.client_name || '—'}
                    </td>
                    <td style={{ padding: '1rem 0' }}>
                      <span style={{
                        fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '2px', fontWeight: 700,
                        border: `1px solid ${badgeColor}44`, color: badgeColor,
                        whiteSpace: 'nowrap', textTransform: 'uppercase'
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
                            border: 'none', borderRadius: '4px', color: '#fff',
                            fontWeight: 700, fontSize: '0.75rem',
                            cursor: isMarking ? 'not-allowed' : 'pointer',
                            opacity: isMarking ? 0.7 : 1,
                            display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap'
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

      {/* Modal de estación */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PlusCircle size={20} /> Nueva Estación
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Nombre de Estación</label>
                <input type="text" placeholder="Ej. Estación Pizzas" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
