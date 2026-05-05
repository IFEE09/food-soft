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
  MapPin,
  DollarSign,
  Send
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
  const [markingReady, setMarkingReady] = useState({}); // { [orderId]: true/false }
  const [notification, setNotification] = useState(null); // { msg, type }

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

  /**
   * Marca el pedido como listo Y envía WhatsApp al repartidor.
   * Usa el nuevo endpoint POST /orders/{id}/mark-ready.
   */
  const markAsReady = async (orderId) => {
    setMarkingReady(prev => ({ ...prev, [orderId]: true }));
    try {
      await apiClient.post(`/orders/${orderId}/mark-ready`);
      await refetch();
      showNotification(`✅ Pedido #${String(orderId).padStart(4, '0')} listo — WhatsApp enviado al repartidor`, 'success');
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

  // ── Vista 2: Monitor de cocina (contexto activo) ───────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Toast de notificación */}
      {notification && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          padding: '0.9rem 1.4rem',
          background: notification.type === 'success' ? 'rgba(5,150,105,0.95)' : 'rgba(220,38,38,0.95)',
          color: '#fff',
          borderRadius: '6px',
          fontWeight: 700,
          fontSize: '0.9rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          maxWidth: '420px'
        }}>
          <Send size={16} />
          {notification.msg}
        </div>
      )}

      {/* Header con tabs de estaciones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleBackToSites}
            style={{ padding: '0.6rem', borderRadius: '2px', border: '1px solid var(--surface-border)', background: 'var(--surface-color)', cursor: 'pointer' }}
            title="Volver a Sucursales"
          >
            ←
          </button>
          <h2 className="mono" style={{ margin: '0 1rem 0 0.5rem', fontSize: '1rem', fontWeight: 800 }}>{selectedKitchen.name}</h2>

          <button
            onClick={() => setSelectedStation(null)}
            style={{
              padding: '0.6rem 1rem', borderRadius: '2px',
              border: selectedStation === null ? '1px solid var(--success-color)' : '1px solid var(--surface-border)',
              background: selectedStation === null ? 'rgba(204,255,0,0.1)' : 'var(--surface-color)',
              color: selectedStation === null ? 'var(--success-color)' : 'var(--text-secondary)',
              fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase'
            }}
          >
            <Monitor size={14} /> MASTER_SCREEN
          </button>

          {stations.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStation(s.id)}
              style={{
                padding: '0.6rem 1rem', borderRadius: '2px',
                border: selectedStation === s.id ? '1px solid var(--success-color)' : '1px solid var(--surface-border)',
                background: selectedStation === s.id ? 'rgba(204,255,0,0.1)' : 'var(--surface-color)',
                color: selectedStation === s.id ? 'var(--success-color)' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase'
              }}
            >
              <Activity size={14} /> {s.name}
            </button>
          ))}

          <button
            onClick={() => { setModalType('station'); setIsModalOpen(true); }}
            style={{ padding: '0.6rem', borderRadius: '2px', border: '1px dashed var(--success-color)', background: 'transparent', color: 'var(--success-color)', cursor: 'pointer' }}
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="mono" style={{ padding: '0.4rem 0.75rem', backgroundColor: 'rgba(255,51,51,0.1)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', borderRadius: '2px', fontWeight: 700, fontSize: '0.7rem' }}>
          {filteredOrders.length} PENDING_TASKS
        </div>
      </div>

      {/* Contenido principal */}
      {ordersLoading ? (
        <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <ChefHat size={40} className="animate-pulse" style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p>Sincronizando estaciones de {selectedKitchen.name}...</p>
        </div>
      ) : stations.length === 0 ? (
        <div style={{ padding: '8rem 2rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', border: '1px dashed var(--primary-color)', borderRadius: '12px' }}>
          <Activity size={48} style={{ color: 'var(--primary-color)', marginBottom: '1.5rem', opacity: 0.4 }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Configuración Inicial Requerida</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto 2rem' }}>
            Esta ubicación aún no tiene estaciones de trabajo registradas. Para empezar a recibir y monitorear pedidos, debes crear al menos una estación.
          </p>
          <button
            onClick={() => { setModalType('station'); setIsModalOpen(true); }}
            className="btn-primary" style={{ gap: '0.5rem' }}
          >
            <Plus size={18} /> Crear Primera Estación
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ padding: '8rem 2rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', border: '1px dashed var(--surface-border)', borderRadius: '12px' }}>
          <CheckCircle2 size={48} style={{ color: 'var(--success-color)', marginBottom: '1.5rem', opacity: 0.2 }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Línea de producción despejada</h3>
          <p style={{ color: 'var(--text-secondary)' }}>No hay pedidos pendientes en esta configuración.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredOrders.map((order) => {
            const timeAgo = Math.floor((new Date() - new Date(order.created_at)) / 60000);
            const isLate = timeAgo > 15;
            const isMarking = markingReady[order.id];

            return (
              <div key={order.id} className="glass-panel" style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                borderTop: `4px solid ${isLate ? 'var(--danger-color)' : 'var(--primary-color)'}`
              }}>
                {/* Header de la tarjeta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-color)', margin: 0 }}>
                      #{order.id.toString().padStart(4, '0')}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: isLate ? 'var(--danger-color)' : 'var(--text-secondary)', fontWeight: 600, marginTop: '0.25rem' }}>
                      <Clock size={14} /> {timeAgo} min
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{order.client_name || 'Sin nombre'}</div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      {stations.find(s => s.id === order.station_id)?.name || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Productos */}
                <div style={{ flex: 1 }}>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: 0, padding: 0 }}>
                    {order.items && order.items.map((item, idx) => (
                      <li key={idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.6rem 0.75rem',
                        backgroundColor: 'var(--neutral-bg)',
                        borderRadius: '4px',
                        border: '1px solid var(--surface-border)'
                      }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.product_name}</span>
                        <span style={{ backgroundColor: 'var(--primary-color)', color: 'white', fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '4px', fontWeight: 800 }}>
                          x{item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Nota especial */}
                {order.notes && (
                  <div style={{
                    padding: '0.6rem 0.75rem',
                    backgroundColor: 'rgba(240,192,64,0.1)',
                    border: '1px solid rgba(240,192,64,0.3)',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    color: '#f0c040'
                  }}>
                    ✎ {order.notes}
                  </div>
                )}

                {/* Dirección de entrega */}
                {order.delivery_address && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    backgroundColor: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <MapPin size={14} style={{ marginTop: '0.1rem', flexShrink: 0, color: '#818cf8' }} />
                    <span>{order.delivery_address}</span>
                  </div>
                )}

                {/* Total */}
                {order.total > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    fontSize: '0.9rem', fontWeight: 700, color: 'var(--success-color)'
                  }}>
                    <DollarSign size={14} />
                    ${order.total.toFixed(2)}
                  </div>
                )}

                {/* Botón Listo */}
                <button
                  onClick={() => markAsReady(order.id)}
                  disabled={isMarking}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    gap: '0.5rem',
                    backgroundColor: isMarking ? '#047857' : '#059669',
                    borderColor: isMarking ? '#047857' : '#059669',
                    opacity: isMarking ? 0.7 : 1,
                    cursor: isMarking ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    padding: '0.75rem'
                  }}
                >
                  {isMarking ? (
                    <>⏳ Enviando WhatsApp...</>
                  ) : (
                    <><CheckCircle2 size={18} /> Listo — Notificar Repartidor</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

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
