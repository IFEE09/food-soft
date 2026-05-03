import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Download, Search, RefreshCw } from 'lucide-react';

const STATUS_LABELS = {
  pending: { label: 'PENDIENTE', color: 'var(--danger-color)' },
  ready:   { label: 'LISTO',     color: 'var(--success-color)' },
  delivered: { label: 'ENTREGADO', color: 'var(--primary-color)' },
};

export default function OrderHistory() {
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo,   setDateTo]   = useState(today);
  const [status,   setStatus]   = useState('');
  const [orders,   setOrders]   = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: 500 });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo)   params.append('date_to',   dateTo);
      if (status)   params.append('status',    status);
      const res = await apiClient.get(`/orders/?${params.toString()}`);
      setOrders(res.data);
      setTotal(res.data.reduce((acc, o) => acc + (o.total || 0), 0));
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo)   params.append('date_to',   dateTo);
      if (status)   params.append('status',    status);
      const res = await apiClient.get(`/orders/export/csv?${params.toString()}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pedidos_${dateFrom}_${dateTo}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting CSV:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Filtros */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '2px', fontSize: '0.85rem', fontFamily: 'JetBrains Mono, monospace' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '2px', fontSize: '0.85rem', fontFamily: 'JetBrains Mono, monospace' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Estatus</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '2px', fontSize: '0.85rem', fontFamily: 'JetBrains Mono, monospace', minWidth: '140px' }}
          >
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="ready">Listo</option>
            <option value="delivered">Entregado</option>
          </select>
        </div>
        <button
          onClick={fetchOrders}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--success-color)', border: 'none', color: '#000', padding: '0.5rem 1rem', borderRadius: '2px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          <Search size={14} /> Buscar
        </button>
        <button
          onClick={handleExportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: '1px solid var(--success-color)', color: 'var(--success-color)', padding: '0.5rem 1rem', borderRadius: '2px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          <Download size={14} /> Exportar CSV
        </button>
        <button
          onClick={fetchOrders}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)', padding: '0.5rem 0.75rem', borderRadius: '2px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Métricas rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: 'var(--surface-border)', border: '1px solid var(--surface-border)' }}>
        <div style={{ background: 'var(--surface-color)', padding: '1rem 1.25rem' }}>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.4rem' }}>Total Pedidos</p>
          <p className="mono" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{orders.length}</p>
        </div>
        <div style={{ background: 'var(--surface-color)', padding: '1rem 1.25rem' }}>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.4rem' }}>Ingresos</p>
          <p className="mono" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success-color)', margin: 0 }}>${total.toFixed(2)}</p>
        </div>
        <div style={{ background: 'var(--surface-color)', padding: '1rem 1.25rem' }}>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.4rem' }}>Pendientes</p>
          <p className="mono" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--danger-color)', margin: 0 }}>{orders.filter(o => o.status === 'pending').length}</p>
        </div>
        <div style={{ background: 'var(--surface-color)', padding: '1rem 1.25rem' }}>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.4rem' }}>Entregados</p>
          <p className="mono" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary-color)', margin: 0 }}>{orders.filter(o => o.status === 'delivered').length}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>HISTORIAL DE PEDIDOS</h3>
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{orders.length} registros</span>
        </div>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                {['# PEDIDO', 'FECHA', 'HORA', 'NOMBRE', 'PRODUCTOS', 'NOTA', 'TOTAL', 'ESTATUS'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="mono">
              {isLoading ? (
                <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>CARGANDO...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>SIN_REGISTROS</td></tr>
              ) : orders.map((o, i) => {
                const st = STATUS_LABELS[o.status] || { label: o.status, color: 'var(--text-secondary)' };
                const fecha = o.created_at ? new Date(o.created_at).toLocaleDateString('es-MX') : '—';
                const hora  = o.created_at ? new Date(o.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
                const productos = o.items?.map(it => `${it.product_name} x${it.quantity}`).join(', ') || '—';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--success-color)' }}>#{String(o.id).padStart(4, '0')}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{fecha}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{hora}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>{o.client_name || '—'}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={productos}>{productos}</td>
                    <td style={{ padding: '0.75rem 0.5rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.notes ? <span style={{ color: '#f0c040' }} title={o.notes}>✎ {o.notes}</span> : <span style={{ opacity: 0.3 }}>—</span>}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--success-color)', fontWeight: 700 }}>${(o.total || 0).toFixed(2)}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '2px', fontWeight: 700, border: `1px solid ${st.color}44`, color: st.color, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
