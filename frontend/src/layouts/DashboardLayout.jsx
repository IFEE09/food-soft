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
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  // ── Render nav link ───────────────────────────────────────────────────────
  const NavLink = ({ item, mobile = false }) => {
    if (item.divider) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          padding: mobile ? '0.5rem 0' : '0 0.5rem',
          color: 'var(--accent-blue)', fontSize: '0.625rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap',
          borderLeft: mobile ? 'none' : '1px solid var(--surface-border)',
          borderTop: mobile ? '1px solid var(--surface-border)' : 'none',
          marginLeft: mobile ? 0 : '0.25rem', paddingLeft: mobile ? 0 : '0.75rem',
          marginTop: mobile ? '0.5rem' : 0
        }}>
          <Building2 size={9} /> {item.label}
        </div>
      );
    }
    const active = isActive(item.path);
    return (
      <button
        onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
        style={{
          display: 'flex', alignItems: 'center', gap: mobile ? '0.6rem' : '0.375rem',
          padding: mobile ? '0.7rem 0.875rem' : '0.4375rem 0.75rem',
          borderRadius: '8px',
          border: active ? '1px solid var(--accent-border)' : '1px solid transparent',
          background: active ? 'var(--accent-subtle)' : 'transparent',
          color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
          fontWeight: active ? 600 : 500,
          fontSize: mobile ? '0.9375rem' : '0.8125rem',
          letterSpacing: '-0.005em',
          cursor: 'pointer', whiteSpace: 'nowrap', width: mobile ? '100%' : 'auto',
          transition: 'all 0.15s ease',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => {
          if (!active) {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.background = 'var(--neutral-bg)';
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <item.icon size={mobile ? 16 : 14} strokeWidth={active ? 2.5 : 2} />
        {item.label}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-color)' }}>

      {/* ── TOP NAVBAR — Square white style ────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'var(--navbar-bg)',
        borderBottom: '1px solid var(--navbar-border)',
        display: 'flex', alignItems: 'center', gap: 0, height: '60px',
        padding: '0 1.5rem',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1.5rem', flexShrink: 0 }}>
          <img src="/omnikook-logo.png" alt="omnikook" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
          <span style={{
            fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em',
            fontFamily: "'Inter', sans-serif", color: 'var(--navbar-text)'
          }}>
            <span style={{ color: 'var(--navbar-active)' }}>o</span>mnikook
          </span>
        </div>

        {/* Nav links — desktop */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.125rem', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}
          className="hide-scrollbar desktop-nav"
        >
          {navItems.map((item, i) => <NavLink key={i} item={item} />)}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', flexShrink: 0 }}>

          {/* Kitchen context badge */}
          {currentKitchenId && (
            <button onClick={clearKitchenContext} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.3rem 0.75rem', borderRadius: '9999px',
              border: '1px solid var(--accent-border)', background: 'var(--accent-subtle)',
              color: 'var(--accent-blue)', fontSize: '0.6875rem', fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit'
            }} title="Cambiar sucursal">
              <Building2 size={11} /> {currentKitchenName}
            </button>
          )}

          {/* Org selector — owner only */}
          {role === 'owner' && (
            <div ref={orgRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowOrgSelector(v => !v)} style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.375rem 0.75rem', borderRadius: '8px',
                border: '1px solid var(--surface-border)', background: 'var(--bg-color)',
                color: 'var(--text-primary)', fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em'
              }}>
                <Building2 size={13} color="var(--accent-blue)" />
                {activeOrg?.name || '...'}
                <ChevronDown size={12} style={{ transform: showOrgSelector ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {showOrgSelector && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: '220px',
                  background: 'var(--surface-color)', border: '1px solid var(--surface-border)',
                  borderRadius: '16px', boxShadow: 'var(--shadow-lg)', zIndex: 300, padding: '0.5rem'
                }}>
                  <p style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0.3rem 0.5rem 0.5rem', fontWeight: 600 }}>Mis Restaurantes</p>
                  {organizations.map(org => (
                    <div key={org.id} onClick={() => switchOrganization(org)} style={{
                      padding: '0.5rem 0.75rem', fontSize: '0.8125rem', cursor: 'pointer', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      color: org.id === activeOrg?.id ? 'var(--accent-blue)' : 'var(--text-primary)',
                      background: org.id === activeOrg?.id ? 'var(--accent-subtle)' : 'transparent',
                      fontWeight: org.id === activeOrg?.id ? 600 : 400,
                      transition: 'all 0.15s ease'
                    }}>
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: org.id === activeOrg?.id ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                        flexShrink: 0
                      }} />
                      {org.name}
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '0.4rem', paddingTop: '0.4rem' }}>
                    <button onClick={() => { navigate('/dashboard/settings'); setShowOrgSelector(false); }} style={{
                      width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.75rem',
                      background: 'transparent', border: 'none', color: 'var(--accent-blue)',
                      cursor: 'pointer', textAlign: 'left', fontWeight: 600, fontFamily: 'inherit'
                    }}>+ Añadir Restaurante</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.3rem 0.75rem 0.3rem 0.5rem', borderRadius: '9999px',
            border: '1px solid var(--surface-border)', background: 'var(--bg-color)'
          }}>
            {/* Avatar circle */}
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: 'var(--accent-subtle)', color: 'var(--accent-blue)',
              border: '1.5px solid var(--accent-border)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              fontWeight: 700, fontSize: '0.6875rem', flexShrink: 0, letterSpacing: '0.02em'
            }}>{initials}</div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{userName}</span>
            <span style={{
              fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              background: 'var(--accent-subtle)', color: 'var(--accent-blue)',
              padding: '0.125rem 0.4rem', borderRadius: '4px',
              border: '1px solid var(--accent-border)'
            }}>{roleLabel}</span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px',
              borderRadius: '8px',
              border: '1px solid var(--surface-border)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--neutral-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.4375rem 0.75rem', borderRadius: '8px',
              border: '1px solid var(--surface-border)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger-color)'; e.currentTarget.style.borderColor = 'var(--danger-border)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
          >
            <LogOut size={14} />
            <span className="hide-mobile">Salir</span>
          </button>

          {/* Hamburger — mobile */}
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="mobile-menu-btn"
            style={{
              display: 'none', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px',
              borderRadius: '8px',
              border: '1px solid var(--surface-border)', background: 'transparent',
              color: 'var(--text-primary)', cursor: 'pointer'
            }}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* ── MOBILE DROPDOWN MENU ──────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed', top: '60px', left: 0, right: 0, zIndex: 190,
          background: 'var(--surface-color)', borderBottom: '1px solid var(--surface-border)',
          padding: '0.75rem 1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {navItems.map((item, i) => <NavLink key={i} item={item} mobile />)}
        </div>
      )}

      {/* ── PAGE CONTENT ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '1.5rem 2rem', overflow: 'auto' }}>
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
