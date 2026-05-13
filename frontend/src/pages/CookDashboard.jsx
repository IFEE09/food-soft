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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.2rem', letterSpacing: '-0.02em' }}>
            Mi área de trabajo
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Pedidos entrantes en tiempo real
          </p>
        </div>
        {orders.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            background: 'rgba(200,16,46,0.08)',
            color: 'var(--danger-color)',
            border: '1px solid var(--danger-border)',
            borderRadius: '9999px',
            fontWeight: 700,
            fontSize: '0.8rem',
          }}>
            <span className="pulse-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--danger-color)', flexShrink: 0 }} />
            {orders.length} {orders.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'}
          </span>
        )}
      </div>

      {/* Estados */}
      {isLoading ? (
        <div style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⏳</div>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Sincronizando pedidos…</p>
        </div>
      ) : orders.length === 0 ? (
        <div style={{
          padding: '6rem 2rem', textAlign: 'center',
          background: 'var(--surface-color)',
          border: '1px solid var(--surface-border)',
          borderRadius: '16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
        }}>
          <span style={{ fontSize: '3.5rem', lineHeight: 1 }}>🍽️</span>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.5rem 0 0.25rem', letterSpacing: '-0.01em' }}>
            Todo tranquilo por aquí
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '380px', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
            Los nuevos pedidos de WhatsApp aparecerán aquí al instante.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.25rem'
        }}>
          {orders.map((order) => {
            const timeAgo = Math.floor((new Date() - new Date(order.created_at)) / 60000);
            const isLate  = timeAgo > 15;
            const isWarn  = timeAgo > 7;
            const borderColor = isLate ? 'var(--danger-color)' : isWarn ? 'var(--warning-color)' : 'var(--accent-blue)';

            return (
              <div key={order.id} style={{
                background: 'var(--surface-color)',
                border: '1px solid var(--surface-border)',
                borderTop: `3px solid ${borderColor}`,
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                animation: 'cardEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
                transition: 'box-shadow 0.15s ease'
              }}>

                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: borderColor, letterSpacing: '-0.02em' }}>
                      #{order.id.toString().padStart(4, '0')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: isLate ? 'var(--danger-color)' : 'var(--text-secondary)', marginTop: '0.2rem', fontWeight: isLate ? 700 : 400 }}>
                      <Clock size={13} /> {timeAgo} min {isLate ? '· ¡Urgente!' : isWarn ? '· Demorado' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <User size={14} color="var(--text-secondary)" />
                    {order.client_name || 'Cliente'}
                  </div>
                </div>

                {/* Items */}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  {(order.items || []).map((item, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent-blue)',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        flexShrink: 0
                      }}>×{item.quantity}</span>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
                        {item.product_name}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: '0.875rem', gap: '0.5rem', background: 'var(--success-color)', width: '100%' }}
                  onClick={() => markAsReady(order.id)}
                >
                  <CheckCircle2 size={17} /> ✓ Marcar como listo
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
