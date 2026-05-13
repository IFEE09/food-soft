/**
 * POSTable — POS de Mesa estilo Soft Restaurant
 * Vista para tablet: plano de mesas con estado visual, selección de mesa,
 * menú por categorías con carrito por mesa y confirmación de pedido.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNotification } from '../components/NotificationProvider';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { apiClient } from '../api/client';
import {
  ArrowLeft, Users, Plus, Minus, Trash2, Send, Tag,
  Search, ChevronRight, Grid, List, RefreshCw, WifiOff
} from 'lucide-react';

const TABLE_STATUS_CONFIG = {
  available: { label: 'Disponible', color: 'var(--success-color)',  bg: 'var(--success-bg)',  border: 'var(--success-border)' },
  occupied:  { label: 'Ocupada',    color: 'var(--danger-color)',   bg: 'var(--danger-bg)',   border: 'var(--danger-border)' },
  reserved:  { label: 'Reservada',  color: 'var(--orange-color)',   bg: 'var(--orange-bg)',   border: 'var(--orange-border)' },
  cleaning:  { label: 'Limpieza',   color: '#888',     bg: 'rgba(136,136,136,0.1)', border: 'rgba(136,136,136,0.3)' },
};

export default function POSTable() {
  const { showAlert, showConfirm } = useNotification();

  // ── Offline queue ──────────────────────────────────────────────────────────
  const {
    isOnline, isSyncing, pendingCount, failedCount, queue,
    lastSyncAt, submitOrder, syncQueue, dequeue, clearQueue,
  } = useOfflineQueue({
    onSyncSuccess: (count) =>
      showAlert('Sincronizado', `${count} pedido(s) enviados a cocina.`, 'success'),
    onSyncError: () =>
      showAlert('Error de sincronización', 'Algunos pedidos no se pudieron enviar.', 'error'),
  });

  // ── Estado global ──────────────────────────────────────────────────────────
  const [view, setView]             = useState('floor');   // 'floor' | 'order'
  const [tables, setTables]         = useState([]);
  const [menuItems, setMenuItems]   = useState([]);
  const [stations, setStations]     = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Mesa seleccionada
  const [selectedTable, setSelectedTable] = useState(null);

  // Carrito por mesa: { [tableId]: [{id, name, price, qty, note}] }
  const [carts, setCarts]           = useState({});

  // Filtros del menú
  const [search, setSearch]         = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  // Datos del pedido
  const [clientName, setClientName] = useState('');
  const [stationId, setStationId]   = useState('');
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal nota
  const [noteModal, setNoteModal]   = useState(null);
  const [noteText, setNoteText]     = useState('');

  const kitchenId = localStorage.getItem('kitchenId');

  // ── Fetch inicial ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setRefreshing(true);
    try {
      const [tRes, mRes, sRes] = await Promise.all([
        apiClient.get('/tables/'),
        apiClient.get('/menu/'),
        apiClient.get(`/stations/?kitchen_id=${kitchenId}`),
      ]);
      setTables(tRes.data);
      setMenuItems(mRes.data);
      setStations(sRes.data);
      if (sRes.data.length > 0 && !stationId) setStationId(sRes.data[0].id.toString());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [kitchenId, stationId]);

  useEffect(() => { fetchAll(); }, []);

  // Auto-refresh del plano cada 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (view === 'floor') fetchAll(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [view, fetchAll]);

  // ── Categorías y filtros ───────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category || 'Sin Categoría'))];
    return ['ALL', ...cats];
  }, [menuItems]);

  const filteredMenu = useMemo(() => {
    let items = menuItems;
    if (activeCategory !== 'ALL') items = items.filter(i => (i.category || 'Sin Categoría') === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, activeCategory, search]);

  // ── Carrito helpers ────────────────────────────────────────────────────────
  const getCart = (tableId) => carts[tableId] || [];

  const addToCart = (tableId, item) => {
    setCarts(prev => {
      const cart = prev[tableId] || [];
      const idx = cart.findIndex(c => c.id === item.id && !c.note);
      if (idx >= 0) {
        const next = [...cart];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return { ...prev, [tableId]: next };
      }
      return { ...prev, [tableId]: [...cart, { id: item.id, name: item.name, price: item.price, qty: 1, note: '' }] };
    });
  };

  const updateQty = (tableId, idx, delta) => {
    setCarts(prev => {
      const cart = [...(prev[tableId] || [])];
      const newQty = cart[idx].qty + delta;
      if (newQty <= 0) cart.splice(idx, 1);
      else cart[idx] = { ...cart[idx], qty: newQty };
      return { ...prev, [tableId]: cart };
    });
  };

  const removeFromCart = (tableId, idx) => {
    setCarts(prev => {
      const cart = (prev[tableId] || []).filter((_, i) => i !== idx);
      return { ...prev, [tableId]: cart };
    });
  };

  const openNoteModal = (tableId, idx) => {
    setNoteModal({ tableId, idx });
    setNoteText(getCart(tableId)[idx]?.note || '');
  };

  const saveNote = () => {
    if (!noteModal) return;
    const { tableId, idx } = noteModal;
    setCarts(prev => {
      const cart = [...(prev[tableId] || [])];
      cart[idx] = { ...cart[idx], note: noteText };
      return { ...prev, [tableId]: cart };
    });
    setNoteModal(null);
    setNoteText('');
  };

  // ── Seleccionar mesa ───────────────────────────────────────────────────────
  const selectTable = (table) => {
    if (table.status === 'cleaning') {
      showAlert('Mesa en limpieza', 'Esta mesa no está disponible.', 'error');
      return;
    }
    setSelectedTable(table);
    setView('order');
    setSearch('');
    setActiveCategory('ALL');
  };

  const backToFloor = () => {
    setView('floor');
    setSelectedTable(null);
  };

  // ── Enviar pedido ──────────────────────────────────────────────────────────
  const cart = selectedTable ? getCart(selectedTable.id) : [];
  const total = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const itemCount = cart.reduce((acc, i) => acc + i.qty, 0);

  const handleSubmit = async () => {
    if (!selectedTable) return;
    if (cart.length === 0) { showAlert('Carrito vacío', 'Agrega al menos un producto.', 'error'); return; }

    const confirmed = await showConfirm(
      `Confirmar Pedido — Mesa ${selectedTable.number}`,
      `${itemCount} producto(s) — $${total.toFixed(2)}\n${clientName ? `Cliente: ${clientName}` : ''}`
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const payload = {
        client_name: clientName.trim() || `Mesa ${selectedTable.number}`,
        notes: notes.trim() || undefined,
        station_id: stationId ? parseInt(stationId) : undefined,
        channel: 'table',
        table_id: selectedTable.id,
        items: cart.map(c => ({ menu_item_id: c.id, quantity: c.qty, note: c.note || undefined })),
      };
      const result = await submitOrder(payload);
      // Marcar mesa como ocupada (best-effort, puede fallar offline)
      try { await apiClient.patch(`/tables/${selectedTable.id}/status`, { status: 'occupied' }); } catch { /* offline */ }
      if (result.offline) {
        showAlert(
          '📦 Pedido guardado localmente',
          `Sin conexión — el pedido de Mesa ${selectedTable.number} se enviará cuando vuelva el internet.`,
          'warning'
        );
      } else {
        showAlert('✅ Pedido enviado', `Pedido de Mesa ${selectedTable.number} enviado a cocina.`, 'success');
      }
      setCarts(prev => { const next = { ...prev }; delete next[selectedTable.id]; return next; });
      setClientName('');
      setNotes('');
      setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'occupied' } : t));
      backToFloor();
    } catch (err) {
      const detail = err.response?.data?.detail;
      showAlert('Error', typeof detail === 'string' ? detail : 'No se pudo crear el pedido.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Vista: Plano de mesas ──────────────────────────────────────────────────
  const hasBanner = !isOnline || isSyncing || pendingCount > 0 || failedCount > 0;

  if (view === 'floor') {
    return (
      <>
      <OfflineIndicator
        isOnline={isOnline} isSyncing={isSyncing}
        pendingCount={pendingCount} failedCount={failedCount}
        queue={queue} lastSyncAt={lastSyncAt}
        onSync={syncQueue} onDequeue={dequeue} onClearQueue={clearQueue}
      />
      <div style={{ padding: '1.5rem', marginTop: hasBanner ? '34px' : 0, transition: 'margin-top 0.2s' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-primary)' }}>
              PLANO DE MESAS
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {tables.filter(t => t.status === 'available').length} disponibles · {tables.filter(t => t.status === 'occupied').length} ocupadas · {tables.filter(t => t.status === 'reserved').length} reservadas
            </p>
          </div>
          <button onClick={() => fetchAll(true)} disabled={refreshing} style={{ background: 'none', border: '1px solid var(--surface-border)', borderRadius: '2px', padding: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem' }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Actualizar
          </button>
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {Object.entries(TABLE_STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: cfg.bg, border: `1px solid ${cfg.border}` }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cfg.label}</span>
            </div>
          ))}
        </div>

        {isLoading ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4rem' }}>Cargando mesas...</p>
        ) : tables.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-secondary)' }}>
            <Grid size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.85rem' }}>No hay mesas configuradas.</p>
            <p style={{ fontSize: '0.75rem' }}>Ve a Configuración → Mesas para agregar mesas.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
            {tables.map(table => {
              const cfg = TABLE_STATUS_CONFIG[table.status] || TABLE_STATUS_CONFIG.available;
              const cartItems = getCart(table.id);
              const hasItems = cartItems.length > 0;
              return (
                <button
                  key={table.id}
                  onClick={() => selectTable(table)}
                  style={{
                    background: cfg.bg, border: `2px solid ${cfg.border}`,
                    borderRadius: table.shape === 'round' ? '50%' : '4px',
                    padding: '1.25rem 1rem', cursor: 'pointer', textAlign: 'center',
                    transition: 'all 0.15s', position: 'relative',
                    aspectRatio: table.shape === 'round' ? '1' : 'auto',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: '110px',
                  }}
                >
                  {hasItems && (
                    <span style={{
                      position: 'absolute', top: '-6px', right: '-6px',
                      background: 'var(--orange-color)', color: 'var(--text-primary)', borderRadius: '50%',
                      width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.6rem', fontWeight: 800,
                    }}>{cartItems.reduce((a, c) => a + c.qty, 0)}</span>
                  )}
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: cfg.color, fontFamily: 'monospace', lineHeight: 1 }}>
                    {table.number}
                  </span>
                  {table.name && (
                    <span style={{ fontSize: '0.6rem', color: cfg.color, opacity: 0.8, marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{table.name}</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.4rem' }}>
                    <Users size={11} style={{ color: cfg.color, opacity: 0.7 }} />
                    <span style={{ fontSize: '0.65rem', color: cfg.color, opacity: 0.7 }}>{table.capacity}</span>
                  </div>
                  <span style={{ fontSize: '0.55rem', color: cfg.color, marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
       </div>
      </>
    );
  }
  // ── Vista: Toma de pedido (menú + carrito) ─────────────────────────────────
  const tableCfg = TABLE_STATUS_CONFIG[selectedTable?.status] || TABLE_STATUS_CONFIG.available;

  return (
    <>
    <OfflineIndicator
      isOnline={isOnline} isSyncing={isSyncing}
      pendingCount={pendingCount} failedCount={failedCount}
      queue={queue} lastSyncAt={lastSyncAt}
      onSync={syncQueue} onDequeue={dequeue} onClearQueue={clearQueue}
    />
    <div className="pos-layout" style={{ display: 'flex', height: 'calc(100vh - 80px)', gap: '0', overflow: 'hidden', marginTop: hasBanner ? '34px' : 0, transition: 'margin-top 0.2s' }}>
      <div className="pos-menu-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--surface-border)' }}>

        {/* Header */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={backToFloor} style={{ background: 'none', border: '1px solid var(--surface-border)', borderRadius: '2px', padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', fontWeight: 700 }}>
            <ArrowLeft size={13} /> Plano
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', background: tableCfg.bg, border: `1px solid ${tableCfg.border}`, borderRadius: '2px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: tableCfg.color, fontFamily: 'monospace' }}>MESA {selectedTable?.number}</span>
            {selectedTable?.name && <span style={{ fontSize: '0.65rem', color: tableCfg.color, opacity: 0.8 }}>· {selectedTable.name}</span>}
            <Users size={12} style={{ color: tableCfg.color }} />
            <span style={{ fontSize: '0.65rem', color: tableCfg.color }}>{selectedTable?.capacity}</span>
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input type="text" placeholder="Buscar..." style={{ paddingLeft: '30px', fontSize: '0.78rem', width: '100%' }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Tabs categorías */}
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--surface-border)', padding: '0 1rem' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: '0.55rem 0.9rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
              borderBottom: activeCategory === cat ? '2px solid var(--primary-color)' : '2px solid transparent',
              color: activeCategory === cat ? 'var(--primary-color)' : 'var(--text-secondary)',
              fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
            }}>{cat === 'ALL' ? 'TODO' : cat}</button>
          ))}
        </div>

        {/* Grid productos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          <div className="pos-menu-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.65rem' }}>
            {filteredMenu.map(item => {
              const inCart = cart.filter(c => c.id === item.id).reduce((a, c) => a + c.qty, 0);
              return (
                <button key={item.id} onClick={() => addToCart(selectedTable.id, item)} style={{
                  background: inCart > 0 ? 'rgba(204,255,0,0.06)' : 'var(--surface-color)',
                  border: inCart > 0 ? '1px solid var(--primary-border)' : '1px solid var(--surface-border)',
                  borderRadius: '4px', padding: '0.9rem', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s', position: 'relative',
                }}>
                  {inCart > 0 && (
                    <span style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--primary-color)', color: 'var(--text-primary)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800 }}>{inCart}</span>
                  )}
                  <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.name}</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary-color)', fontFamily: 'monospace' }}>${item.price}</p>
                </button>
              );
            })}
            {filteredMenu.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', gridColumn: '1/-1', textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem' }}>Sin resultados.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Panel derecho: Carrito ── */}
      <div className="pos-cart-panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', background: 'var(--surface-color)' }}>
        <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>PEDIDO</span>
          {itemCount > 0 && (
            <span style={{ marginLeft: 'auto', background: 'var(--primary-color)', color: 'var(--text-primary)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800 }}>{itemCount}</span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem 1.1rem' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '0.75rem' }}>Selecciona productos del menú</p>
            </div>
          ) : cart.map((item, idx) => (
            <div key={idx} style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</p>
                  {item.note && <p style={{ margin: '0.15rem 0 0', fontSize: '0.62rem', color: 'var(--primary-color)', fontStyle: 'italic' }}>✎ {item.note}</p>}
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    ${item.price} × {item.qty} = <strong style={{ color: 'var(--text-primary)' }}>${(item.price * item.qty).toFixed(2)}</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <button onClick={() => updateQty(selectedTable.id, idx, -1)} style={{ background: 'var(--neutral-bg)', border: '1px solid var(--surface-border)', borderRadius: '2px', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}><Minus size={10} /></button>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, minWidth: '14px', textAlign: 'center' }}>{item.qty}</span>
                    <button onClick={() => updateQty(selectedTable.id, idx, 1)} style={{ background: 'var(--neutral-bg)', border: '1px solid var(--surface-border)', borderRadius: '2px', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}><Plus size={10} /></button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.2rem' }}>
                    <button onClick={() => openNoteModal(selectedTable.id, idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '1px' }}><Tag size={11} /></button>
                    <button onClick={() => removeFromCart(selectedTable.id, idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: '1px' }}><Trash2 size={11} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '0.9rem 1.1rem', borderTop: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>TOTAL</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary-color)' }}>${total.toFixed(2)}</span>
          </div>

          <input
            type="text" placeholder="Nombre del cliente (opcional)..."
            style={{ fontSize: '0.78rem', padding: '0.55rem 0.75rem' }}
            value={clientName} onChange={e => setClientName(e.target.value)}
          />

          {stations.length > 0 && (
            <select value={stationId} onChange={e => setStationId(e.target.value)} style={{ fontSize: '0.78rem', padding: '0.5rem' }}>
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          <textarea
            placeholder="Notas del pedido..."
            rows={2}
            style={{ resize: 'none', fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
            value={notes} onChange={e => setNotes(e.target.value)}
          />

          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting || cart.length === 0}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.8rem' }}
          >
            <Send size={15} />
            {submitting ? 'Enviando...' : `Enviar — Mesa ${selectedTable?.number}`}
          </button>
        </div>
      </div>

      {/* Modal nota */}
      {noteModal !== null && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '340px' }}>
            <div className="modal-header">
              <h2>Nota: {getCart(noteModal.tableId)[noteModal.idx]?.name}</h2>
              <button onClick={() => setNoteModal(null)} className="modal-close">×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input type="text" placeholder="Ej: sin cebolla, extra queso..." value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveNote()} autoFocus />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setNoteModal(null)} style={{ flex: 1, padding: '0.65rem', background: 'none', border: '1px solid var(--surface-border)', borderRadius: '2px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Cancelar</button>
                <button onClick={saveNote} className="btn-primary" style={{ flex: 1 }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
