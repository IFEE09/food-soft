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
      
      {/* Metrics Row - Brutalist Style */}
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

      {/* Tables Area */}
      <div className="dashboard-grid">
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>RECENT_TRANSACTIONS</h3>
            <button 
              onClick={() => navigate('/dashboard/kitchen')}
              className="mono"
              style={{ background: 'transparent', border: 'none', color: 'var(--success-color)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase' }}
            >
              System Monitor <ArrowUpRight size={14} />
            </button>
          </div>
          
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</th>
                  <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</th>
                  <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timestamp</th>
                  <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ready</th>
                  <th style={{ padding: '1rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                </tr>
              </thead>
              <tbody className="mono">
                {isLoading ? (
                  <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>FETCHING_DATA...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>NO_RECORDS_FOUND</td></tr>
                ) : orders.map((row, i) => {
                  let badgeBg = 'transparent';
                  let badgeColor = 'var(--text-secondary)';
                  let borderColor = 'var(--surface-border)';
                  
                  if (row.status === 'pending') {
                    badgeColor = 'var(--danger-color)';
                    borderColor = 'var(--danger-color)';
                  } else if (row.status === 'ready') {
                    badgeColor = 'var(--success-color)';
                    borderColor = 'var(--success-color)';
                  } else if (row.status === 'delivered') {
                    badgeColor = 'var(--primary-color)';
                    borderColor = 'var(--primary-color)';
                  }

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '1rem 0', color: 'var(--success-color)' }}>
                        #{row.id.toString().padStart(4, '0')}
                      </td>
                      <td style={{ padding: '1rem 0', color: 'var(--text-primary)' }}>{row.client_name || 'WEB_DIRECT'}</td>
                      <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>
                        {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </td>
                      <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>
                        {row.ready_at ? new Date(row.ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                      </td>
                      <td style={{ padding: '1rem 0' }}>
                        <span style={{ 
                          fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '2px', fontWeight: 700,
                          border: `1px solid ${badgeColor}44`,
                          color: badgeColor,
                          whiteSpace: 'nowrap',
                          textTransform: 'uppercase'
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
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>WEEKLY_ANALYTICS</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', flex: 1, fontFamily: 'JetBrains Mono, monospace' }}>STREAM_ACTIVE: Latency 0ms</p>
              <div style={{ height: '60px', borderBottom: '1px dashed var(--surface-border)', borderLeft: '1px solid var(--surface-border)' }}></div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>INVENTORY_STATUS</h3>
                <span 
                  className="mono"
                  style={{ fontSize: '0.65rem', color: 'var(--success-color)', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}
                  onClick={() => navigate('/dashboard/supplies')}
                >
                  Configure
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {isLoading ? (
                  <p className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SCANNING...</p>
                ) : supplies.length === 0 ? (
                  <p className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>EMPTY_SLOTS</p>
                ) : supplies.map((stock, i) => {
                  const isLow = stock.quantity <= stock.min_quantity;
                  const isCritical = stock.quantity <= (stock.min_quantity / 2);
                  const statusColor = isCritical ? 'var(--danger-color)' : isLow ? '#F59E0B' : 'var(--text-secondary)';
                  const statusLabel = isCritical ? 'CRITICAL' : isLow ? 'LOW' : 'OK';

                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '0.5rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{stock.name}</div>
                        <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{stock.quantity} {stock.unit}</div>
                      </div>
                      <div className="mono" style={{ 
                        fontSize: '0.6rem', 
                        fontWeight: 700, 
                        color: statusColor,
                        border: `1px solid ${statusColor}44`,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '2px'
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
