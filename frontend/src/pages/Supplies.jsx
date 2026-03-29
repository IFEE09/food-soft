import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  AlertTriangle, 
  TrendingDown, 
  Package, 
  Filter,
  Trash2,
  Edit2,
  DollarSign
} from 'lucide-react';

export default function Supplies() {
  const [supplies, setSupplies] = useState([]);
  const [filteredSupplies, setFilteredSupplies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Form State - Using empty strings for defaults to show placeholders
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: 'kg',
    cost: '',
    min_quantity: '',
    category: ''
  });

  useEffect(() => {
    fetchSupplies();
  }, []);

  useEffect(() => {
    const filtered = supplies.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSupplies(filtered);
  }, [searchTerm, supplies]);

  const fetchSupplies = async () => {
    try {
      const res = await apiClient.get('/supplies/');
      setSupplies(res.data);
      setFilteredSupplies(res.data);
    } catch (err) {
      console.error("Error fetching supplies:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataToSend = {
        ...formData,
        quantity: parseFloat(formData.quantity) || 0,
        cost: parseFloat(formData.cost) || 0,
        min_quantity: parseFloat(formData.min_quantity) || 0
    };

    try {
        if (editingItem) {
            await apiClient.put(`/supplies/${editingItem.id}`, dataToSend);
        } else {
            await apiClient.post('/supplies/', dataToSend);
        }
        fetchSupplies();
        setIsModalOpen(false);
        resetForm();
    } catch (err) {
        console.error("DEBUG - Error completo de Axios:", err);
        const errorDetail = err.response?.data?.detail;
        const status = err.response?.status;
        const errorMessage = typeof errorDetail === 'string' ? errorDetail : (JSON.stringify(errorDetail) || "Desconocido");
        alert(`FALLO CRÍTICO (Status: ${status}):\nError: ${errorMessage}\n\nPor favor, intenta CERRAR SESIÓN, refrescar con CMD+SHIFT+R y volver a entrar.`);
    }
  };

  const deleteItem = async (id) => {
    if (window.confirm('¿Eliminar este insumo definitivamente?')) {
      try {
        await apiClient.delete(`/supplies/${id}`);
        fetchSupplies();
      } catch (err) {
        console.error("Error deleting supply:", err);
      }
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      quantity: item.quantity.toString(),
      unit: item.unit,
      cost: item.cost ? item.cost.toString() : '',
      min_quantity: item.min_quantity.toString(),
      category: item.category || ''
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      quantity: '',
      unit: 'kg',
      cost: '',
      min_quantity: '',
      category: ''
    });
  };

  // Metrics
  const totalValue = filteredSupplies.reduce((acc, s) => acc + (s.quantity * (s.cost || 0)), 0);
  const lowStockCount = supplies.filter(s => s.quantity <= s.min_quantity).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #10B981' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#ECFDF5', color: '#10B981' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Valor Total Inventario</p>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>${totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--danger-color)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--danger-bg)', color: 'var(--danger-color)' }}>
            <TrendingDown size={24} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Alertas de Reabastecimiento</p>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{lowStockCount} Insumos</h3>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--surface-border)' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o categoría..." 
              style={{ width: '100%', paddingLeft: '40px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }} style={{ gap: '0.5rem' }}>
            <Plus size={18} /> Agregar Insumo
          </button>
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--surface-border)' }}>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>INSUMO</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>CATEGORÍA</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>STOCK ACTUAL</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>COSTO UNIT.</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>VALOR TOTAL</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>ESTADO</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando inventario...</td></tr>
              ) : filteredSupplies.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No se encontraron insumos.</td></tr>
              ) : filteredSupplies.map((item) => {
                const isLow = item.quantity <= item.min_quantity;
                const isCritical = item.quantity <= (item.min_quantity / 2);
                const itemTotalValue = item.quantity * (item.cost || 0);

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.2s' }} className="table-row-hover">
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span style={{ fontSize: '0.75rem', background: '#F1F5F9', padding: '0.2rem 0.6rem', borderRadius: '50px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {item.category || 'Sin Cat.'}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: 500 }}>
                      {item.quantity} <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{item.unit}</span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)' }}>
                      ${(item.cost || 0).toFixed(3)}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                      ${itemTotalValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.4rem', 
                        color: isCritical ? 'var(--danger-color)' : isLow ? '#CA8A04' : '#059669',
                        fontSize: '0.85rem', fontWeight: 600
                      }}>
                        {isLow && <AlertTriangle size={14} />}
                        {isCritical ? 'Crítico' : isLow ? 'Bajo' : 'Suficiente'}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => openEdit(item)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }} title="Eliminar">
                          <Trash2 size={16} />
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

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editingItem ? 'Editar Insumo' : 'Nuevo Insumo'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Nombre del producto</label>
                <input 
                  type="text" placeholder="Ej. Pechuga de Pollo" 
                  value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cantidad</label>
                  <input 
                    type="number" step="0.001" placeholder="0.000"
                    value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} required 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Unidad</label>
                    <select 
                      value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    >
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="l">Litros (l)</option>
                      <option value="pz">Piezas (pz)</option>
                      <option value="gr">Gramos (gr)</option>
                    </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Costo por Unidad</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, opacity: 0.5 }}>$</span>
                    <input 
                        type="number" step="0.001" placeholder="0.000"
                        style={{ paddingLeft: '28px' }}
                        value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})} required 
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mínimo (Alerta)</label>
                  <input 
                    type="number" step="0.001" placeholder="0.000"
                    value={formData.min_quantity} onChange={(e) => setFormData({...formData, min_quantity: e.target.value})} required 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Categoría</label>
                <input 
                  type="text" placeholder="Ej. Proteínas" 
                  value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} 
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1px solid var(--surface-border)', borderRadius: '6px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  {editingItem ? 'Guardar Cambios' : 'Registrar Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .table-row-hover:hover { background-color: #F8FAFC; }
      `}} />

    </div>
  );
}
