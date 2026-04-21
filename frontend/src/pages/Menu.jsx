import { useState, useEffect } from 'react';
import { useNotification } from '../components/NotificationProvider';
import { apiClient } from '../api/client';
import { 
  Plus, 
  Search, 
  Utensils, 
  BookOpen, 
  Trash2, 
  Edit2, 
  X, 
  ChevronRight,
  Database
} from 'lucide-react';

export default function Menu() {
  const { showAlert, showConfirm } = useNotification();
  const [menuItems, setMenuItems] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State - Using empty strings to show placeholders
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: 'Principales',
    description: '',
    recipe_items: [] 
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [mRes, sRes] = await Promise.all([
        apiClient.get('/menu/'),
        apiClient.get('/supplies/')
      ]);
      setMenuItems(mRes.data);
      setSupplies(sRes.data);
    } catch (err) {
      console.error("Error fetching menu data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addRecipeRow = () => {
    setFormData({
      ...formData,
      recipe_items: [...formData.recipe_items, { supply_id: '', quantity: '' }]
    });
  };

  const removeRecipeRow = (index) => {
    const newItems = [...formData.recipe_items];
    newItems.splice(index, 1);
    setFormData({ ...formData, recipe_items: newItems });
  };

  const updateRecipeRow = (index, field, value) => {
    const newItems = [...formData.recipe_items];
    newItems[index][field] = value;
    setFormData({ ...formData, recipe_items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validReceta = formData.recipe_items
        .filter(r => r.supply_id !== '')
        .map(r => ({ ...r, quantity: parseFloat(r.quantity) || 0 }));
    
    try {
      await apiClient.post('/menu/', {
        ...formData,
        price: parseFloat(formData.price) || 0,
        recipe_items: validReceta
      });
      fetchData();
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error saving menu item:", err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      category: 'Principales',
      description: '',
      recipe_items: []
    });
  };

  const deleteItem = async (id) => {
    const confirmed = await showConfirm(
      '¿Eliminar Platillo?', 
      '¿Estás seguro de que deseas eliminar este platillo del menú?'
    );
    if (confirmed) {
        try {
            await apiClient.delete(`/menu/${id}`);
            fetchData();
            showAlert('Eliminado', 'El platillo ha sido removido.', 'success');
        } catch (err) {
            console.error("Error deleting menu item:", err);
            showAlert('Error', 'No se pudo eliminar el platillo.', 'error');
        }
    }
  };

  const filteredMenu = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '350px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" placeholder="Buscar platillo por nombre o categoría..." 
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '40px' }}
          />
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }} style={{ gap: '0.5rem' }}>
          <Plus size={18} /> Nuevo Platillo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {isLoading ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Cargando carta...</div>
        ) : filteredMenu.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No hay platillos registrados.</div>
        ) : filteredMenu.map(item => (
            <div key={item.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#EFF6FF', color: '#1E40AF', padding: '0.2rem 0.6rem', borderRadius: '50px', textTransform: 'uppercase' }}>
                            {item.category}
                        </span>
                        <h3 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '1.15rem', fontWeight: 700 }}>{item.name}</h3>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                        ${item.price.toFixed(2)}
                    </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, minHeight: '3em' }}>
                    {item.description || 'Sin descripción.'}
                </p>
                
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
                        <BookOpen size={14} /> RECETA ({item.recipe_items.length} Ingredientes)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {item.recipe_items.map(ri => (
                           <div key={ri.id} style={{ fontSize: '0.75rem', background: '#F8FAFC', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                             {ri.quantity}{ri.supply?.unit} {ri.supply?.name}
                           </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button onClick={() => deleteItem(item.id)} style={{ padding: '0.5rem', background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'var(--primary-color)', color: 'white', padding: '8px', borderRadius: '10px' }}>
                    <Utensils size={20} />
                </div>
                <h2>Configurar Nuevo Platillo</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="modal-close"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
               <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Nombre del Plato</label>
                        <input type="text" placeholder="Ej. Burger Premium" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Precio de Venta</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, opacity: 0.5 }}>$</span>
                            <input 
                                type="number" step="0.01" placeholder="0.00"
                                style={{ paddingLeft: '28px' }}
                                value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required 
                            />
                        </div>
                    </div>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Categoría</label>
                        <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                            <option value="Entradas">Entradas</option>
                            <option value="Principales">Principales</option>
                            <option value="Postres">Postres</option>
                            <option value="Bebidas">Bebidas</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Breve Descripción</label>
                        <input type="text" placeholder="Ej. Sabrosa hamburguesa..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                    </div>
               </div>

               <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Database size={16} color="var(--primary-color)" /> Receta e Insumos
                    </h3>
                    <button type="button" onClick={addRecipeRow} style={{ fontSize: '0.75rem', color: 'var(--primary-color)', background: 'white', border: '1px solid var(--primary-color)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                        + Añadir Ingrediente
                    </button>
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {formData.recipe_items.map((row, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                            <select 
                                value={row.supply_id} 
                                onChange={(e) => updateRecipeRow(idx, 'supply_id', parseInt(e.target.value))}
                                style={{ background: 'white' }}
                                required
                            >
                                <option value="">Selecciona insumo...</option>
                                {supplies.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                            </select>
                            <input 
                                type="number" 
                                step="0.001" 
                                placeholder="0.000" 
                                value={row.quantity} 
                                onChange={(e) => updateRecipeRow(idx, 'quantity', e.target.value)}
                                style={{ background: 'white' }}
                                required
                            />
                            <button type="button" onClick={() => removeRecipeRow(idx)} style={{ color: 'var(--danger-color)', border: 'none', background: 'none', cursor: 'pointer' }}>
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {formData.recipe_items.length === 0 && (
                        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '1rem' }}>
                            No hay ingredientes asignados.
                        </p>
                    )}
                 </div>
               </div>

               <div style={{ display: 'flex', gap: '1rem' }}>
                 <button type="submit" className="btn-primary" style={{ flex: 1, height: '52px' }}>
                    Publicar en el Menú
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
