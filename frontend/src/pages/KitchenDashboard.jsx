import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
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
  const [kitchens, setKitchens] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedKitchen, setSelectedKitchen] = useState(null); // null = All
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKitchenName, setNewKitchenName] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [kRes, oRes] = await Promise.all([
        apiClient.get('/kitchens/'),
        apiClient.get('/orders/?status=pending')
      ]);
      setKitchens(kRes.data);
      setOrders(oRes.data);
    } catch (err) {
      console.error("Error fetching kitchen data:", err);
    } finally {
      setIsLoading(false);
    }
  };

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
      setOrders(orders.filter(o => o.id !== orderId));
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
              padding: '0.6rem 1.2rem',
              borderRadius: '50px',
              border: selectedKitchen === null ? '1px solid var(--primary-color)' : '1px solid var(--surface-border)',
              background: selectedKitchen === null ? 'var(--primary-color)' : 'var(--surface-color)',
              color: selectedKitchen === null ? 'white' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Monitor size={16} /> Monitor General
          </button>
          
          {kitchens.map(k => (
            <button 
              key={k.id}
              onClick={() => setSelectedKitchen(k.id)}
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '50px',
                border: selectedKitchen === k.id ? '1px solid var(--primary-color)' : '1px solid var(--surface-border)',
                background: selectedKitchen === k.id ? 'var(--primary-color)' : 'var(--surface-color)',
                color: selectedKitchen === k.id ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Activity size={16} /> {k.name}
            </button>
          ))}
          
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '0.6rem',
              borderRadius: '50%',
              border: '1px dashed var(--primary-color)',
              background: 'none',
              color: 'var(--primary-color)',
              cursor: 'pointer'
            }}
            title="Agregar Estación"
          >
            <Plus size={18} />
          </button>
        </div>

        <div style={{ 
          padding: '0.5rem 1rem', 
          backgroundColor: 'var(--danger-bg)', 
          color: 'var(--danger-color)', 
          border: '1px solid var(--danger-border)',
          borderRadius: '50px',
          fontWeight: 700,
          fontSize: '0.8rem'
        }}>
          {filteredOrders.length} Pendientes
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
