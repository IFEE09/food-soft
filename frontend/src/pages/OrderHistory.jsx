import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { Download, Search, RefreshCw, BarChart2, TrendingUp, ShoppingBag, Clock } from 'lucide-react';

const STATUS_LABELS = {
  pending:   { label: 'PENDIENTE', color: '#ef4444' },
  ready:     { label: 'LISTO',     color: '#22c55e' },
  delivered: { label: 'ENTREGADO', color: '#3b82f6' },
};

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function toISO(d) { return d.toISOString().split('T')[0]; }

function getPeriod(key) {
  const now = new Date();
  const today = toISO(now);
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const s = toISO(y); return { from: s, to: s };
    }
    case 'week': {
      const w = new Date(now); w.setDate(w.getDate() - 6);
      return { from: toISO(w), to: today };
    }
    case 'month': {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toISO(m), to: today };
    }
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toISO(first), to: toISO(last) };
    }
    default: return null;
  }
}

// ── Gráfica de barras SVG simple ──────────────────────────────────────────────
function BarChart({ data }) {
  if (!data || data.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
      SIN_DATOS
    </div>
  );

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const W = 100; // porcentaje
  const barW = Math.max(4, Math.floor(W / data.length) - 2);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '100px', minWidth: `${data.length * (barW + 3)}px`, padding: '0 4px' }}>
        {data.map((d, i) => {
          const h = Math.max(4, Math.round((d.total / maxTotal) * 90));
          const label = d.date.slice(5); // MM-DD
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 auto', minWidth: `${barW}px` }} title={`${d.date}\n${d.count} pedidos\n$${d.total.toFixed(2)}`}>
              <div style={{ width: '100%', height: `${h}px`, background: 'var(--success-color)', borderRadius: '2px 2px 0 0', opacity: 0.85, transition: 'height 0.3s' }} />
              {data.length <= 14 && (
                <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', marginTop: '3px', whiteSpace: 'nowrap' }}>{label}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function OrderHistory() {
  const today = toISO(new Date());
  const [activePeriod, setActivePeriod] = useState('today');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo,   setDateTo]   = useState(today);
  const [status,   setStatus]   = useState('');
  const [orders,   setOrders]   = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const PERIODS = [
    { key: 'today',      label: 'Hoy' },
    { key: 'yesterday',  label: 'Ayer' },
    { key: 'week',       label: 'Últimos 7 días' },
    { key: 'month',      label: 'Este mes' },
    { key: 'last_month', label: 'Mes anterior' },
    { key: 'custom',     label: 'Personalizado' },
  ];

  const fetchAll = async (from, to, st) => {
    setIsLoading(true);
    setPage(1);
    try {
      const params = new URLSearchParams({ limit: 1000 });
      if (from) params.append('date_from', from);
      if (to)   params.append('date_to',   to);
      if (st)   params.append('status',    st);

      const [ordersRes, summaryRes] = await Promise.all([
        apiClient.get(`/orders/?${params.toString()}`),
        apiClient.get(`/orders/summary?${params.toString()}`),
      ]);
      setOrders(ordersRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar al montar
  useEffect(() => { fetchAll(dateFrom, dateTo, status); }, []);

  const handlePeriodClick = (key) => {
    setActivePeriod(key);
    if (key === 'custom') return; // el usuario elige fechas manualmente
    const p = getPeriod(key);
    if (p) {
      setDateFrom(p.from);
      setDateTo(p.to);
      fetchAll(p.from, p.to, status);
    }
  };

  const handleSearch = () => fetchAll(dateFrom, dateTo, status);

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo)   params.append('date_to',   dateTo);
      if (status)   params.append('status',    status);
      const res = await apiClient.get(`/orders/export/csv?${params.toString()}`, { responseType: 'blob' });
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

  // Paginación
  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const paged = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inputStyle = {
    background: 'var(--surface-color)',
    border: '1px solid var(--surface-border)',
    color: 'var(--text-primary)',
    padding: '0.45rem 0.75rem',
    borderRadius: '2px',
    fontSize: '0.82rem',
    fontFamily: 'JetBrains Mono, monospace',
  };

  const labelStyle = {
    fontSize: '0.62rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '0.3rem',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Atajos de periodo ── */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <p style={labelStyle}>Periodo</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: activePeriod === 'custom' ? '1rem' : 0 }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => handlePeriodClick(p.key)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '2px',
                border: activePeriod === p.key ? '1px solid var(--success-color)' : '1px solid var(--surface-border)',
                background: activePeriod === p.key ? 'var(--success-color)' : 'transparent',
                color: activePeriod === p.key ? '#000' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Rango personalizado + filtros */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>Desde</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePeriod('custom'); }} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>Hasta</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePeriod('custom'); }} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>Estatus</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, minWidth: '130px' }}>
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="ready">Listo</option>
              <option value="delivered">Entregado</option>
            </select>
          </div>
          <button onClick={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--success-color)', border: 'none', color: '#000', padding: '0.45rem 1rem', borderRadius: '2px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Search size={13} /> Buscar
          </button>
          <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: '1px solid var(--success-color)', color: 'var(--success-color)', padding: '0.45rem 1rem', borderRadius: '2px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Download size={13} /> CSV
          </button>
          <button onClick={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)', padding: '0.45rem 0.75rem', borderRadius: '2px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Métricas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1px', background: 'var(--surface-border)', border: '1px solid var(--surface-border)' }}>
        {[
          { icon: <ShoppingBag size={14} />, label: 'Total Pedidos',  value: summary?.total_orders ?? orders.length,                        color: 'var(--text-primary)' },
          { icon: <TrendingUp  size={14} />, label: 'Ingresos',       value: `$${(summary?.total_revenue ?? 0).toFixed(2)}`,                color: 'var(--success-color)' },
          { icon: <BarChart2   size={14} />, label: 'Ticket Promedio',value: `$${(summary?.avg_ticket ?? 0).toFixed(2)}`,                   color: 'var(--success-color)' },
          { icon: <Clock       size={14} />, label: 'Pendientes',     value: summary?.pending ?? orders.filter(o=>o.status==='pending').length, color: '#ef4444' },
          { icon: null,                      label: 'Entregados',     value: summary?.delivered ?? orders.filter(o=>o.status==='delivered').length, color: '#3b82f6' },
        ].map((m, i) => (
          <div key={i} style={{ background: 'var(--surface-color)', padding: '1rem 1.25rem' }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {m.icon}{m.label}
            </p>
            <p className="mono" style={{ fontSize: '1.6rem', fontWeight: 700, color: m.color, margin: 0 }}>{isLoading ? '…' : m.value}</p>
          </div>
        ))}
      </div>

      {/* ── Gráfica de ingresos por día ── */}
      {summary?.daily?.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <p style={{ ...labelStyle, marginBottom: '0.75rem' }}>Ingresos por día</p>
          <BarChart data={summary.daily} />
        </div>
      )}

      {/* ── Tabla ── */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Historial de Pedidos
          </h3>
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {orders.length} registros · pág {page}/{totalPages || 1}
          </span>
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                {['#', 'Fecha', 'Hora', 'Nombre', 'Productos', 'Dirección', 'Nota', 'Total', 'Estatus'].map(h => (
                  <th key={h} style={{ padding: '0.65rem 0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="mono">
              {isLoading ? (
                <tr><td colSpan="9" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>CARGANDO...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan="9" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>SIN_REGISTROS</td></tr>
              ) : paged.map((o, i) => {
                const st = STATUS_LABELS[o.status] || { label: o.status, color: 'var(--text-secondary)' };
                const fecha    = o.created_at ? new Date(o.created_at).toLocaleDateString('es-MX') : '—';
                const hora     = o.created_at ? new Date(o.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
                const productos = o.items?.map(it => `${it.product_name} x${it.quantity}`).join(', ') || '—';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover, rgba(255,255,255,0.03))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--success-color)', fontWeight: 700 }}>#{String(o.id).padStart(4, '0')}</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fecha}</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>{hora}</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{o.client_name || '—'}</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={productos}>{productos}</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.delivery_address || ''}>
                      {o.delivery_address ? <span title={o.delivery_address}>📍 {o.delivery_address}</span> : <span style={{ opacity: 0.3 }}>—</span>}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.notes ? <span style={{ color: '#f0c040' }} title={o.notes}>✎ {o.notes}</span> : <span style={{ opacity: 0.3 }}>—</span>}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--success-color)', fontWeight: 700, whiteSpace: 'nowrap' }}>${(o.total || 0).toFixed(2)}</td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      <span style={{ fontSize: '0.62rem', padding: '0.2rem 0.5rem', borderRadius: '2px', fontWeight: 700, border: `1px solid ${st.color}44`, color: st.color, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '0.35rem 0.75rem', borderRadius: '2px', border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
              ‹ Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = totalPages <= 7 ? i + 1 : (page <= 4 ? i + 1 : (page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i));
              return (
                <button key={pg} onClick={() => setPage(pg)}
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '2px', border: pg === page ? '1px solid var(--success-color)' : '1px solid var(--surface-border)', background: pg === page ? 'var(--success-color)' : 'transparent', color: pg === page ? '#000' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                  {pg}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: '0.35rem 0.75rem', borderRadius: '2px', border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
              Siguiente ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
