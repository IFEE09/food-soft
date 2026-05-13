import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../components/NotificationProvider';
import { apiClient } from '../api/client';
import { Plus, Clock, CheckCircle2, User, Trash2, ShoppingBag, Send, X, Building2, AlertCircle } from 'lucide-react';

const STATUS_TABS = [
  { key: 'pending',   label: 'Pendientes',  accent: 'var(--warning-color)',  bg: 'var(--warning-bg)',  border: 'var(--warning-border)' },
  { key: 'ready',     label: 'Listos',      accent: 'var(--ready-color)',    bg: 'var(--ready-bg)',    border: 'var(--ready-border)' },
  { key: 'delivered', label: 'Entregados',  accent: 'var(--text-secondary)', bg: 'var(--neutral-bg)', border: 'var(--surface-border)' },
];

export default function ReceptionDashboard() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useNotification();
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [stations, setStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [orderItems, setOrderItems] = useState([]);

  const currentKitchenId   = localStorage.getItem('kitchenId');
  const currentKitchenName = localStorage.getItem('kitchenName');

  useEffect(() => {
    if (currentKitchenId) fetchData();
  }, [currentKitchenId]);

  const fetchData = async () => {
    try {
      const [oRes, mRes, sRes] = await Promise.all([
        apiClient.get('/orders/'),
        apiClient.get('/menu/'),
        apiClient.get(`/stations/?kitchen_id=${currentKitchenId}`)
      ]);
      const myStations = sRes.data;
      const myStationIds = myStations.map(s => s.id);
      setOrders(oRes.data.filter(o => myStationIds.includes(o.station_id)));
      setMenuItems(mRes.data);
      setStations(myStations);
    } catch (err) {
      console.error('Error fetching reception data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentKitchenId) {
    return (
      <div className="empty-state" style={{ minHeight: '60vh' }}>
        <Building2 size={48} className="empty-state-icon" />
        <p className="empty-state-title">Selecciona una cocina</p>
        <p className="empty-state-desc">Para gestionar la recepción, primero elige una sucursal desde el Panel de Cocinas.</p>
        <button onClick={() => navigate('/dashboard/kitchen')} className="btn-primary" style={{ marginTop: '0.5rem' }}>
          Ir al Panel de Cocinas
        </button>
      </div>
    );
  }

  if (!isLoading && stations.length === 0) {
    return (
      <div className="empty-state" style={{ minHeight: '60vh' }}>
        <AlertCircle size={48} className="empty-state-icon" />
        <p className="empty-state-title">Sin estaciones configuradas</p>
        <p className="empty-state-desc">Esta cocina no tiene estaciones (ej. Cocina Caliente, Fríos). Configúralas primero.</p>
        <button onClick={() => navigate('/dashboard/kitchen')} className="btn-primary" style={{ marginTop: '0.5rem' }}>
          Configurar Estaciones
        </button>
      </div>
    );
  }

  const addItemToOrder = (menuItem) => {
    const existing = orderItems.find(i => i.product_name === menuItem.name);
    if (existing) {
      setOrderItems(orderItems.map(i => i.product_name === menuItem.name ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setOrderItems([...orderItems, { product_name: menuItem.name, quantity: 1, price: menuItem.price }]);
    }
  };

  const removeItemFromOrder = (index) => {
    const n = [...orderItems]; n.splice(index, 1); setOrderItems(n);
  };

  const updateItemQuantity = (index, qty) => {
    if (qty < 1) return;
    const n = [...orderItems]; n[index].quantity = qty; setOrderItems(n);
  };

  const orderTotal = orderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      showAlert('Orden vacía', 'Agrega al menos un platillo.', 'warning');
      return;
    }
    try {
      await apiClient.post('/orders/', {
        client_name: clientName || 'Sin nombre',
        total: orderTotal,
        status: 'pending',
        station_id: selectedStation ? parseInt(selectedStation) : null,
        items: orderItems.map(i => ({ product_name: i.product_name, quantity: i.quantity }))
      });
      showAlert('Orden enviada', `Orden de "${clientName || 'Sin nombre'}" enviada a cocina.`, 'success');
      fetchData();
      resetOrderForm();
      setIsModalOpen(false);
    } catch (err) {
      showAlert('Error', 'No se pudo crear la orden.', 'error');
    }
  };

  const markAsDelivered = async (orderId) => {
    try {
      await apiClient.put(`/orders/${orderId}`, { status: 'delivered' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const deleteOrder = async (orderId) => {
    const confirmed = await showConfirm('¿Cancelar orden?', 'Esta orden será eliminada permanentemente.');
    if (confirmed) {
      try {
        await apiClient.delete(`/orders/${orderId}`);
        fetchData();
        showAlert('Orden cancelada', 'La orden ha sido eliminada.', 'success');
      } catch (err) { console.error(err); }
    }
  };

  const resetOrderForm = () => { setClientName(''); setSelectedStation(''); setOrderItems([]); };

  const filteredOrders = orders.filter(o => o.status === activeTab);
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const readyCount   = orders.filter(o => o.status === 'ready').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Recepción</h1>
          {currentKitchenName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
              <Building2 size={13} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{currentKitchenName}</span>
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={() => { resetOrderForm(); setIsModalOpen(true); }}>
          <Plus size={16} /> Nueva Orden
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span className="stat-card-label">Pendientes</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} style={{ color: 'var(--warning-color)' }} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: pendingCount > 0 ? 'var(--warning-color)' : 'var(--text-primary)' }}>{pendingCount}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span className="stat-card-label">Listos</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--ready-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--ready-color)' }} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: readyCount > 0 ? 'var(--ready-color)' : 'var(--text-primary)' }}>{readyCount}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span className="stat-card-label">Total</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={16} style={{ color: 'var(--accent-blue)' }} />
            </div>
          </div>
          <div className="stat-card-value">{orders.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.375rem', padding: '0.25rem', background: 'var(--bg-color)', borderRadius: '10px', width: 'fit-content', border: '1px solid var(--surface-border)' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.4375rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.key ? 'var(--surface-color)' : 'transparent',
              color: activeTab === tab.key ? tab.accent : 'var(--text-secondary)',
              fontWeight: activeTab === tab.key ? 600 : 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              display: 'flex', alignItems: 'center', gap: '0.375rem'
            }}
          >
            {tab.label}
            {tab.key === 'pending' && pendingCount > 0 && (
              <span style={{
                background: 'var(--warning-bg)', color: 'var(--warning-color)',
                border: '1px solid var(--warning-border)',
                borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 700,
                padding: '0.0625rem 0.4375rem', minWidth: '18px', textAlign: 'center'
              }}>{pendingCount}</span>
            )}
            {tab.key === 'ready' && readyCount > 0 && (
              <span style={{
                background: 'var(--ready-bg)', color: 'var(--ready-color)',
                border: '1px solid var(--ready-border)',
                borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 700,
                padding: '0.0625rem 0.4375rem', minWidth: '18px', textAlign: 'center'
              }}>{readyCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Orders grid */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <span className="spinner" style={{ width: '28px', height: '28px' }} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag size={40} className="empty-state-icon" />
          <p className="empty-state-title">Sin órdenes {activeTab === 'pending' ? 'pendientes' : activeTab === 'ready' ? 'listas' : 'entregadas'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {filteredOrders.map(order => {
            const timeAgo = Math.floor((new Date() - new Date(order.created_at)) / 60000);
            const isUrgent = timeAgo > 15;
            const tabInfo = STATUS_TABS.find(t => t.key === order.status) || STATUS_TABS[0];

            return (
              <div key={order.id} style={{
                background: 'var(--surface-color)',
                border: '1px solid var(--surface-border)',
                borderRadius: '16px',
                padding: '1.25rem',
                display: 'flex', flexDirection: 'column', gap: '1rem',
                boxShadow: 'var(--shadow-sm)',
                borderTop: `3px solid ${tabInfo.accent}`
              }}>
                {/* Order header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--accent-blue)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                      #{order.id.toString().padStart(4, '0')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontWeight: 500 }}>
                      <User size={12} /> {order.client_name || 'Sin nombre'}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    fontSize: '0.8125rem', fontWeight: 600,
                    color: isUrgent ? 'var(--danger-color)' : 'var(--text-secondary)',
                    background: isUrgent ? 'var(--danger-bg)' : 'var(--neutral-bg)',
                    padding: '0.25rem 0.5rem', borderRadius: '9999px',
                    border: `1px solid ${isUrgent ? 'var(--danger-border)' : 'var(--surface-border)'}`
                  }}>
                    <Clock size={12} /> {timeAgo}m
                  </div>
                </div>

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-color)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '8px',
                      fontSize: '0.875rem'
                    }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.product_name}</span>
                      <span style={{
                        background: 'var(--accent-subtle)', color: 'var(--accent-blue)',
                        border: '1px solid var(--accent-border)',
                        fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontWeight: 700
                      }}>×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                {order.total > 0 && (
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', letterSpacing: '-0.01em' }}>
                    ${order.total.toFixed(2)}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {order.status === 'ready' && (
                    <button
                      onClick={() => markAsDelivered(order.id)}
                      style={{
                        flex: 1, padding: '0.5625rem 1rem',
                        background: 'var(--ready-color)', border: 'none',
                        borderRadius: '9999px', color: '#fff',
                        fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                        fontFamily: 'inherit'
                      }}
                    >
                      <CheckCircle2 size={15} /> Entregar
                    </button>
                  )}
                  {order.status === 'pending' && (
                    <button
                      onClick={() => deleteOrder(order.id)}
                      style={{
                        flex: 1, padding: '0.5625rem 1rem',
                        background: 'transparent', border: '1px solid var(--danger-border)',
                        borderRadius: '9999px', color: 'var(--danger-color)',
                        fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                        fontFamily: 'inherit', transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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
          <div className="modal-content" style={{ maxWidth: '580px', width: '95%' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Send size={18} /> Nueva Orden
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Cliente</label>
                  <input type="text" placeholder="Nombre del cliente" value={clientName} onChange={e => setClientName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Estación</label>
                  <select value={selectedStation} onChange={e => setSelectedStation(e.target.value)}>
                    <option value="">Ruteo automático</option>
                    {stations.filter(s => s.is_active).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Menu items */}
              <div>
                <label className="form-label" style={{ marginBottom: '0.625rem', display: 'block' }}>Agregar del menú</label>
                <div style={{
                  background: 'var(--bg-color)', padding: '0.875rem',
                  borderRadius: '12px', border: '1px solid var(--surface-border)',
                  display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
                  maxHeight: '160px', overflowY: 'auto'
                }}>
                  {menuItems.map(mi => (
                    <button
                      key={mi.id} type="button"
                      onClick={() => addItemToOrder(mi)}
                      style={{
                        padding: '0.375rem 0.875rem', borderRadius: '9999px',
                        border: '1px solid var(--surface-border)', background: 'var(--surface-color)',
                        color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
                        transition: 'all 0.15s ease', fontFamily: 'inherit'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    >
                      {mi.name}
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '0.375rem', fontSize: '0.8125rem' }}>${mi.price.toFixed(2)}</span>
                    </button>
                  ))}
                  {menuItems.length === 0 && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Sin platillos en el menú.</p>
                  )}
                </div>
              </div>

              {/* Order summary */}
              {orderItems.length > 0 && (
                <div>
                  <label className="form-label" style={{ marginBottom: '0.625rem', display: 'block' }}>Resumen</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {orderItems.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 0.875rem', background: 'var(--bg-color)',
                        borderRadius: '10px', border: '1px solid var(--surface-border)'
                      }}>
                        <span style={{ fontWeight: 500, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{item.product_name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button type="button" onClick={() => updateItemQuantity(idx, item.quantity - 1)}
                            style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-color)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ fontWeight: 700, minWidth: '20px', textAlign: 'center', fontSize: '0.9375rem' }}>{item.quantity}</span>
                          <button type="button" onClick={() => updateItemQuantity(idx, item.quantity + 1)}
                            style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-color)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', minWidth: '60px', textAlign: 'right' }}>${(item.price * item.quantity).toFixed(2)}</span>
                          <button type="button" onClick={() => removeItemFromOrder(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ textAlign: 'right', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.375rem', letterSpacing: '-0.015em' }}>
                      Total: <span style={{ color: 'var(--accent-blue)' }}>${orderTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ height: '48px', gap: '0.5rem' }}>
                <Send size={16} /> Enviar a Cocina
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
