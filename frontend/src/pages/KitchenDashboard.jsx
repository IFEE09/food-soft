import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useOrgKitchenOrders } from '../hooks/useOrgKitchenOrders';
import { 
  Clock, 
  CheckCircle2, 
  ChefHat, 
  User, 
  Plus, 
  PlusCircle, 
  Monitor, 
  Activity,
  Building2
} from 'lucide-react';

export default function KitchenDashboard() {
  const { orders, refetch, isLoading: ordersLoading } = useOrgKitchenOrders();
  const [kitchens, setKitchens] = useState([]);
  const [stations, setStations] = useState([]);
  const [selectedKitchen, setSelectedKitchen] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null); // null = Master for that kitchen
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('kitchen'); // kitchen or station
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    // Check if we are already in a kitchen context on load
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
    
    // Set global context for sidebar
    localStorage.setItem('kitchenId', kitchen.id);
    localStorage.setItem('kitchenName', kitchen.name);

    try {
      const sRes = await apiClient.get('/stations/');
      setStations(sRes.data.filter(s => s.kitchen_id === kitchen.id));
      
      if (shouldReload) {
        window.location.reload();
      }
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
      console.error("Error creating:", err);
    }
  };

  const markAsReady = async (orderId) => {
    try {
      await apiClient.put(`/orders/${orderId}`, { status: 'ready' });
      await refetch();
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!selectedKitchen) return false;
    const kitchenStationIds = stations.map(s => s.id);
    if (selectedStation) {
        return o.station_id === selectedStation;
    }
    return kitchenStationIds.includes(o.station_id);
  });

  // VIEW 1: SELECTION OF SITES
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
              style={{ 
                padding: '2rem', cursor: 'pointer', transition: 'transform 0.2s',
                borderLeft: '4px solid var(--primary-color)'
              }}
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

        {/* Modal Selection */}
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

  // VIEW 2: KITCHEN MONITOR (CONTEXT ACTIVE)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
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

      {ordersLoading ? (
        <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <ChefHat size={40} className="animate-pulse" style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p>Sincronizando estaciones de {selectedKitchen.name}...</p>
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

            return (
              <div key={order.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderTop: `4px solid ${isLate ? 'var(--danger-color)' : 'var(--primary-color)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-color)', margin: 0 }}>#{order.id.toString().padStart(3, '0')}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: isLate ? 'var(--danger-color)' : 'var(--text-secondary)', fontWeight: 600, marginTop: '0.25rem' }}>
                      <Clock size={14} /> {timeAgo} min
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{order.client_name || 'Generic'}</div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Station: {stations.find(s => s.id === order.station_id)?.name || 'N/A'}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {order.items.map((item, idx) => (
                      <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', backgroundColor: 'var(--neutral-bg)', borderRadius: '4px', border: '1px solid var(--surface-border)' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.product_name}</span>
                        <span style={{ backgroundColor: 'var(--primary-color)', color: 'white', fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '4px', fontWeight: 800 }}>x{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button onClick={() => markAsReady(order.id)} className="btn-primary" style={{ width: '100%', gap: '0.5rem', backgroundColor: '#059669', borderColor: '#059669' }}>
                  <CheckCircle2 size={18} /> Marcar como Listo
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Station Modal */}
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
