import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export default function Supplies() {
  const [supplies, setSupplies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    quantity: 0,
    unit: 'kg',
    min_quantity: 5,
    category: ''
  });

  useEffect(() => {
    fetchSupplies();
  }, []);

  const fetchSupplies = async () => {
    try {
      const res = await apiClient.get('/supplies/');
      setSupplies(res.data);
    } catch (err) {
      console.error("Error fetching supplies:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupply) {
        await apiClient.put(`/supplies/${editingSupply.id}`, formData);
      } else {
        await apiClient.post('/supplies/', formData);
      }
      setIsModalOpen(false);
      setEditingSupply(null);
      setFormData({ name: '', quantity: 0, unit: 'kg', min_quantity: 5, category: '' });
      fetchSupplies();
    } catch (err) {
      console.error("Error saving supply:", err);
    }
  };

  const handleEdit = (supply) => {
    setEditingSupply(supply);
    setFormData({
      name: supply.name,
      quantity: supply.quantity,
      unit: supply.unit,
      min_quantity: supply.min_quantity,
      category: supply.category || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Estás seguro de eliminar este insumo?")) {
      try {
        await apiClient.delete(`/supplies/${id}`);
        fetchSupplies();
      } catch (err) {
        console.error("Error deleting supply:", err);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Gestión de Insumos</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Control de inventario y stock de cocina</p>
        </div>
        <button 
          className="btn-primary" 
          onClick={() => {
            setEditingSupply(null);
            setFormData({ name: '', quantity: 0, unit: 'kg', min_quantity: 5, category: '' });
            setIsModalOpen(true);
          }}
        >
          + Agregar Insumo
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Producto</th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Categoría</th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Stock Actual</th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Mínimo</th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Estado</th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center' }}>Cargando datos...</td></tr>
              ) : supplies.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center' }}>No hay insumos registrados.</td></tr>
              ) : supplies.map((s) => {
                const isLow = s.quantity <= s.min_quantity;
                const isCritical = s.quantity <= (s.min_quantity / 2);
                
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '1rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                    <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>{s.category || 'N/A'}</td>
                    <td style={{ padding: '1rem 0', fontWeight: 500 }}>{s.quantity} {s.unit}</td>
                    <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>{s.min_quantity} {s.unit}</td>
                    <td style={{ padding: '1rem 0' }}>
                      <span style={{ 
                        fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 600,
                        backgroundColor: isCritical ? 'var(--danger-bg)' : isLow ? '#FFFBEB' : '#ECFDF5',
                        color: isCritical ? 'var(--danger-color)' : isLow ? '#B45309' : '#059669'
                      }}>
                        {isCritical ? 'Crítico' : isLow ? 'Bajo' : 'Normal'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleEdit(s)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', marginRight: '1rem' }}
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}
                      >
                        Eliminar
                      </button>
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
              <h2>{editingSupply ? 'Editar Insumo' : 'Nuevo Insumo'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">×</button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Nombre del Insumo</label>
                <input 
                  type="text" 
                  placeholder="Ej. Carne de Res, Tomate..." 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Cantidad Actual</label>
                  <input 
                    type="number" step="0.1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: parseFloat(e.target.value)})}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Unidad</label>
                  <select 
                    style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--surface-border)' }}
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  >
                    <option value="kg">kilogramos (kg)</option>
                    <option value="liters">litros (L)</option>
                    <option value="pz">piezas (pz)</option>
                    <option value="gr">gramos (gr)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Mínimo (Alerta)</label>
                  <input 
                    type="number" step="0.1"
                    value={formData.min_quantity}
                    onChange={(e) => setFormData({...formData, min_quantity: parseFloat(e.target.value)})}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Categoría</label>
                  <input 
                    type="text" placeholder="Ej. Proteínas"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1px solid var(--surface-border)', borderRadius: '6px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  {editingSupply ? 'Actualizar' : 'Guardar Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
