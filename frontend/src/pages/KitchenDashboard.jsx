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
  Activity 
} from 'lucide-react';

export default function KitchenDashboard() {
  const { orders, refetch, isLoading: ordersLoading } = useOrgKitchenOrders();
  const [kitchens, setKitchens] = useState([]);
  const [selectedKitchen, setSelectedKitchen] = useState(null); // null = All
  const [kitchensLoading, setKitchensLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKitchenName, setNewKitchenName] = useState('');

  const isLoading = ordersLoading || kitchensLoading;

  useEffect(() => {
    (async () => {
      try {
        const kRes = await apiClient.get('/kitchens/');
        setKitchens(kRes.data);
      } catch (err) {
        console.error('Error fetching kitchens:', err);
      } finally {
        setKitchensLoading(false);
      }
    })();
  }, []);

  const handleCreateKitchen = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/kitchens/', { name: newKitchenName });
      setKitchens([...kitchens, res.data]);
      setIsModalOpen(false);
      setNewKitchenName('');
    } catch (err) {
      console.error("Error creating kitchen station:", err);
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

  const filteredOrders = selectedKitchen 
    ? orders.filter(o => o.kitchen_id === selectedKitchen)
    : orders;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Dynamic Tabs for Kitchen Stations */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem' 
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setSelectedKitchen(null)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '2px',
                border: selectedKitchen === null ? '1px solid var(--success-color)' : '1px solid var(--surface-border)',
                background: selectedKitchen === null ? 'rgba(204,255,0,0.1)' : 'var(--surface-color)',
                color: selectedKitchen === null ? 'var(--success-color)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            >
              <Monitor size={14} /> MASTER_MONITOR
            </button>
          
          {kitchens.map(k => (
            <button 
              key={k.id}
              onClick={() => setSelectedKitchen(k.id)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '2px',
                border: selectedKitchen === k.id ? '1px solid var(--success-color)' : '1px solid var(--surface-border)',
                background: selectedKitchen === k.id ? 'rgba(204,255,0,0.1)' : 'var(--surface-color)',
                color: selectedKitchen === k.id ? 'var(--success-color)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            >
              <Activity size={14} /> {k.name}
            </button>
          ))}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              onClick={() => setIsModalOpen(true)}
              style={{
                padding: '0.6rem',
                borderRadius: '2px',
                border: '1px dashed var(--success-color)',
                background: 'transparent',
                color: 'var(--success-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title="Add Node"
            >
              <Plus size={16} />
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)', opacity: 0.8 }}>
              Agrega tus cocinas
            </span>
          </div>
        </div>

        <div className="mono" style={{ 
          padding: '0.4rem 0.75rem', 
          backgroundColor: 'rgba(255,51,51,0.1)', 
          color: 'var(--danger-color)', 
          border: '1px solid var(--danger-color)',
          borderRadius: '2px',
          fontWeight: 700,
          fontSize: '0.7rem',
          textTransform: 'uppercase'
        }}>
          {filteredOrders.length} PENDING_TASKS
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <ChefHat size={40} className="animate-pulse" style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p>Sincronizando línea de producción...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ padding: '8rem 2rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', border: '1px dashed var(--surface-border)', borderRadius: '12px' }}>
          <ChefHat size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', opacity: 0.2 }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No hay pedidos en cola</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
            {selectedKitchen ? `La estación ${kitchens.find(k => k.id === selectedKitchen)?.name} está limpia.` : "El monitor general no reporta actividades pendientes."}
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {filteredOrders.map((order) => {
            // Minutes since creation
            const timeAgo = Math.floor((new Date() - new Date(order.created_at)) / 60000);
            const isLate = timeAgo > 15;

            return (
              <div key={order.id} className="glass-panel" style={{ 
                padding: '1.5rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.25rem',
                borderTop: `4px solid ${isLate ? 'var(--danger-color)' : 'var(--primary-color)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-color)', margin: 0 }}>#{order.id.toString().padStart(3, '0')}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: isLate ? 'var(--danger-color)' : 'var(--text-secondary)', fontWeight: 600, marginTop: '0.25rem' }}>
                      <Clock size={14} /> {timeAgo} min
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                       {order.client_name || 'Generic'} <User size={14} />
                    </div>
                    {kitchens.find(k => k.id === order.kitchen_id) && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Station: {kitchens.find(k => k.id === order.kitchen_id)?.name}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {order.items.map((item, idx) => (
                      <li key={idx} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0.6rem 0.75rem', 
                        backgroundColor: '#F8FAFC', 
                        borderRadius: '6px',
                        border: '1px solid #F1F5F9'
                      }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>{item.product_name}</span>
                        <span style={{ backgroundColor: 'var(--primary-color)', color: 'white', fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '4px', fontWeight: 800 }}>
                          x{item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={() => markAsReady(order.id)}
                  className="btn-primary" 
                  style={{ width: '100%', gap: '0.5rem', backgroundColor: '#059669', borderColor: '#059669' }}
                >
                  <CheckCircle2 size={18} /> Marcar como Listo
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Kitchen Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PlusCircle size={20} /> Nueva Estación
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">×</button>
            </div>
            
            <form onSubmit={handleCreateKitchen} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Nombre de la Cocina/Estación</label>
                <input 
                  type="text" 
                  placeholder="Ej. Barra Fría, Parrilla, Pizza..." 
                  value={newKitchenName}
                  onChange={(e) => setNewKitchenName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1px solid var(--surface-border)', borderRadius: '6px' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  Agregar Estación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
