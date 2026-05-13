import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ChefHat,
  Package,
  ClipboardList,
  LogOut,
  Settings as SettingsIcon,
  Utensils,
  Activity,
  ShoppingBag,
  Users,
  ShieldCheck,
  HeadphonesIcon,
  Building2,
  ChevronDown,
  FileText,
  Monitor,
  TableProperties,
  CalendarDays,
  MessageSquare,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { apiClient } from '../api/client';

const ROLE_LABEL = { owner: 'Dueño', receptionist: 'Recepcionista', cook: 'Cocinero' };
const ROLE_ICON  = { owner: ShieldCheck, receptionist: HeadphonesIcon, cook: ChefHat };

export default function DashboardLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const role      = localStorage.getItem('role') || 'cook';
  const userName  = localStorage.getItem('userName') || 'Usuario';
  const currentOrgId = localStorage.getItem('organizationId');

  const [organizations, setOrganizations]   = useState([]);
  const [activeOrg, setActiveOrg]           = useState(null);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const orgRef  = useRef(null);

  useEffect(() => {
    if (role === 'owner') fetchOrganizations();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (orgRef.current && !orgRef.current.contains(e.target)) setShowOrgSelector(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchOrganizations = async () => {
    try {
      const { data } = await apiClient.get('/users/me/organizations');
      setOrganizations(data);
      const active = data.find(o => String(o.id) === String(currentOrgId));
      setActiveOrg(active || data[0]);
    } catch (e) { console.error(e); }
  };

  const switchOrganization = (org) => {
    localStorage.setItem('organizationId', org.id);
    setActiveOrg(org);
    setShowOrgSelector(false);
    window.location.reload();
  };

  const handleLogout = () => {
    ['token','refresh_token','role','userName','organizationId','kitchenId','kitchenName']
      .forEach(k => localStorage.removeItem(k));
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;
  const currentKitchenId   = localStorage.getItem('kitchenId');
  const currentKitchenName = localStorage.getItem('kitchenName');

  const clearKitchenContext = () => {
    localStorage.removeItem('kitchenId');
    localStorage.removeItem('kitchenName');
    navigate('/dashboard/kitchen');
    window.location.reload();
  };

  // ── Nav items by role ─────────────────────────────────────────────────────
  const getNavItems = () => {
    const isKitchenSelected = !!currentKitchenId;

    if (role === 'owner') {
      return [
        { path: '/dashboard/owner',        icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/dashboard/kitchen',      icon: Building2,       label: 'Cocinas' },
        { path: '/dashboard/chat-simulator', icon: MessageSquare, label: 'Bot Simulator' },
        { path: '/dashboard/order-history',icon: FileText,        label: 'Historial' },
        { path: '/dashboard/activity-logs',icon: Activity,        label: 'Actividad' },
        { path: '/dashboard/settings',     icon: SettingsIcon,    label: 'Config' },
        ...(isKitchenSelected ? [
          { divider: true, label: currentKitchenName },
          { path: '/dashboard/reception',  icon: ShoppingBag,     label: 'Recepción' },
          { path: '/dashboard/pos-counter',icon: Monitor,         label: 'POS Mostrador' },
          { path: '/dashboard/pos-table',  icon: TableProperties, label: 'POS Mesas' },
          { path: '/dashboard/reservations',icon: CalendarDays,   label: 'Reservas' },
          { path: '/dashboard/menu',       icon: Utensils,        label: 'Menú' },
          { path: '/dashboard/supplies',   icon: Package,         label: 'Stock' },
          { path: '/dashboard/team',       icon: Users,           label: 'Equipo' },
        ] : []),
      ];
    }
    // cook / receptionist
    return [
      { path: '/dashboard/kitchen',    icon: Building2,    label: 'Cocinas' },
      { path: '/dashboard/chat-simulator', icon: MessageSquare, label: 'Bot Simulator' },
      ...(isKitchenSelected ? [
        { path: '/dashboard/reception',icon: ShoppingBag,  label: 'Recepción' },
        { path: '/dashboard/cook',     icon: ClipboardList,label: 'Monitor' },
      ] : []),
      { path: '/dashboard/settings',   icon: SettingsIcon, label: 'Perfil' },
    ];
  };

  const navItems = getNavItems();
  const roleLabel  = ROLE_LABEL[role] || 'Usuario';
  const RoleIcon   = ROLE_ICON[role]  || ShieldCheck;
  const roleColor  = role === 'owner' ? 'var(--success-color)' : role === 'receptionist' ? 'var(--primary-color)' : 'var(--text-secondary)';
  const roleBg     = role === 'owner' ? 'var(--success-bg)'    : role === 'receptionist' ? 'var(--primary-bg)'    : 'var(--neutral-bg)';
  const roleBorder = role === 'owner' ? 'var(--success-border)': role === 'receptionist' ? 'var(--primary-border)': 'var(--surface-border)';

  const initials = userName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  // ── Render nav link ───────────────────────────────────────────────────────
  const NavLink = ({ item, mobile = false }) => {
    if (item.divider) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: mobile ? '0.5rem 0' : '0 0.5rem',
          color: 'var(--success-color)', fontSize: '0.65rem', fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap',
          borderLeft: mobile ? 'none' : '1px solid var(--surface-border)',
          borderTop: mobile ? '1px solid var(--surface-border)' : 'none',
          marginLeft: mobile ? 0 : '0.25rem', paddingLeft: mobile ? 0 : '0.75rem',
          marginTop: mobile ? '0.5rem' : 0
        }}>
          <Building2 size={10} /> {item.label}
        </div>
      );
    }
    const active = isActive(item.path);
    return (
      <button
        onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
        style={{
          display: 'flex', alignItems: 'center', gap: mobile ? '0.6rem' : '0.4rem',
          padding: mobile ? '0.7rem 0.85rem' : '0.45rem 0.75rem',
          borderRadius: 'var(--radius-md)', border: active ? '1px solid rgba(26, 86, 219, 0.25)' : '1px solid transparent',
          background: active ? 'var(--success-bg)' : 'transparent',
          color: active ? 'var(--success-color)' : 'var(--text-secondary)',
          fontWeight: active ? 700 : 500, fontSize: mobile ? '0.9rem' : '0.8rem',
          cursor: 'pointer', whiteSpace: 'nowrap', width: mobile ? '100%' : 'auto',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}}
      >
        <item.icon size={mobile ? 16 : 14} />
        {item.label}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-color)' }}>

      {/* ── TOP NAVBAR ─────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'var(--surface-color)',
        borderBottom: '1px solid var(--surface-border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex', alignItems: 'center', gap: '0', height: '60px',
        padding: '0 1.5rem',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginRight: '1.5rem', flexShrink: 0 }}>
          <img src="/omnikook-logo.png" alt="omnikook" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', fontFamily: 'Inter, sans-serif' }}>
            <span style={{ color: 'var(--accent-blue)' }}>o</span><span style={{ color: 'var(--text-primary)' }}>mnikook</span>
          </span>
        </div>

        {/* Nav links — desktop */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}
          className="hide-scrollbar desktop-nav">
          {navItems.map((item, i) => <NavLink key={i} item={item} />)}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: 'auto', flexShrink: 0 }}>

          {/* Kitchen context badge */}
          {currentKitchenId && (
            <button onClick={clearKitchenContext} style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--success-border)', background: 'rgba(26, 86, 219, 0.06)',
              color: 'var(--success-color)', fontSize: '0.72rem', fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap'
            }} title="Cambiar sucursal">
              <Building2 size={11} /> {currentKitchenName}
            </button>
          )}

          {/* Org selector — owner only */}
          {role === 'owner' && (
            <div ref={orgRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowOrgSelector(v => !v)} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--surface-border)', background: 'var(--bg-color)',
                color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
              }}>
                <Building2 size={13} color="var(--success-color)" />
                {activeOrg?.name || '...'}
                <ChevronDown size={12} style={{ transform: showOrgSelector ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {showOrgSelector && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: '220px',
                  background: 'var(--surface-color)', border: '1px solid var(--surface-border)',
                  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 300, padding: '0.5rem'
                }}>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.3rem 0.5rem 0.5rem' }}>Mis Restaurantes</p>
                  {organizations.map(org => (
                    <div key={org.id} onClick={() => switchOrganization(org)} style={{
                      padding: '0.55rem 0.75rem', fontSize: '0.82rem', cursor: 'pointer', borderRadius: 'var(--radius-md)',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      color: org.id === activeOrg?.id ? 'var(--success-color)' : 'var(--text-primary)',
                      background: org.id === activeOrg?.id ? 'var(--success-bg)' : 'transparent'
                    }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: org.id === activeOrg?.id ? 'var(--success-color)' : 'var(--surface-border)', flexShrink: 0 }} />
                      {org.name}
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '0.4rem', paddingTop: '0.4rem' }}>
                    <button onClick={() => { navigate('/dashboard/settings'); setShowOrgSelector(false); }} style={{
                      width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.75rem',
                      background: 'transparent', border: 'none', color: 'var(--primary-color)',
                      cursor: 'pointer', textAlign: 'left', fontWeight: 600
                    }}>+ Añadir Restaurante</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.3rem 0.75rem 0.3rem 0.6rem', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)', background: 'var(--bg-color)'
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              background: roleBg, color: roleColor, padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)',
              fontFamily: 'JetBrains Mono, monospace', border: `1px solid ${roleBorder}`
            }}>
              <RoleIcon size={10} /> {roleLabel}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{userName}</span>
            <div style={{
              width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
              background: roleBg, color: roleColor, border: `1px solid ${roleBorder}`,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              fontWeight: 700, fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0
            }}>{initials}</div>
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme} title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.4rem', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--success-color)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Logout */}
          <button onClick={handleLogout} title="Cerrar sesión" style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger-color)'; e.currentTarget.style.borderColor = 'var(--danger-border)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
          >
            <LogOut size={14} />
            <span className="hide-mobile">Salir</span>
          </button>

          {/* Hamburger — mobile */}
          <button onClick={() => setMobileMenuOpen(v => !v)} className="mobile-menu-btn" style={{
            display: 'none', alignItems: 'center', justifyContent: 'center',
            padding: '0.4rem', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)', background: 'transparent',
            color: 'var(--text-primary)', cursor: 'pointer'
          }}>
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* ── MOBILE DROPDOWN MENU ──────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed', top: '52px', left: 0, right: 0, zIndex: 190,
          background: 'var(--surface-color)', borderBottom: '1px solid var(--surface-border)',
          padding: '0.75rem 1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          {navItems.map((item, i) => <NavLink key={i} item={item} mobile />)}
        </div>
      )}

      {/* ── PAGE CONTENT ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '1.75rem 2rem', overflow: 'auto' }}>
        <Outlet />
      </main>

      <style>{`
        @media (max-width: 767px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .hide-mobile { display: none !important; }
          main { padding: 1.25rem !important; }
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
