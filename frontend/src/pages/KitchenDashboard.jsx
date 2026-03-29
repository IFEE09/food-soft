import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Clock, CheckCircle, ChefHat, User } from 'lucide-react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPendingOrders();
    // In a real app, I would use WebSockets or a short polling interval here
  }, []);

  const fetchPendingOrders = async () => {
    try {
      const res = await apiClient.get('/orders/?status=pending');
      setOrders(res.data);
    } catch (err) {
      console.error("Error fetching kitchen orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsReady = async (orderId) => {
    try {
      await apiClient.put(`/orders/${orderId}`, { status: 'ready' });
      // Optimized update - remove from list
      setOrders(orders.filter(o => o.id !== orderId));
    } catch (err) {
      console.error("Error marking order as ready:", err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ChefHat size={28} /> Panel de Cocinas
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gestión de pedidos en tiempo real para Dark Kitchens</p>
        </div>
        <div style={{ 
          padding: '0.5rem 1rem', 
          backgroundColor: 'var(--danger-bg)', 
          color: 'var(--danger-color)', 
          border: '1px solid var(--danger-border)',
          borderRadius: '6px',
          fontWeight: 600,
          fontSize: '0.85rem'
        }}>
          {orders.length} Pedidos Pendientes
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando órdenes...</div>
      ) : orders.length === 0 ? (
        <div style={{ padding: '5rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', border: '1px dashed var(--surface-border)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No hay pedidos pendientes en este momento.</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {orders.map((order) => {
            const timeAgo = Math.floor((new Date() - new Date(order.created_at)) / 60000);
            const isLate = timeAgo > 15;

            return (
              <div key={order.id} className="glass-panel" style={{ 
                padding: '1.5rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.25rem',
                borderLeft: `4px solid ${isLate ? 'var(--danger-color)' : 'var(--primary-color)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>#{order.id.toString().padStart(3, '0')}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: isLate ? 'var(--danger-color)' : 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      <Clock size={14} /> {timeAgo} min esperando
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <User size={16} /> {order.client_name || 'Sin nombre'}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {order.items.map((item, idx) => (
                      <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{item.product_name}</span>
                        <span style={{ backgroundColor: 'var(--primary-color)', color: 'white', fontSize: '0.75rem', padding: '0.1rem 0.6rem', borderRadius: '50px', fontWeight: 700 }}>
                          x{item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={() => markAsReady(order.id)}
                  className="btn-primary" 
                  style={{ width: '100%', gap: '0.5rem', backgroundColor: '#059669' }}
                >
                  <CheckCircle size={18} /> Marcar como Listo
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
