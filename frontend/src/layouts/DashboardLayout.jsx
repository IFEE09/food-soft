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
  Moon,
  ChevronRight
} from 'lucide-react';
import { apiClient } from '../api/client';

const ROLE_LABEL = { owner: 'Dueño', receptionist: 'Recepcionista', cook: 'Cocinero' };
const ROLE_ICON  = { owner: ShieldCheck, receptionist: HeadphonesIcon, cook: ChefHat };

const SIDEBAR_WIDTH = 220;

export default function DashboardLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const role      = localStorage.getItem('role') || 'cook';
  const userName  = localStorage.getItem('userName') || 'Usuario';
  const currentOrgId = localStorage.getItem('organizationId');

  const [organizations, setOrganizations]   = useState([]);
  const [activeOrg, setActiveOrg]           = useState(null);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [mobileOpen, setMobileOpen]         = useState(false);
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

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

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
        { path: '/dashboard/owner',          icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/dashboard/kitchen',        icon: Building2,       label: 'Sucursales' },
        { path: '/dashboard/chat-simulator', icon: MessageSquare,   label: 'Bot Simulator' },
        { path: '/dashboard/order-history',  icon: FileText,        label: 'Historial' },
        { path: '/dashboard/activity-logs',  icon: Activity,        label: 'Actividad' },
        { path: '/dashboard/settings',       icon: SettingsIcon,    label: 'Configuración' },
        ...(isKitchenSelected ? [
          { divider: true, label: currentKitchenName },
          { path: '/dashboard/reception',    icon: ShoppingBag,     label: 'Recepción' },
          { path: '/dashboard/pos-counter',  icon: Monitor,         label: 'POS Mostrador' },
          { path: '/dashboard/pos-table',    icon: TableProperties, label: 'POS Mesas' },
          { path: '/dashboard/reservations', icon: CalendarDays,    label: 'Reservas' },
          { path: '/dashboard/menu',         icon: Utensils,        label: 'Menú' },
          { path: '/dashboard/supplies',     icon: Package,         label: 'Stock' },
          { path: '/dashboard/team',         icon: Users,           label: 'Equipo' },
        ] : []),
      ];
    }
    return [
      { path: '/dashboard/kitchen',          icon: Building2,    label: 'Sucursales' },
      { path: '/dashboard/chat-simulator',   icon: MessageSquare,label: 'Bot Simulator' },
      ...(isKitchenSelected ? [
        { path: '/dashboard/reception',      icon: ShoppingBag,  label: 'Recepción' },
        { path: '/dashboard/cook',           icon: ClipboardList,label: 'Monitor' },
      ] : []),
      { path: '/dashboard/settings',         icon: SettingsIcon, label: 'Perfil' },
    ];
  };

  const navItems = getNavItems();
  const roleLabel = ROLE_LABEL[role] || 'Usuario';
  const initials  = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // ── Sidebar nav link ──────────────────────────────────────────────────────
  const NavLink = ({ item }) => {
    if (item.divider) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.25rem 0.75rem',
          marginTop: '0.75rem',
          color: 'var(--text-tertiary)',
          fontSize: '0.625rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          <Building2 size={9} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
        </div>
      );
    }

    const active = isActive(item.path);
    return (
      <button
        onClick={() => navigate(item.path)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '8px',
          border: 'none',
          background: active ? 'var(--accent-subtle)' : 'transparent',
          color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
          fontWeight: active ? 600 : 500,
          fontSize: '0.875rem',
          letterSpacing: '-0.01em',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          transition: 'all 0.15s ease',
          fontFamily: 'inherit',
          position: 'relative',
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
        {/* Active indicator bar */}
        {active && (
          <span style={{
            position: 'absolute', left: 0, top: '20%', bottom: '20%',
            width: '3px', borderRadius: '0 3px 3px 0',
            background: 'var(--accent-blue)',
          }} />
        )}
        <item.icon size={16} strokeWidth={active ? 2.5 : 2} style={{ flexShrink: 0 }} />
        {item.label}
      </button>
    );
  };

  // ── Sidebar content (shared between desktop + mobile) ────────────────────
  const SidebarContent = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '0.75rem 0.75rem 1rem',
      overflowY: 'auto', overflowX: 'hidden',
    }}>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.5rem 0.25rem 1.25rem',
        borderBottom: '1px solid var(--surface-border)',
        marginBottom: '0.5rem',
        flexShrink: 0,
      }}>
        <img src="/omnikook-logo.png" alt="omnikook" style={{ width: '28px', height: '28px', objectFit: 'contain', flexShrink: 0 }} />
        <span style={{
          fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em',
          color: 'var(--text-primary)', whiteSpace: 'nowrap',
        }}>
          <span style={{ color: 'var(--accent-blue)' }}>o</span>mnikook
        </span>
      </div>

      {/* Org selector — owner only */}
      {role === 'owner' && (
        <div ref={orgRef} style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <button
            onClick={() => setShowOrgSelector(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.625rem',
              borderRadius: '8px',
              border: '1px solid var(--surface-border)',
              background: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', width: '100%', textAlign: 'left',
              fontFamily: 'inherit', letterSpacing: '-0.01em',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{
              width: '24px', height: '24px', borderRadius: '6px',
              background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Building2 size={13} color="var(--accent-blue)" />
            </div>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeOrg?.name || 'Mi Restaurante'}
            </span>
            <ChevronDown size={13} style={{
              transform: showOrgSelector ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s', flexShrink: 0,
              color: 'var(--text-secondary)'
            }} />
          </button>

          {showOrgSelector && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: 'var(--surface-color)', border: '1px solid var(--surface-border)',
              borderRadius: '12px', boxShadow: 'var(--shadow-lg)', zIndex: 300, padding: '0.375rem',
            }}>
              <p style={{
                fontSize: '0.625rem', color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                padding: '0.25rem 0.5rem 0.375rem', fontWeight: 700,
              }}>Restaurantes</p>
              {organizations.map(org => (
                <div
                  key={org.id}
                  onClick={() => switchOrganization(org)}
                  style={{
                    padding: '0.5rem 0.625rem', fontSize: '0.8125rem', cursor: 'pointer',
                    borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    color: org.id === activeOrg?.id ? 'var(--accent-blue)' : 'var(--text-primary)',
                    background: org.id === activeOrg?.id ? 'var(--accent-subtle)' : 'transparent',
                    fontWeight: org.id === activeOrg?.id ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: org.id === activeOrg?.id ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                  }} />
                  {org.name}
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                <button
                  onClick={() => { navigate('/dashboard/settings'); setShowOrgSelector(false); }}
                  style={{
                    width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.8125rem',
                    background: 'transparent', border: 'none', color: 'var(--accent-blue)',
                    cursor: 'pointer', textAlign: 'left', fontWeight: 600, fontFamily: 'inherit',
                    borderRadius: '6px',
                  }}
                >
                  + Añadir Restaurante
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sucursal activa badge — jerarquía visual Marca → Sucursal */}
      {currentKitchenId && (
        <div style={{ marginBottom: '0.5rem' }}>
          {/* Etiqueta de jerarquía */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            padding: '0 0.25rem 0.25rem',
            fontSize: '0.625rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--text-tertiary)',
          }}>
            <ChevronRight size={9} />
            Sucursal activa
          </div>
          <button
            onClick={clearKitchenContext}
            title="Cambiar sucursal"
            aria-label={`Sucursal activa: ${currentKitchenName}. Clic para cambiar.`}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4375rem 0.625rem',
              borderRadius: '8px',
              border: '1px solid var(--accent-border)', background: 'var(--accent-subtle)',
              color: 'var(--accent-blue)', fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
          >
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
              background: 'var(--success-color)',
              boxShadow: '0 0 0 2px var(--success-bg)',
            }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentKitchenName}
            </span>
            <X size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
          </button>
        </div>
      )}

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {navItems.map((item, i) => <NavLink key={i} item={item} />)}
      </nav>

      {/* Bottom section */}
      <div style={{
        marginTop: 'auto', paddingTop: '0.75rem',
        borderTop: '1px solid var(--surface-border)',
        display: 'flex', flexDirection: 'column', gap: '0.25rem',
      }}>

        {/* User info */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          padding: '0.5rem 0.625rem', borderRadius: '8px',
          background: 'var(--neutral-bg)',
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-subtle)', color: 'var(--accent-blue)',
            border: '1.5px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '0.6875rem', letterSpacing: '0.02em',
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)',
              letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{userName}</div>
            <div style={{
              fontSize: '0.6875rem', color: 'var(--text-secondary)', fontWeight: 500,
            }}>{roleLabel}</div>
          </div>
        </div>

        {/* Theme toggle + Logout */}
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.375rem', padding: '0.4375rem',
              borderRadius: '8px', border: '1px solid var(--surface-border)',
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--neutral-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>

          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            style={{
              flex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.375rem', padding: '0.4375rem 0.75rem',
              borderRadius: '8px', border: '1px solid var(--surface-border)',
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger-color)'; e.currentTarget.style.borderColor = 'var(--danger-border)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
          >
            <LogOut size={14} /> Salir
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)' }}>

      {/* ── DESKTOP SIDEBAR ──────────────────────────────────────────────── */}
      <aside
        className="sidebar-desktop"
        style={{
          width: `${SIDEBAR_WIDTH}px`,
          flexShrink: 0,
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          background: 'var(--surface-color)',
          borderRight: '1px solid var(--surface-border)',
          zIndex: 100,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── MOBILE OVERLAY ───────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 198,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ── MOBILE SIDEBAR ───────────────────────────────────────────────── */}
      <aside
        className="sidebar-mobile"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: `${SIDEBAR_WIDTH}px`,
          background: 'var(--surface-color)',
          borderRight: '1px solid var(--surface-border)',
          zIndex: 199,
          transform: mobileOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── MAIN AREA ────────────────────────────────────────────────────── */}
      <div
        className="main-area"
        style={{
          flex: 1,
          marginLeft: `${SIDEBAR_WIDTH}px`,
          display: 'flex', flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Mobile top bar */}
        <div
          className="mobile-topbar"
          style={{
            display: 'none',
            position: 'sticky', top: 0, zIndex: 150,
            background: 'var(--surface-color)',
            borderBottom: '1px solid var(--surface-border)',
            height: '52px', padding: '0 1rem',
            alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px',
              borderRadius: '8px', border: '1px solid var(--surface-border)',
              background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            <Menu size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <img src="/omnikook-logo.png" alt="omnikook" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            <span style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              <span style={{ color: 'var(--accent-blue)' }}>o</span>mnikook
            </span>
          </div>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px',
              borderRadius: '8px', border: '1px solid var(--surface-border)',
              background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>

        {/* Page content */}
        <main style={{ flex: 1, padding: '1.75rem 2rem', overflow: 'auto', minWidth: 0 }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .main-area { margin-left: 0 !important; }
          .mobile-topbar { display: flex !important; }
          main { padding: 1.25rem !important; }
        }
        @media (min-width: 769px) {
          .sidebar-mobile { display: none !important; }
          .mobile-topbar { display: none !important; }
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
