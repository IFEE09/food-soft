import { useState, useEffect } from 'react';
import { useNotification } from '../components/NotificationProvider';
import { apiClient } from '../api/client';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  User, 
  Trash2, 
  ShoppingBag,
  Send,
  X
} from 'lucide-react';

export default function ReceptionDashboard() {
  const { showAlert, showConfirm } = useNotification();
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New order form
  const [clientName, setClientName] = useState('');
  const [selectedKitchen, setSelectedKitchen] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // pending, ready, delivered

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [oRes, mRes, kRes] = await Promise.all([
        apiClient.get('/orders/'),
        apiClient.get('/menu/'),
        apiClient.get('/kitchens/')
      ]);
      setOrders(oRes.data);
      setMenuItems(mRes.data);
      setKitchens(kRes.data);
    } catch (err) {
      console.error("Error fetching reception data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addItemToOrder = (menuItem) => {
    const existing = orderItems.find(i => i.product_name === menuItem.name);
    if (existing) {
      setOrderItems(orderItems.map(i => 
        i.product_name === menuItem.name 
          ? { ...i, quantity: i.quantity + 1 } 
          : i
      ));
    } else {
      setOrderItems([...orderItems, { 
        product_name: menuItem.name, 
        quantity: 1, 
        price: menuItem.price 
      }]);
    }
  };

  const removeItemFromOrder = (index) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };

  const updateItemQuantity = (index, qty) => {
    if (qty < 1) return;
    const newItems = [...orderItems];
    newItems[index].quantity = qty;
    setOrderItems(newItems);
  };

  const orderTotal = orderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      showAlert('Orden vacía', 'Agrega al menos un platillo a la orden.', 'warning');
      return;
    }
    try {
      await apiClient.post('/orders/', {
        client_name: clientName || 'Sin nombre',
        total: orderTotal,
        status: 'pending',
        kitchen_id: selectedKitchen ? parseInt(selectedKitchen) : null,
        items: orderItems.map(i => ({ product_name: i.product_name, quantity: i.quantity }))
      });
      showAlert('Orden Enviada', `Orden de "${clientName || 'Sin nombre'}" enviada a cocina.`, 'success');
      fetchData();
      resetOrderForm();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error creating order:", err);
      showAlert('Error', 'No se pudo crear la orden.', 'error');
    }
  };

  const markAsDelivered = async (orderId) => {
    try {
      await apiClient.put(`/orders/${orderId}`, { status: 'delivered' });
      fetchData();
    } catch (err) {
      console.error("Error updating order:", err);
    }
  };

  const deleteOrder = async (orderId) => {
    const confirmed = await showConfirm(
      '¿Cancelar Orden?', 
      'Esta orden será eliminada permanentemente.'
    );
    if (confirmed) {
      try {
        await apiClient.delete(`/orders/${orderId}`);
        fetchData();
        showAlert('Orden Cancelada', 'La orden ha sido eliminada.', 'success');
      } catch (err) {
        console.error("Error deleting order:", err);
        showAlert('Error', 'No se pudo eliminar la orden.', 'error');
      }
    }
  };

  const resetOrderForm = () => {
    setClientName('');
    setSelectedKitchen('');
    setOrderItems([]);
  };

  const filteredOrders = orders.filter(o => o.status === activeTab);
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Metrics Row - OMNIKOOK Grid Style */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', background: 'var(--surface-border)', border: '1px solid var(--surface-border)' }}>
        <div style={{ padding: '1.25rem', background: 'var(--surface-color)', borderLeft: '2px solid var(--danger-color)' }}>
          <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>QUEUE_STATUS</p>
          <h3 className="mono" style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', fontWeight: 700, color: 'var(--danger-color)' }}>{pendingCount}</h3>
        </div>
        <div style={{ padding: '1.25rem', background: 'var(--surface-color)', borderLeft: '2px solid #F59E0B' }}>
          <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>AWAITING_DELIVERY</p>
          <h3 className="mono" style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', fontWeight: 700, color: '#F59E0B' }}>{readyCount}</h3>
        </div>
        <div style={{ padding: '1.25rem', background: 'var(--surface-color)', borderLeft: '2px solid var(--success-color)' }}>
          <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>DAILY_THROUGHPUT</p>
          <h3 className="mono" style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', fontWeight: 700, color: 'var(--success-color)' }}>{orders.length}</h3>
        </div>
      </div>

      {/* Action Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { key: 'pending', label: 'IN_QUEUE', color: 'var(--danger-color)' },
            { key: 'ready', label: 'READY_STATION', color: '#F59E0B' },
            { key: 'delivered', label: 'FULFILLED', color: 'var(--success-color)' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '2px',
                border: activeTab === tab.key ? `1px solid ${tab.color}` : '1px solid var(--surface-border)',
                background: activeTab === tab.key ? tab.color : 'transparent',
                color: activeTab === tab.key ? '#0A0A0A' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => { resetOrderForm(); setIsModalOpen(true); }} style={{ gap: '0.5rem' }}>
          <Plus size={18} /> Nueva Orden
        </button>
      </div>

      {/* Orders Grid */}
      {isLoading ? (
        <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando órdenes...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
          <ShoppingBag size={40} style={{ color: 'var(--text-secondary)', opacity: 0.2, marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No hay órdenes {activeTab === 'pending' ? 'pendientes' : activeTab === 'ready' ? 'listas' : 'entregadas'}.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {filteredOrders.map(order => {
            const timeAgo = Math.floor((new Date() - new Date(order.created_at)) / 60000);
            return (
              <div key={order.id} className="glass-panel" style={{ 
                padding: '1.25rem', 
                display: 'flex', flexDirection: 'column', gap: '1rem',
                borderTop: `2px solid ${order.status === 'pending' ? 'var(--danger-color)' : order.status === 'ready' ? '#F59E0B' : 'var(--success-color)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 className="mono" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--success-color)' }}>#{order.id.toString().padStart(4, '0')}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem', textTransform: 'uppercase', fontWeight: 600 }}>
                      <User size={11} /> {order.client_name || 'WEB_CLIENT'}
                    </div>
                  </div>
                  <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: timeAgo > 15 ? 'var(--danger-color)' : 'var(--text-secondary)', fontWeight: 600 }}>
                    <Clock size={12} /> {timeAgo}m
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {order.items.map((item, idx) => (
                      <li key={idx} style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--surface-border)', borderRadius: '2px', fontSize: '0.8rem'
                      }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{item.product_name}</span>
                        <span className="mono" style={{ 
                          background: 'var(--surface-border)', color: 'var(--success-color)',
                          fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '1px', fontWeight: 700
                        }}>x{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {order.total > 0 && (
                  <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>
                    VAL: ${order.total.toFixed(2)}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {order.status === 'ready' && (
                    <button 
                      onClick={() => markAsDelivered(order.id)}
                      className="btn-primary" 
                      style={{ flex: 1, gap: '0.5rem', background: 'var(--success-color)', color: '#0A0A0A', fontSize: '0.85rem' }}
                    >
                      <CheckCircle2 size={16} /> Entregar
                    </button>
                  )}
                  {order.status === 'pending' && (
                    <button 
                      onClick={() => deleteOrder(order.id)}
                      style={{ 
                        flex: 1, padding: '0.6rem', background: 'none', 
                        border: '1px solid var(--danger-border)', borderRadius: '2px',
                        color: 'var(--danger-color)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                      }}
                    >
                      <Trash2 size={14} /> Cancelar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Order Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '95%' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Send size={20} /> Nueva Orden
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Cliente</label>
                  <input 
                    type="text" placeholder="Nombre del cliente" 
                    value={clientName} onChange={(e) => setClientName(e.target.value)} 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Enviar a Cocina</label>
                  <select value={selectedKitchen} onChange={(e) => setSelectedKitchen(e.target.value)}>
                    <option value="">Automático</option>
                    {kitchens.filter(k => k.is_active).map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Menu items to add */}
              <div style={{ background: 'var(--neutral-bg)', padding: '1rem', borderRadius: '2px', border: '1px solid var(--surface-border)' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>Agregar del Menú</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                  {menuItems.map(mi => (
                    <button 
                      key={mi.id} type="button"
                      onClick={() => addItemToOrder(mi)}
                      style={{
                        padding: '0.4rem 0.75rem', borderRadius: '2px',
                        border: '1px solid var(--surface-border)', background: 'var(--surface-color)',
                        color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                        transition: 'all 0.15s'
                      }}
                    >
                      {mi.name} <span style={{ color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>${mi.price.toFixed(2)}</span>
                    </button>
                  ))}
                  {menuItems.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>No hay platillos en el menú.</p>
                  )}
                </div>
              </div>

              {/* Order summary */}
              {orderItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Resumen de Orden</label>
                  {orderItems.map((item, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem', background: 'var(--neutral-bg)', borderRadius: '2px', border: '1px solid var(--surface-border)'
                    }}>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.product_name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button type="button" onClick={() => updateItemQuantity(idx, item.quantity - 1)}
                          style={{ width: '28px', height: '28px', borderRadius: '2px', border: '1px solid var(--surface-border)', background: 'var(--surface-color)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>−</button>
                        <span style={{ fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                        <button type="button" onClick={() => updateItemQuantity(idx, item.quantity + 1)}
                          style={{ width: '28px', height: '28px', borderRadius: '2px', border: '1px solid var(--surface-border)', background: 'var(--surface-color)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>+</button>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', minWidth: '60px', textAlign: 'right' }}>${(item.price * item.quantity).toFixed(2)}</span>
                        <button type="button" onClick={() => removeItemFromOrder(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '4px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-color)', marginTop: '0.5rem' }}>
                    Total: ${orderTotal.toFixed(2)}
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ height: '48px', gap: '0.5rem' }}>
                <Send size={18} /> Enviar a Cocina
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
