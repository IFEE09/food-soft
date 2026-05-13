import { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../components/NotificationProvider';
import { apiClient } from '../api/client';
import {
  Plus, Search, AlertTriangle, TrendingDown, Trash2,
  Edit2, DollarSign, Package, RefreshCw, History,
  PlusCircle, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';

const UNITS = ['kg', 'g', 'L', 'ml', 'pz'];

function stockLevel(qty, min) {
  if (!min || min === 0) return 'ok';
  const pct = qty / min;
  if (pct <= 0) return 'empty';
  if (pct <= 0.5) return 'critical';
  if (pct <= 1) return 'low';
  return 'ok';
}

function StockBar({ qty, min }) {
  const pct = min > 0 ? Math.min((qty / (min * 2)) * 100, 100) : 100;
  const level = stockLevel(qty, min);
  const color = level === 'ok' ? 'var(--success-color)'
    : level === 'low' ? '#F59E0B'
    : 'var(--danger-color)';
  return (
    <div style={{ width: '100%', background: 'var(--neutral-bg)', borderRadius: '2px', height: '4px', marginTop: '4px' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.4s' }} />
    </div>
  );
}

export default function Supplies() {
  const { showAlert, showConfirm } = useNotification();
  const [supplies, setSupplies] = useState([]);
  const [movements, setMovements] = useState([]);
  const [filteredSupplies, setFilteredSupplies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'history'

  // Modal de insumo (crear/editar)
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '', quantity: '', unit: 'kg', cost: '', min_quantity: '', category: ''
  });

  // Modal de recarga
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [restockLoading, setRestockLoading] = useState(false);

  const fetchSupplies = useCallback(async () => {
    const kitchenId = localStorage.getItem('kitchenId');
    try {
      const res = await apiClient.get(`/supplies/?kitchen_id=${kitchenId}`);
      setSupplies(res.data);
    } catch (err) {
      console.error('Error fetching supplies:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMovements = useCallback(async () => {
    try {
      const res = await apiClient.get('/supply-movements/?limit=80');
      setMovements(res.data);
    } catch (err) {
      console.error('Error fetching movements:', err);
    }
  }, []);

  useEffect(() => { fetchSupplies(); }, [fetchSupplies]);
  useEffect(() => { if (activeTab === 'history') fetchMovements(); }, [activeTab, fetchMovements]);

  useEffect(() => {
    const q = searchTerm.toLowerCase();
    setFilteredSupplies(
      supplies.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
      )
    );
  }, [searchTerm, supplies]);

  // ── CRUD insumo ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataToSend = {
      ...formData,
      quantity: parseFloat(formData.quantity) || 0,
      cost: parseFloat(formData.cost) || 0,
      min_quantity: parseFloat(formData.min_quantity) || 0,
      kitchen_id: localStorage.getItem('kitchenId'),
    };
    try {
      if (editingItem) {
        await apiClient.put(`/supplies/${editingItem.id}`, dataToSend);
      } else {
        await apiClient.post('/supplies/', dataToSend);
      }
      fetchSupplies();
      setIsSupplyModalOpen(false);
      resetForm();
    } catch (err) {
      const detail = err.response?.data?.detail;
      showAlert('Error', typeof detail === 'string' ? detail : 'No se pudo guardar el insumo.', 'error');
    }
  };

  const deleteItem = async (id) => {
    const confirmed = await showConfirm('¿Eliminar Insumo?', 'Esta acción no se puede deshacer.');
    if (!confirmed) return;
    try {
      await apiClient.delete(`/supplies/${id}`);
      fetchSupplies();
      showAlert('Eliminado', 'Insumo removido correctamente.', 'success');
    } catch (err) {
      showAlert('Error', 'No se pudo eliminar el insumo.', 'error');
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      quantity: item.quantity.toString(),
      unit: item.unit,
      cost: item.cost?.toString() || '',
      min_quantity: item.min_quantity?.toString() || '',
      category: item.category || '',
    });
    setIsSupplyModalOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({ name: '', quantity: '', unit: 'kg', cost: '', min_quantity: '', category: '' });
  };

  // ── Recarga ──────────────────────────────────────────────────────────────
  const openRestock = (item) => {
    setRestockTarget(item);
    setRestockQty('');
    setRestockNotes('');
    setIsRestockModalOpen(true);
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    if (!restockTarget || parseFloat(restockQty) <= 0) return;
    setRestockLoading(true);
    try {
      await apiClient.post('/supply-movements/restock', {
        supply_id: restockTarget.id,
        quantity: parseFloat(restockQty),
        notes: restockNotes || undefined,
      });
      showAlert('Recarga registrada', `+${restockQty} ${restockTarget.unit} de ${restockTarget.name}`, 'success');
      setIsRestockModalOpen(false);
      fetchSupplies();
      if (activeTab === 'history') fetchMovements();
    } catch (err) {
      const detail = err.response?.data?.detail;
      showAlert('Error', typeof detail === 'string' ? detail : 'No se pudo registrar la recarga.', 'error');
    } finally {
      setRestockLoading(false);
    }
  };

  // ── Métricas ─────────────────────────────────────────────────────────────
  const totalValue = supplies.reduce((acc, s) => acc + (s.quantity * (s.cost || 0)), 0);
  const lowCount = supplies.filter(s => stockLevel(s.quantity, s.min_quantity) !== 'ok').length;
  const criticalCount = supplies.filter(s => ['critical', 'empty'].includes(stockLevel(s.quantity, s.min_quantity))).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ── Métricas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
        <MetricCard icon={<DollarSign size={20} />} label="Valor del inventario" color="var(--success-color)" colorBg="var(--success-bg)" colorBorder="var(--success-border)">
          {isLoading ? '...' : `$${totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
        </MetricCard>
        <MetricCard icon={<TrendingDown size={20} />} label="Stock bajo" color="var(--warning-color)" colorBg="var(--warning-bg)" colorBorder="var(--warning-border)">
          {isLoading ? '...' : `${lowCount} insumos`}
        </MetricCard>
        <MetricCard icon={<AlertTriangle size={20} />} label="Críticos o agotados" color="var(--danger-color)" colorBg="var(--danger-bg)" colorBorder="var(--danger-border)">
          {isLoading ? '...' : `${criticalCount} insumos`}
        </MetricCard>
        <MetricCard icon={<Package size={20} />} label="Total de insumos" color="var(--accent-blue)" colorBg="var(--accent-subtle)" colorBorder="var(--accent-border)">
          {isLoading ? '...' : `${supplies.length} registrados`}
        </MetricCard>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--surface-border)' }}>
        {[['stock', 'Inventario'], ['history', 'Movimientos']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '0.75rem 1.5rem', background: 'none', border: 'none',
            borderBottom: activeTab === key ? '2px solid var(--primary-color)' : '2px solid transparent',
            color: activeTab === key ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em',
            textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Tab: Stock ── */}
      {activeTab === 'stock' && (
        <div className="glass-panel" style={{ padding: 0 }}>
          <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type="text" placeholder="Buscar por nombre o categoría..." style={{ width: '100%', paddingLeft: '40px' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={fetchSupplies} style={{ background: 'none', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)', padding: '0.5rem', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Actualizar">
                <RefreshCw size={16} />
              </button>
              <button className="btn-primary" onClick={() => { resetForm(); setIsSupplyModalOpen(true); }} style={{ gap: '0.5rem', display: 'flex', alignItems: 'center' }}>
                <Plus size={18} /> Agregar Insumo
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: 'var(--neutral-bg)', borderBottom: '1px solid var(--surface-border)' }}>
                  {['Insumo', 'Categoría', 'Stock actual', 'Nivel', 'Costo unit.', 'Valor total', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '0.9rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando inventario...</td></tr>
                ) : filteredSupplies.length === 0 ? (
                  <tr><td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No se encontraron insumos.</td></tr>
                ) : filteredSupplies.map(item => {
                  const level = stockLevel(item.quantity, item.min_quantity);
                  const statusColor = level === 'ok' ? 'var(--success-color)' : level === 'low' ? '#F59E0B' : 'var(--danger-color)';
                  const statusLabel = level === 'ok' ? '✓ OK' : level === 'low' ? '⚠️ Bajo' : level === 'critical' ? '🔴 Crítico' : '❌ Agotado';
                  const pct = item.min_quantity > 0 ? Math.min(Math.round((item.quantity / item.min_quantity) * 100), 999) : 100;

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--surface-border)' }} className="table-row-hover">
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ fontSize: '0.65rem', background: 'var(--neutral-bg)', padding: '0.2rem 0.5rem', borderRadius: '2px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', border: '1px solid var(--surface-border)' }}>
                          {item.category || 'Sin Cat.'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.quantity} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 400 }}>{item.unit}</span>
                        <StockBar qty={item.quantity} min={item.min_quantity} />
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {pct}% <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>/ mín {item.min_quantity} {item.unit}</span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        ${(item.cost || 0).toFixed(3)}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--success-color)' }}>
                        ${(item.quantity * (item.cost || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: statusColor, fontSize: '0.8rem', fontWeight: 600 }}>
                          {level !== 'ok' && <AlertTriangle size={11} />}
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => openRestock(item)} title="Recargar stock" style={{ background: 'rgba(204,255,0,0.08)', border: '1px solid var(--primary-border)', color: 'var(--primary-color)', padding: '0.35rem 0.6rem', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>
                            <PlusCircle size={13} /> Recargar
                          </button>
                          <button onClick={() => openEdit(item)} title="Editar" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => deleteItem(item.id)} title="Eliminar" style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Historial ── */}
      {activeTab === 'history' && (
        <div className="glass-panel" style={{ padding: 0 }}>
          <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>
              <History size={16} /> Últimos 80 movimientos
            </div>
            <button onClick={fetchMovements} style={{ background: 'none', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)', padding: '0.5rem', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={16} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: 'var(--neutral-bg)', borderBottom: '1px solid var(--surface-border)' }}>
                  {['Fecha', 'Tipo', 'Insumo', 'Cantidad', 'Notas', 'Usuario'].map(h => (
                    <th key={h} style={{ padding: '0.9rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Sin movimientos registrados.</td></tr>
                ) : movements.map(m => {
                  const isIn = m.movement_type === 'in';
                  const isOut = m.movement_type === 'out';
                  const typeColor = isIn ? 'var(--success-color)' : isOut ? 'var(--danger-color)' : '#F59E0B';
                  const TypeIcon = isIn ? ArrowUpCircle : isOut ? ArrowDownCircle : RefreshCw;
                  const typeLabel = isIn ? '⬆️ Entrada' : isOut ? '⬇️ Salida' : '⇅ Ajuste';
                  const date = new Date(m.created_at);
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--surface-border)' }} className="table-row-hover">
                      <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {date.toLocaleDateString('es-MX')} {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.9rem 1.25rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: typeColor, fontSize: '0.8rem', fontWeight: 600 }}>
                          <TypeIcon size={12} /> {typeLabel}
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.supply_name || `#${m.supply_id}`}</td>
                      <td style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: typeColor, fontSize: '0.875rem' }}>
                        {isIn ? '+' : isOut ? '-' : '±'}{m.quantity} {m.supply_unit || ''}
                      </td>
                      <td style={{ padding: '0.9rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{m.notes || '—'}</td>
                      <td style={{ padding: '0.9rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{m.user_name || 'Sistema'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Crear/Editar Insumo ── */}
      {isSupplyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>{editingItem ? 'Editar Insumo' : 'Nuevo Insumo'}</h2>
              <button onClick={() => setIsSupplyModalOpen(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <Field label="Nombre del insumo">
                <input type="text" placeholder="Ej. Queso Mozzarella" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Field label="Cantidad inicial">
                  <input type="number" step="0.001" placeholder="0.000" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} required />
                </Field>
                <Field label="Unidad">
                  <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Field label="Costo por unidad ($)">
                  <input type="number" step="0.001" placeholder="0.000" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} />
                </Field>
                <Field label="Mínimo para alerta">
                  <input type="number" step="0.001" placeholder="0.000" value={formData.min_quantity} onChange={e => setFormData({ ...formData, min_quantity: e.target.value })} />
                </Field>
              </div>
              <Field label="Categoría">
                <input type="text" placeholder="Ej. Lácteos, Proteínas..." value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
              </Field>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsSupplyModalOpen(false)} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1px solid var(--surface-border)', borderRadius: '2px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem' }}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingItem ? 'Guardar Cambios' : 'Registrar Insumo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Recarga ── */}
      {isRestockModalOpen && restockTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>Recargar: {restockTarget.name}</h2>
              <button onClick={() => setIsRestockModalOpen(false)} className="modal-close">×</button>
            </div>
            <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'var(--neutral-bg)', borderRadius: '2px', border: '1px solid var(--surface-border)' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Stock actual</p>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {restockTarget.quantity} {restockTarget.unit}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>/ mín {restockTarget.min_quantity} {restockTarget.unit}</span>
              </p>
              <StockBar qty={restockTarget.quantity} min={restockTarget.min_quantity} />
            </div>
            <form onSubmit={handleRestock} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <Field label={`Cantidad a agregar (${restockTarget.unit})`}>
                <input type="number" step="0.001" min="0.001" placeholder="0.000" value={restockQty} onChange={e => setRestockQty(e.target.value)} required autoFocus />
              </Field>
              <Field label="Notas (opcional)">
                <input type="text" placeholder="Ej. Entrega de proveedor, lote #42..." value={restockNotes} onChange={e => setRestockNotes(e.target.value)} />
              </Field>
              {restockQty && parseFloat(restockQty) > 0 && (
                <div style={{ padding: '0.6rem 1rem', background: 'rgba(204,255,0,0.05)', border: '1px solid var(--primary-border)', borderRadius: '2px', fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 700 }}>
                  Nuevo stock: {(restockTarget.quantity + parseFloat(restockQty)).toFixed(3)} {restockTarget.unit}
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => setIsRestockModalOpen(false)} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1px solid var(--surface-border)', borderRadius: '2px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem' }}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={restockLoading}>
                  {restockLoading ? 'Registrando...' : 'Confirmar Recarga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `.table-row-hover:hover { background-color: var(--neutral-bg); }` }} />
    </div>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────
function MetricCard({ icon, label, color, colorBg, colorBorder, children }) {
  return (
    <div style={{ padding: '1.25rem', background: 'var(--surface-color)', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `2px solid ${color}`, borderBottom: '1px solid var(--surface-border)' }}>
      <div style={{ padding: '0.75rem', borderRadius: '2px', background: colorBg, color, border: `1px solid ${colorBorder}` }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</p>
        <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{children}</h3>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}
