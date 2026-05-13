/**
 * Reservations — Sistema de reservaciones tipo OpenTable
 * Vista para dueño/recepcionista: calendario de reservas, disponibilidad,
 * creación y gestión de reservaciones.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../components/NotificationProvider';
import { apiClient } from '../api/client';
import {
  Calendar, Clock, Users, Phone, Mail, Plus, X,
  CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  Search, Filter, Edit2, Trash2
} from 'lucide-react';

const STATUS_CONFIG = {
  pending:   { label: 'Pendiente',   color: 'var(--orange-color)', icon: '⏳' },
  confirmed: { label: 'Confirmada',  color: 'var(--success-color)', icon: '✅' },
  seated:    { label: 'En Mesa',     color: 'var(--cyan-color)', icon: '🪑' },
  cancelled: { label: 'Cancelada',   color: 'var(--danger-color)', icon: '❌' },
  no_show:   { label: 'No Show',     color: 'var(--text-secondary)',    icon: '👻' },
};

const SOURCE_CONFIG = {
  online:   { label: 'Online',    icon: '🌐' },
  phone:    { label: 'Teléfono',  icon: '📞' },
  walkin:   { label: 'Walk-in',   icon: '🚶' },
  whatsapp: { label: 'WhatsApp',  icon: '💬' },
};

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function Reservations() {
  const { showAlert, showConfirm } = useNotification();
  const [reservations, setReservations] = useState([]);
  const [tables, setTables]             = useState([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText]     = useState('');

  // Modal de nueva/editar reservación
  const [modal, setModal]     = useState(null);  // null | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]       = useState(defaultForm());
  const [availability, setAvailability] = useState([]);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function defaultForm() {
    return {
      guest_name: '', guest_phone: '', guest_email: '',
      party_size: 2, table_id: '',
      date: todayStr(), time: '20:00',
      duration_minutes: 90, notes: '', source: 'online',
    };
  }

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rRes, tRes] = await Promise.all([
        apiClient.get(`/reservations/?date=${selectedDate}${statusFilter ? `&status=${statusFilter}` : ''}`),
        apiClient.get('/tables/'),
      ]);
      setReservations(rRes.data);
      setTables(tRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Navegar días
  const changeDay = (delta) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Verificar disponibilidad
  const checkAvailability = async () => {
    if (!form.date || !form.time || !form.party_size) return;
    setCheckingAvail(true);
    try {
      const res = await apiClient.get(
        `/reservations/availability?date=${form.date}&time=${form.time}&party_size=${form.party_size}&duration_minutes=${form.duration_minutes}`
      );
      setAvailability(res.data.available_tables || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingAvail(false);
    }
  };

  // Abrir modal crear
  const openCreate = () => {
    setForm(defaultForm());
    setAvailability([]);
    setEditTarget(null);
    setModal('create');
  };

  // Abrir modal editar
  const openEdit = (res) => {
    const dt = new Date(res.reserved_at);
    setForm({
      guest_name: res.guest_name || '',
      guest_phone: res.guest_phone || '',
      guest_email: res.guest_email || '',
      party_size: res.party_size || 2,
      table_id: res.table_id ? res.table_id.toString() : '',
      date: dt.toISOString().split('T')[0],
      time: dt.toTimeString().slice(0, 5),
      duration_minutes: res.duration_minutes || 90,
      notes: res.notes || '',
      source: res.source || 'online',
    });
    setAvailability([]);
    setEditTarget(res);
    setModal('edit');
  };

  const handleSubmit = async () => {
    if (!form.guest_name.trim()) { showAlert('Error', 'El nombre del cliente es requerido.', 'error'); return; }
    if (!form.date || !form.time) { showAlert('Error', 'Fecha y hora son requeridas.', 'error'); return; }

    const reserved_at = new Date(`${form.date}T${form.time}:00`).toISOString();
    const payload = {
      guest_name: form.guest_name.trim(),
      guest_phone: form.guest_phone.trim() || undefined,
      guest_email: form.guest_email.trim() || undefined,
      party_size: parseInt(form.party_size),
      table_id: form.table_id ? parseInt(form.table_id) : undefined,
      reserved_at,
      duration_minutes: parseInt(form.duration_minutes),
      notes: form.notes.trim() || undefined,
      source: form.source,
    };

    setSubmitting(true);
    try {
      if (modal === 'create') {
        await apiClient.post('/reservations/', payload);
        showAlert('¡Reservación creada!', `Reserva para ${form.guest_name} el ${formatDate(reserved_at)} a las ${form.time}.`, 'success');
      } else {
        await apiClient.put(`/reservations/${editTarget.id}`, payload);
        showAlert('Reservación actualizada', '', 'success');
      }
      setModal(null);
      fetchData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      showAlert('Error', typeof detail === 'string' ? detail : 'No se pudo guardar la reservación.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (res, newStatus) => {
    const labels = { confirmed: 'confirmar', seated: 'sentar', cancelled: 'cancelar', no_show: 'marcar como No Show' };
    const ok = await showConfirm('Cambiar estado', `¿Deseas ${labels[newStatus] || newStatus} la reserva de ${res.guest_name}?`);
    if (!ok) return;
    try {
      await apiClient.patch(`/reservations/${res.id}/status`, { status: newStatus });
      fetchData();
    } catch (err) {
      showAlert('Error', 'No se pudo actualizar el estado.', 'error');
    }
  };

  const handleDelete = async (res) => {
    const ok = await showConfirm('Eliminar reservación', `¿Eliminar la reserva de ${res.guest_name}? Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
      await apiClient.delete(`/reservations/${res.id}`);
      fetchData();
    } catch (err) {
      showAlert('Error', 'No se pudo eliminar.', 'error');
    }
  };

  // Filtrar por búsqueda
  const filtered = reservations.filter(r =>
    !searchText.trim() || r.guest_name.toLowerCase().includes(searchText.toLowerCase()) ||
    (r.guest_phone || '').includes(searchText)
  );

  const getTableName = (id) => {
    const t = tables.find(t => t.id === id);
    return t ? `Mesa ${t.number}${t.name ? ` (${t.name})` : ''}` : '—';
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-primary)' }}>
            RESERVACIONES
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {filtered.length} reserva(s) para el {formatDate(selectedDate + 'T12:00:00')}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', fontSize: '0.72rem' }}>
          <Plus size={14} /> Nueva Reservación
        </button>
      </div>

      {/* Controles de fecha y filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '2px', padding: '0.3rem 0.5rem' }}>
          <button onClick={() => changeDay(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.2rem', display: 'flex' }}><ChevronLeft size={15} /></button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ border: 'none', background: 'none', fontSize: '0.78rem', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }} />
          <button onClick={() => changeDay(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.2rem', display: 'flex' }}><ChevronRight size={15} /></button>
        </div>
        <button onClick={() => setSelectedDate(todayStr())} style={{ background: 'none', border: '1px solid var(--surface-border)', borderRadius: '2px', padding: '0.45rem 0.75rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 700 }}>HOY</button>

        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input type="text" placeholder="Buscar cliente..." style={{ paddingLeft: '28px', fontSize: '0.78rem', width: '200px' }} value={searchText} onChange={e => setSearchText(e.target.value)} />
        </div>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>

      {/* Métricas rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = reservations.filter(r => r.status === key).length;
          return (
            <div key={key} style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '4px', padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: cfg.color }}>{count}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tabla de reservaciones */}
      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '3rem' }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-secondary)' }}>
          <Calendar size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p style={{ fontSize: '0.85rem' }}>Sin reservaciones para este día.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '4px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                {['HORA', 'CLIENTE', 'MESA', 'PERSONAS', 'ESTADO', 'CANAL', 'ACCIONES'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((res, idx) => {
                const cfg = STATUS_CONFIG[res.status] || STATUS_CONFIG.pending;
                const src = SOURCE_CONFIG[res.source] || SOURCE_CONFIG.online;
                return (
                  <tr key={res.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--surface-border)' : 'none', transition: 'background 0.1s' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-color)' }}>{formatTime(res.reserved_at)}</span>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{res.duration_minutes} min</p>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{res.guest_name}</p>
                      {res.guest_phone && <p style={{ margin: '0.15rem 0 0', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>📞 {res.guest_phone}</p>}
                      {res.guest_email && <p style={{ margin: '0.1rem 0 0', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>✉ {res.guest_email}</p>}
                      {res.notes && <p style={{ margin: '0.1rem 0 0', fontSize: '0.62rem', color: 'var(--primary-color)', fontStyle: 'italic' }}>✎ {res.notes}</p>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>{getTableName(res.table_id)}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center' }}>
                        <Users size={13} style={{ color: 'var(--text-secondary)' }} />
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{res.party_size}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ padding: '0.25rem 0.6rem', borderRadius: '2px', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{src.icon} {src.label}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {res.status === 'pending' && (
                          <button onClick={() => handleStatusChange(res, 'confirmed')} title="Confirmar" style={{ background: 'rgba(204,255,0,0.1)', border: '1px solid rgba(204,255,0,0.3)', borderRadius: '2px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: 'var(--success-color)', fontSize: '0.65rem', fontWeight: 700 }}>✓ Confirmar</button>
                        )}
                        {(res.status === 'pending' || res.status === 'confirmed') && (
                          <button onClick={() => handleStatusChange(res, 'seated')} title="Sentar" style={{ background: 'rgba(0,204,255,0.1)', border: '1px solid rgba(0,204,255,0.3)', borderRadius: '2px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: 'var(--cyan-color)', fontSize: '0.65rem', fontWeight: 700 }}>🪑 Sentar</button>
                        )}
                        {!['cancelled', 'no_show', 'seated'].includes(res.status) && (
                          <button onClick={() => handleStatusChange(res, 'cancelled')} title="Cancelar" style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '2px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: 'var(--danger-color)', fontSize: '0.65rem', fontWeight: 700 }}>✕ Cancelar</button>
                        )}
                        <button onClick={() => openEdit(res)} title="Editar" style={{ background: 'none', border: '1px solid var(--surface-border)', borderRadius: '2px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}><Edit2 size={12} /></button>
                        <button onClick={() => handleDelete(res)} title="Eliminar" style={{ background: 'none', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '2px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: 'var(--danger-color)', display: 'flex', alignItems: 'center' }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Crear/Editar Reservación ── */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '95vw' }}>
            <div className="modal-header">
              <h2>{modal === 'create' ? 'Nueva Reservación' : 'Editar Reservación'}</h2>
              <button onClick={() => setModal(null)} className="modal-close">×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {/* Nombre */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Nombre del cliente *</label>
                <input type="text" placeholder="Juan García" value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} />
              </div>
              {/* Teléfono */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Teléfono</label>
                <input type="tel" placeholder="+52 999 000 0000" value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} />
              </div>
              {/* Email */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Email</label>
                <input type="email" placeholder="cliente@email.com" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} />
              </div>
              {/* Fecha */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Fecha *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              {/* Hora */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Hora *</label>
                <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              {/* Personas */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Personas</label>
                <input type="number" min="1" max="20" value={form.party_size} onChange={e => setForm(f => ({ ...f, party_size: parseInt(e.target.value) || 1 }))} />
              </div>
              {/* Duración */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Duración (min)</label>
                <select value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))}>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>120 min</option>
                  <option value={150}>150 min</option>
                  <option value={180}>180 min</option>
                </select>
              </div>
              {/* Canal */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Canal</label>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {Object.entries(SOURCE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>

              {/* Verificar disponibilidad */}
              <div style={{ gridColumn: '1/-1' }}>
                <button onClick={checkAvailability} disabled={checkingAvail} style={{ width: '100%', padding: '0.6rem', background: 'rgba(204,255,0,0.08)', border: '1px solid var(--primary-border)', borderRadius: '2px', cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {checkingAvail ? 'Verificando...' : '🔍 Ver Mesas Disponibles'}
                </button>
              </div>

              {/* Mesas disponibles */}
              {availability.length > 0 && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Mesas disponibles</label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {availability.map(t => (
                      <button key={t.id} onClick={() => setForm(f => ({ ...f, table_id: t.id.toString() }))} style={{
                        padding: '0.4rem 0.75rem', borderRadius: '2px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                        background: form.table_id === t.id.toString() ? 'rgba(204,255,0,0.15)' : 'var(--neutral-bg)',
                        border: form.table_id === t.id.toString() ? '1px solid var(--primary-color)' : '1px solid var(--surface-border)',
                        color: form.table_id === t.id.toString() ? 'var(--primary-color)' : 'var(--text-secondary)',
                      }}>
                        Mesa {t.number}{t.name ? ` · ${t.name}` : ''} ({t.capacity} pers.)
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {availability.length === 0 && form.table_id && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Mesa asignada</label>
                  <select value={form.table_id} onChange={e => setForm(f => ({ ...f, table_id: e.target.value }))}>
                    <option value="">Sin mesa asignada</option>
                    {tables.map(t => <option key={t.id} value={t.id}>Mesa {t.number}{t.name ? ` · ${t.name}` : ''} ({t.capacity} pers.)</option>)}
                  </select>
                </div>
              )}

              {/* Notas */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Notas especiales</label>
                <textarea rows={2} placeholder="Cumpleaños, alergias, silla para bebé..." style={{ resize: 'none', fontSize: '0.78rem' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* Botones */}
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setModal(null)} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1px solid var(--surface-border)', borderRadius: '2px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Cancelar</button>
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary" style={{ flex: 2, padding: '0.75rem' }}>
                  {submitting ? 'Guardando...' : modal === 'create' ? 'Crear Reservación' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
