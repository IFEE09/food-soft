import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Clock, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [supplies, setSupplies] = useState([]);
  const [orders, setOrders] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [suppliesRes, ordersRes] = await Promise.all([
        apiClient.get('/supplies/?limit=5'),
        apiClient.get('/orders/?limit=8')
      ]);
      setSupplies(suppliesRes.data);
      setOrders(ordersRes.data);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Metrics Row - Only Pending and Ready as requested */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '4px solid var(--danger-color)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Órdenes Pendientes</h4>
             <AlertCircle size={18} style={{ color: 'var(--danger-color)' }} />
           </div>
           <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
             <h3 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--danger-color)', margin: 0, lineHeight: 1 }}>{pendingCount}</h3>
             <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>En cola hoy</span>
           </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '4px solid #10B981' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Órdenes Listas</h4>
             <CheckCircle2 size={18} style={{ color: '#10B981' }} />
           </div>
           <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
             <h3 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#10B981', margin: 0, lineHeight: 1 }}>{readyCount}</h3>
             <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Por entregar</span>
           </div>
        </div>

      </div>

      {/* Tables and Charts Area */}
      <div className="dashboard-grid">
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Órdenes Recientes</h3>
            <button 
              onClick={() => navigate('/dashboard/kitchen')}
              style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              Monitor de cocina <ArrowUpRight size={14} />
            </button>
          </div>
          
          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Orden</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Cliente</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Entrada</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Salida</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center' }}>Cargando datos...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center' }}>No hay órdenes recientes.</td></tr>
                ) : orders.map((row, i) => {
                  let badgeBg = '#F1F5F9';
                  let badgeColor = 'var(--text-primary)';
                  
                  if (row.status === 'pending') {
                    badgeBg = 'var(--danger-bg)';
                    badgeColor = 'var(--danger-color)';
                  } else if (row.status === 'ready') {
                    badgeBg = '#FEF9C3'; 
                    badgeColor = '#CA8A04'; 
                  } else if (row.status === 'delivered') {
                    badgeBg = '#ECFDF5'; 
                    badgeColor = '#059669'; 
                  }

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '1rem 0', fontWeight: 600, color: 'var(--primary-color)' }}>
                        #{row.id.toString().padStart(3, '0')}
                      </td>
                      <td style={{ padding: '1rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>{row.client_name || 'Generic'}</td>
                      <td style={{ padding: '1rem 0', fontWeight: 500 }}>
                        {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>
                        {row.ready_at ? new Date(row.ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td style={{ padding: '1rem 0' }}>
                        <span style={{ 
                          fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 600,
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          whiteSpace: 'nowrap',
                          textTransform: 'capitalize'
                        }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Resumen Semanal</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', flex: 1 }}>Datos actualizados desde el monitor.</p>
              <div style={{ height: '80px', borderBottom: '1px dashed var(--surface-border)', borderLeft: '1px solid var(--surface-border)' }}></div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Stock de Cocina</h3>
                <span 
                  style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => navigate('/dashboard/supplies')}
                >
                  Gestionar
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {isLoading ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cargando...</p>
                ) : supplies.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sin insumos registrados.</p>
                ) : supplies.map((stock, i) => {
                  const isLow = stock.quantity <= stock.min_quantity;
                  const isCritical = stock.quantity <= (stock.min_quantity / 2);
                  const statusColor = isCritical ? 'var(--danger-color)' : isLow ? '#CA8A04' : 'var(--text-secondary)';
                  const statusLabel = isCritical ? 'Crítico' : isLow ? 'Bajo' : 'Normal';

                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '0.5rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stock.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stock.quantity} {stock.unit}</div>
                      </div>
                      <div style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 700, 
                        color: statusColor,
                        textTransform: 'uppercase',
                        backgroundColor: isCritical ? 'var(--danger-bg)' : isLow ? '#FFFBEB' : '#F1F5F9',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px'
                      }}>
                        {statusLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        </div>

      </div>

    </div>
  );
}
