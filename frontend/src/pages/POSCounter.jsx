/**
 * POSCounter — POS de Mostrador / Llamada
 * Con modo offline: guarda pedidos en localStorage si no hay red,
 * sincroniza automáticamente al recuperar la conexión.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNotification } from '../components/NotificationProvider';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { OfflineIndicator } from '../components/OfflineIndicator';
import {
  ShoppingCart, Phone, User, Search, Plus, Minus,
  Trash2, Send, X, Tag, Zap, WifiOff
} from 'lucide-react';
import { apiClient } from '../api/client';

const CHANNELS = [
  { id: 'pos',  label: 'En Mostrador', icon: '🏪' },
  { id: 'call', label: 'Por Teléfono', icon: '📞' },
];

export default function POSCounter() {
  const { showAlert, showConfirm } = useNotification();

  // ── Offline queue ─────────────────────────────────────────────────────────
  const {
    isOnline, isSyncing, pendingCount, failedCount, queue,
    lastSyncAt, submitOrder, syncQueue, dequeue, clearQueue,
  } = useOfflineQueue({
    onSyncSuccess: (count) =>
      showAlert('Sincronizado', `${count} pedido(s) enviados a cocina.`, 'success'),
    onSyncError: () =>
      showAlert('Error de sincronización', 'Algunos pedidos no se pudieron enviar. Revisa la cola.', 'error'),
  });

  // ── Estado local ──────────────────────────────────────────────────────────
  const [menuItems, setMenuItems]   = useState([]);
  const [stations, setStations]     = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [search, setSearch]         = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  const [cart, setCart]             = useState([]);
  const [clientName, setClientName] = useState('');
  const [channel, setChannel]       = useState('pos');
  const [stationId, setStationId]   = useState('');
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [noteModal, setNoteModal]   = useState(null);
  const [noteText, setNoteText]     = useState('');

  const kitchenId   = localStorage.getItem('kitchenId');
  const kitchenName = localStorage.getItem('kitchenName') || 'Cocina';

  // ── Carga inicial del menú ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [mRes, sRes] = await Promise.all([
        apiClient.get('/menu/'),
        apiClient.get(`/stations/?kitchen_id=${kitchenId}`),
      ]);
      setMenuItems(mRes.data);
      setStations(sRes.data);
      if (sRes.data.length > 0) setStationId(sRes.data[0].id.toString());
    } catch (err) {
      // Si no hay red, intentar cargar menú desde caché
      const cached = localStorage.getItem('omnikook_menu_cache');
      if (cached) {
        try {
          const { items, stns } = JSON.parse(cached);
          setMenuItems(items || []);
          setStations(stns || []);
          if (stns?.length > 0) setStationId(stns[0].id.toString());
          showAlert('Modo offline', 'Usando menú guardado localmente.', 'warning');
        } catch { /* nada */ }
      }
    } finally {
      setIsLoading(false);
    }
  }, [kitchenId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  // Guardar menú en caché cuando se carga online
  useEffect(() => {
    if (menuItems.length > 0 && isOnline) {
      localStorage.setItem('omnikook_menu_cache', JSON.stringify({ items: menuItems, stns: stations }));
    }
  }, [menuItems, stations, isOnline]);

  // ── Categorías y filtros ──────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category || 'Sin Categoría'))];
    return ['ALL', ...cats];
  }, [menuItems]);

  const filtered = useMemo(() => {
    let items = menuItems;
    if (activeCategory !== 'ALL') items = items.filter(i => (i.category || 'Sin Categoría') === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, activeCategory, search]);

  // ── Carrito helpers ───────────────────────────────────────────────────────
  const addToCart = (item) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === item.id && !c.note);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, note: '' }];
    });
  };

  const updateQty = (idx, delta) => {
    setCart(prev => {
      const next = [...prev];
      const newQty = next[idx].qty + delta;
      if (newQty <= 0) return next.filter((_, i) => i !== idx);
      next[idx] = { ...next[idx], qty: newQty };
      return next;
    });
  };

  const removeFromCart = (idx) => setCart(prev => prev.filter((_, i) => i !== idx));

  const openNoteModal = (idx) => { setNoteModal(idx); setNoteText(cart[idx]?.note || ''); };
  const saveNote = () => {
    if (noteModal === null) return;
    setCart(prev => {
      const next = [...prev];
      next[noteModal] = { ...next[noteModal], note: noteText };
      return next;
    });
    setNoteModal(null);
    setNoteText('');
  };

  const total     = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const itemCount = cart.reduce((acc, i) => acc + i.qty, 0);

  // ── Enviar pedido (online → API, offline → localStorage) ─────────────────
  const handleSubmit = async () => {
    if (cart.length === 0) { showAlert('Carrito vacío', 'Agrega al menos un producto.', 'error'); return; }
    if (!clientName.trim()) { showAlert('Nombre requerido', 'Escribe el nombre del cliente.', 'error'); return; }

    const confirmed = await showConfirm(
      'Confirmar Pedido',
      `${itemCount} producto(s) — $${total.toFixed(2)}\nCliente: ${clientName}\nCanal: ${channel === 'pos' ? 'Mostrador' : 'Teléfono'}${!isOnline ? '\n\n⚠️ Sin conexión — se guardará localmente' : ''}`
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const payload = {
        client_name: clientName.trim(),
        notes: notes.trim() || undefined,
        station_id: stationId ? parseInt(stationId) : undefined,
        channel,
        items: cart.map(c => ({ menu_item_id: c.id, quantity: c.qty, note: c.note || undefined })),
      };

      const result = await submitOrder(payload);

      if (result.offline) {
        showAlert(
          '📦 Pedido guardado localmente',
          `Sin conexión — el pedido de ${clientName} se enviará automáticamente cuando vuelva el internet.`,
          'warning'
        );
      } else {
        showAlert('✅ Pedido enviado', `Pedido de ${clientName} enviado a cocina.`, 'success');
      }

      setCart([]);
      setClientName('');
      setNotes('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      showAlert('Error', typeof detail === 'string' ? detail : 'No se pudo crear el pedido.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const hasBanner = !isOnline || isSyncing || pendingCount > 0 || failedCount > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <OfflineIndicator
        isOnline={isOnline} isSyncing={isSyncing}
        pendingCount={pendingCount} failedCount={failedCount}
        queue={queue} lastSyncAt={lastSyncAt}
        onSync={syncQueue} onDequeue={dequeue} onClearQueue={clearQueue}
      />

      <div style={{
        display: 'flex', height: 'calc(100vh - 80px)', gap: '0', overflow: 'hidden',
        marginTop: hasBanner ? '34px' : 0,
        transition: 'margin-top 0.2s',
      }}>

        {/* ── Panel izquierdo: Menú ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--surface-border)' }}>

          {/* Header */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={16} style={{ color: 'var(--primary-color)' }} />
              <span style={{ fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>
                POS — {kitchenName}
              </span>
              {!isOnline && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '2px', padding: '0.15rem 0.5rem', fontSize: '0.6rem', fontWeight: 800, color: 'var(--danger-color)', textTransform: 'uppercase' }}>
                  <WifiOff size={10} /> OFFLINE
                </span>
              )}
            </div>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text" placeholder="Buscar producto..."
                style={{ width: '100%', paddingLeft: '34px', fontSize: '0.8rem' }}
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Tabs categorías */}
          <div style={{ display: 'flex', gap: '0', overflowX: 'auto', borderBottom: '1px solid var(--surface-border)', padding: '0 1rem' }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                padding: '0.6rem 1rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                borderBottom: activeCategory === cat ? '2px solid var(--primary-color)' : '2px solid transparent',
                color: activeCategory === cat ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{cat === 'ALL' ? 'TODO' : cat}</button>
            ))}
          </div>

          {/* Grid de productos */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
            {isLoading ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '3rem' }}>Cargando menú...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {filtered.map(item => {
                  const inCart = cart.filter(c => c.id === item.id).reduce((a, c) => a + c.qty, 0);
                  return (
                    <button key={item.id} onClick={() => addToCart(item)} style={{
                      background: inCart > 0 ? 'rgba(204,255,0,0.06)' : 'var(--surface-color)',
                      border: inCart > 0 ? '1px solid var(--primary-border)' : '1px solid var(--surface-border)',
                      borderRadius: '4px', padding: '1rem', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s', position: 'relative',
                    }}>
                      {inCart > 0 && (
                        <span style={{
                          position: 'absolute', top: '8px', right: '8px',
                          background: 'var(--primary-color)', color: '#000',
                          borderRadius: '50%', width: '20px', height: '20px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 800,
                        }}>{inCart}</span>
                      )}
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.name}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-color)', fontFamily: 'monospace' }}>${item.price}</p>
                      {item.category && (
                        <p style={{ margin: '0.3rem 0 0', fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.category}</p>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', gridColumn: '1/-1', textAlign: 'center', marginTop: '2rem' }}>Sin resultados.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel derecho: Carrito ── */}
        <div style={{ width: '340px', display: 'flex', flexDirection: 'column', background: 'var(--surface-color)' }}>

          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={16} style={{ color: 'var(--primary-color)' }} />
            <span style={{ fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>CARRITO</span>
            {itemCount > 0 && (
              <span style={{ marginLeft: 'auto', background: 'var(--primary-color)', color: '#000', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>{itemCount}</span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-secondary)' }}>
                <ShoppingCart size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.75rem' }}>Carrito vacío</p>
              </div>
            ) : cart.map((item, idx) => (
              <div key={idx} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</p>
                    {item.note && (
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.65rem', color: 'var(--primary-color)', fontStyle: 'italic' }}>✎ {item.note}</p>
                    )}
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      ${item.price} × {item.qty} = <strong style={{ color: 'var(--text-primary)' }}>${(item.price * item.qty).toFixed(2)}</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <button onClick={() => updateQty(idx, -1)} style={{ background: 'var(--neutral-bg)', border: '1px solid var(--surface-border)', borderRadius: '2px', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}><Minus size={11} /></button>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => updateQty(idx, 1)} style={{ background: 'var(--neutral-bg)', border: '1px solid var(--surface-border)', borderRadius: '2px', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}><Plus size={11} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => openNoteModal(idx)} title="Agregar nota" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}><Tag size={12} /></button>
                      <button onClick={() => removeFromCart(idx)} title="Quitar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: '2px' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total y datos */}
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>TOTAL</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary-color)' }}>${total.toFixed(2)}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              {CHANNELS.map(ch => (
                <button key={ch.id} onClick={() => setChannel(ch.id)} style={{
                  padding: '0.5rem', borderRadius: '2px', cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem',
                  textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.15s',
                  background: channel === ch.id ? 'rgba(204,255,0,0.1)' : 'var(--neutral-bg)',
                  border: channel === ch.id ? '1px solid var(--primary-color)' : '1px solid var(--surface-border)',
                  color: channel === ch.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                }}>{ch.icon} {ch.label}</button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--neutral-bg)', border: '1px solid var(--surface-border)', borderRadius: '2px', padding: '0 0.75rem' }}>
              <User size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <input
                type="text" placeholder="Nombre del cliente..."
                style={{ border: 'none', background: 'none', flex: 1, padding: '0.6rem 0', fontSize: '0.8rem', outline: 'none', color: 'var(--text-primary)' }}
                value={clientName} onChange={e => setClientName(e.target.value)}
              />
            </div>

            {stations.length > 0 && (
              <select value={stationId} onChange={e => setStationId(e.target.value)} style={{ fontSize: '0.8rem', padding: '0.5rem' }}>
                {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}

            <textarea
              placeholder="Notas del pedido (opcional)..."
              rows={2}
              style={{ resize: 'none', fontSize: '0.78rem', padding: '0.5rem 0.75rem' }}
              value={notes} onChange={e => setNotes(e.target.value)}
            />

            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.85rem',
                background: !isOnline ? 'rgba(255,170,0,0.15)' : undefined,
                borderColor: !isOnline ? 'rgba(255,170,0,0.5)' : undefined,
                color: !isOnline ? '#ffaa00' : undefined,
              }}
            >
              {!isOnline ? <><WifiOff size={15} /> Guardar Offline</> : <><Send size={16} /> Enviar a Cocina</>}
              {submitting && '...'}
            </button>

            {pendingCount > 0 && (
              <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--orange-color)', textAlign: 'center', fontWeight: 700 }}>
                ⏳ {pendingCount} pedido(s) en cola esperando conexión
              </p>
            )}
          </div>
        </div>

        {/* ── Modal: Nota por item ── */}
        {noteModal !== null && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '360px' }}>
              <div className="modal-header">
                <h2>Nota para: {cart[noteModal]?.name}</h2>
                <button onClick={() => setNoteModal(null)} className="modal-close">×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                  type="text"
                  placeholder="Ej: sin cebolla, extra queso..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveNote()}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setNoteModal(null)} style={{ flex: 1, padding: '0.7rem', background: 'none', border: '1px solid var(--surface-border)', borderRadius: '2px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Cancelar</button>
                  <button onClick={saveNote} className="btn-primary" style={{ flex: 1 }}>Guardar Nota</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
