import { Clock, CheckCircle2, ChefHat, User } from 'lucide-react';
import { apiClient } from '../api/client';
import { useOrgKitchenOrders } from '../hooks/useOrgKitchenOrders';

export default function CookDashboard() {
  const { orders, refetch, isLoading } = useOrgKitchenOrders();

  const markAsReady = async (orderId) => {
    try {
      await apiClient.put(`/orders/${orderId}`, { status: 'ready' });
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>KITCHEN_TERMINAL</h2>
          <p className="mono" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Pedidos entrantes (incl. WhatsApp)</p>
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
          {orders.length} QUEUED_TASKS
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <ChefHat size={40} className="animate-pulse" style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p>Sincronizando pedidos…</p>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ padding: '8rem 2rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', border: '1px dashed var(--surface-border)', borderRadius: '12px' }}>
          <ChefHat size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', opacity: 0.2 }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Sin pedidos en cola</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
            Los pedidos confirmados por WhatsApp aparecerán aquí al instante.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {orders.map((order) => {
            const timeAgo = Math.floor((new Date() - new Date(order.created_at)) / 60000);
            const isLate = timeAgo > 15;
            return (
              <div key={order.id} className="glass-panel" style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                borderTop: `4px solid ${isLate ? 'var(--danger-color)' : 'var(--primary-color)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="mono" style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--success-color)' }}>
                      #{order.id.toString().padStart(3, '0')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: isLate ? 'var(--danger-color)' : 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      <Clock size={14} /> {timeAgo} min
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {order.client_name || 'Cliente'} <User size={14} />
                  </div>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                  {(order.items || []).map((item, idx) => (
                    <li key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span className="mono" style={{
                        backgroundColor: 'var(--surface-border)',
                        color: 'var(--success-color)',
                        fontWeight: 800,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '1px',
                        fontSize: '0.7rem'
                      }}>x{item.quantity}</span>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        {item.product_name}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '0.5rem', fontSize: '0.8rem', gap: '0.5rem', backgroundColor: '#059669', borderColor: '#059669' }}
                  onClick={() => markAsReady(order.id)}
                >
                  <CheckCircle2 size={18} /> Marcar listo
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
