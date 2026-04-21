import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  LogIn,
  UserPlus,
  ShieldCheck
} from 'lucide-react';

const ACTION_LABELS = {
  create: 'Creación',
  update: 'Actualización',
  delete: 'Eliminación',
  login: 'Inicio de sesión',
};

const ENTITY_LABELS = {
  supply: 'Insumo',
  menu_item: 'Platillo',
  order: 'Orden',
  kitchen: 'Cocina',
  user: 'Usuario',
  auth: 'Autenticación',
};

const actionStyle = (action) => {
  switch (action) {
    case 'create': return { bg: '#ECFDF5', color: '#10B981', Icon: Plus };
    case 'update': return { bg: '#EFF6FF', color: '#2563EB', Icon: Pencil };
    case 'delete': return { bg: '#FEF2F2', color: '#EF4444', Icon: Trash2 };
    case 'login':  return { bg: '#F5F3FF', color: '#7C3AED', Icon: LogIn };
    default:       return { bg: '#F1F5F9', color: '#64748B', Icon: Activity };
  }
};

const formatDate = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch {
    return iso;
  }
};

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (filterEntity) params.entity_type = filterEntity;
      if (filterAction) params.action = filterAction;
      const res = await apiClient.get('/activity-logs/', { params });
      setLogs(res.data || []);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEntity, filterAction]);

  const filteredLogs = logs.filter((log) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      (log.description || '').toLowerCase().includes(q) ||
      (log.user_name || '').toLowerCase().includes(q) ||
      (log.entity_type || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q)
    );
  });

  const createsCount = logs.filter(l => l.action === 'create').length;
  const updatesCount = logs.filter(l => l.action === 'update').length;
  const deletesCount = logs.filter(l => l.action === 'delete').length;
  const loginsCount  = logs.filter(l => l.action === 'login').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Metrics - OMNIKOOK Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', background: 'var(--surface-border)', border: '1px solid var(--surface-border)' }}>
        <MetricCard title="SYSTEM_TRAFFIC" value={logs.length} Icon={Activity} color="var(--text-primary)" bg="transparent" isLoading={isLoading} />
        <MetricCard title="PROVISIONING"    value={createsCount} Icon={Plus}     color="var(--success-color)" bg="transparent" isLoading={isLoading} />
        <MetricCard title="MODIFICATIONS"   value={updatesCount} Icon={Pencil}   color="#0044FF" bg="transparent" isLoading={isLoading} />
        <MetricCard title="PURGES"          value={deletesCount} Icon={Trash2}   color="var(--danger-color)" bg="transparent" isLoading={isLoading} />
        <MetricCard title="SESSION_ACCESS"  value={loginsCount}  Icon={LogIn}    color="#7C3AED" bg="transparent" isLoading={isLoading} />
      </div>

      {/* Table panel */}
      <div className="glass-panel" style={{ padding: 0 }}>
        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--surface-border)' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Buscar usuario, acción, descripción..."
              style={{ width: '100%', paddingLeft: '40px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} style={{ width: 'auto', minWidth: '160px' }}>
              <option value="">Todas las entidades</option>
              <option value="supply">Insumos</option>
              <option value="menu_item">Platillos</option>
              <option value="order">Órdenes</option>
              <option value="kitchen">Cocinas</option>
              <option value="user">Usuarios</option>
              <option value="auth">Autenticación</option>
            </select>

            <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} style={{ width: 'auto', minWidth: '160px' }}>
              <option value="">Todas las acciones</option>
              <option value="create">Creación</option>
              <option value="update">Actualización</option>
              <option value="delete">Eliminación</option>
              <option value="login">Inicio de sesión</option>
            </select>

            <button
              onClick={fetchLogs}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              title="Refrescar"
            >
              <RefreshCw size={16} /> Refrescar
            </button>
          </div>
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: 'var(--neutral-bg)', borderBottom: '1px solid var(--surface-border)' }}>
                <th style={thStyle}>TIMESTAMP</th>
                <th style={thStyle}>OPERATOR</th>
                <th style={thStyle}>AUTH_LEVEL</th>
                <th style={thStyle}>ACTION_CODE</th>
                <th style={thStyle}>NODE_TARGET</th>
                <th style={thStyle}>RAW_PAYLOAD</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="6" style={emptyStyle}>Cargando historial...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="6" style={emptyStyle}>No hay movimientos registrados.</td></tr>
              ) : filteredLogs.map((log) => {
                const { bg, color, Icon } = actionStyle(log.action);
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--surface-border)' }} className="table-row-hover">
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{formatDate(log.created_at)}</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {log.user_name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sistema</span>}
                    </td>
                    <td style={tdStyle}>
                      {log.user_role ? (
                        <span className="mono" style={{ fontSize: '0.65rem', textTransform: 'uppercase', border: '1px solid var(--surface-border)', padding: '0.2rem 0.5rem', borderRadius: '2px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          {log.user_role}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={tdStyle}>
                      <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color, fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', border: `1px solid ${color}44`, borderRadius: '2px', textTransform: 'uppercase' }}>
                        <Icon size={12} /> {log.action}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                        {log.entity_id != null && (
                          <span style={{ color: 'var(--text-secondary)' }}> #{log.entity_id}</span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {log.description || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .table-row-hover:hover { background-color: #F8FAFC; }
      `}} />
    </div>
  );
}

const thStyle = { padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.04em' };
const tdStyle = { padding: '1rem 1.5rem', verticalAlign: 'middle' };
const emptyStyle = { padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' };

function MetricCard({ title, value, Icon, color, bg, isLoading }) {
  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `4px solid ${color}` }}>
      <div style={{ padding: '0.65rem', borderRadius: '12px', background: bg, color }}>
        <Icon size={22} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{title}</p>
        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
          {isLoading ? (
            <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', opacity: 0.7 }}>…</span>
          ) : value}
        </h3>
      </div>
    </div>
  );
}
