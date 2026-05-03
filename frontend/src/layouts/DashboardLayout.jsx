import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ChefHat,
  Package,
  ClipboardList,
  BarChart3,
  LogOut,
  Settings as SettingsIcon,
  Utensils,
  Activity,
  ShoppingBag,
  Users,
  ShieldCheck,
  HeadphonesIcon,
  Building2,
  ChevronDown
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { apiClient } from '../api/client';

const ROLE_LABEL = {
  owner: 'Dueño',
  receptionist: 'Recepcionista',
  cook: 'Cocinero'
};

const ROLE_ICON = {
  owner: ShieldCheck,
  receptionist: HeadphonesIcon,
  cook: ChefHat
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = localStorage.getItem('role') || 'cook';
  const userName = localStorage.getItem('userName') || 'Usuario';
  const currentOrgId = localStorage.getItem('organizationId');

  const [organizations, setOrganizations] = useState([]);
  const [activeOrg, setActiveOrg] = useState(null);
  const [showOrgSelector, setShowOrgSelector] = useState(false);

  useEffect(() => {
    if (role === 'owner') {
      fetchOrganizations();
    }
  }, []);

  const fetchOrganizations = async () => {
    try {
      const { data } = await apiClient.get('/users/me/organizations');
      setOrganizations(data);
      const active = data.find(o => String(o.id) === String(currentOrgId));
      setActiveOrg(active || data[0]);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const switchOrganization = (org) => {
    localStorage.setItem('organizationId', org.id);
    setActiveOrg(org);
    setShowOrgSelector(false);
    // Reload to refresh all context with the new X-Organization-ID
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('organizationId');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label }) => (
    <div 
      className={`sidebar-link ${isActive(path) ? 'active' : ''}`} 
      onClick={() => navigate(path)}
      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
    >
      <Icon size={18} />
      <span>{label}</span>
    </div>
  );

  // Build navigation items based on role
  const getNavItems = () => {
    if (role === 'owner') {
      return (
        <>
          <NavItem path="/dashboard/owner" icon={LayoutDashboard} label="Dashboard General" />
          <NavItem path="/dashboard/reception" icon={ShoppingBag} label="Recepción" />
          <NavItem path="/dashboard/kitchen" icon={ChefHat} label="Panel Cocinas" />
          <NavItem path="/dashboard/menu" icon={Utensils} label="Menú Platillos" />
          <NavItem path="/dashboard/supplies" icon={Package} label="Stock de Cocina" />
          <NavItem path="/dashboard/team" icon={Users} label="Equipo" />
          <NavItem path="/dashboard/activity-logs" icon={Activity} label="Historial" />
          <NavItem path="/dashboard/settings" icon={SettingsIcon} label="Configuración" />
        </>
      );
    }
    if (role === 'receptionist') {
      return (
        <>
          <NavItem path="/dashboard/reception" icon={ShoppingBag} label="Recepción" />
          <NavItem path="/dashboard/menu" icon={Utensils} label="Menú" />
          <NavItem path="/dashboard/settings" icon={SettingsIcon} label="Mi Perfil" />
        </>
      );
    }
    // cook
    return (
      <>
        <NavItem path="/dashboard/kitchen" icon={ChefHat} label="Panel Cocinas" />
        <NavItem path="/dashboard/cook" icon={ClipboardList} label="Mis Órdenes" />
        <NavItem path="/dashboard/settings" icon={SettingsIcon} label="Mi Perfil" />
      </>
    );
  };

  // Dynamic page title
  const getPageTitle = () => {
    if (isActive('/dashboard/owner')) return { title: 'Dashboard General', sub: 'Métricas clave de operación hoy' };
    if (isActive('/dashboard/reception')) return { title: 'Recepción de Pedidos', sub: 'Crea y gestiona las órdenes de clientes' };
    if (isActive('/dashboard/kitchen')) return { title: 'Dashboard de Cocinas', sub: 'Monitor de flujo de pedidos para Dark Kitchens' };
    if (isActive('/dashboard/menu')) return { title: 'Catálogo de Menú', sub: 'Gestiona tus platos y recetas conectadas a insumos' };
    if (isActive('/dashboard/supplies')) return { title: 'Inventario de Insumos', sub: 'Control detallado de stock y reposición' };
    if (isActive('/dashboard/team')) return { title: 'Gestión de Equipo', sub: 'Administra recepcionistas, cocineros y accesos' };
    if (isActive('/dashboard/activity-logs')) return { title: 'Historial de Actividad', sub: 'Registro completo de movimientos de todos los usuarios' };
    if (isActive('/dashboard/settings')) return { title: 'Configuración de Sistema', sub: 'Gestiona tu perfil corporativo y seguridad de cuenta' };
    if (isActive('/dashboard/cook')) return { title: 'Mis Órdenes', sub: 'Órdenes asignadas a tu estación' };
    return { title: 'OMNIKOOK', sub: 'Dark Kitchen OS' };
  };

  const page = getPageTitle();
  const roleLabel = ROLE_LABEL[role] || 'Usuario';
  const RoleIcon = ROLE_ICON[role] || ShieldCheck;
  const roleColor = role === 'owner' ? 'var(--success-color)' : role === 'receptionist' ? 'var(--primary-color)' : 'var(--text-secondary)';
  const roleBg    = role === 'owner' ? 'var(--success-bg)'    : role === 'receptionist' ? 'var(--primary-bg)'    : 'var(--neutral-bg)';
  const roleBorder = role === 'owner' ? 'var(--success-border)' : role === 'receptionist' ? 'var(--primary-border)' : 'var(--surface-border)';

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ marginBottom: '2rem', paddingLeft: '0.25rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--success-color)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>OMNIKOOK</h2>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>Dark Kitchen OS</span>
        </div>
        
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {getNavItems()}
        </nav>

        <button 
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            background: 'transparent',
            border: '1px solid var(--surface-border)',
            color: 'var(--text-secondary)',
            padding: '0.65rem 0.75rem',
            borderRadius: '2px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.82rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            transition: 'all 0.15s',
            marginTop: '1.5rem',
            width: '100%'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'var(--danger-bg)';
            e.currentTarget.style.color = 'var(--danger-color)';
            e.currentTarget.style.borderColor = 'var(--danger-border)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'var(--surface-border)';
          }}
        >
          <LogOut size={15} />
          Cerrar Sesión
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="dashboard-header">
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {page.title}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.3rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.02em' }}>
                {page.sub}
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Selector de Restaurante para Propietarios */}
                {role === 'owner' && (
                  <div style={{ position: 'relative' }}>
                    <button 
                      onClick={() => setShowOrgSelector(!showOrgSelector)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        background: 'var(--surface-color)', border: '1px solid var(--surface-border)',
                        color: 'var(--text-primary)', padding: '0.5rem 0.85rem', borderRadius: '2px',
                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600
                      }}
                    >
                      <Building2 size={16} color="var(--success-color)" />
                      {activeOrg?.name || 'Cargando...'}
                      <ChevronDown size={14} />
                    </button>

                    {showOrgSelector && (
                      <div style={{
                        position: 'absolute', top: '110%', left: 0, width: '220px',
                        background: 'var(--surface-color)', border: '1px solid var(--surface-border)',
                        boxShadow: 'var(--shadow-lg)', borderRadius: '2px', zIndex: 100,
                        padding: '0.5rem'
                      }}>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.4rem 0.6rem' }}>Mis Restaurantes</p>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {organizations.map(org => (
                            <div 
                              key={org.id}
                              onClick={() => switchOrganization(org)}
                              style={{
                                padding: '0.6rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer',
                                borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                color: org.id === activeOrg?.id ? 'var(--success-color)' : 'var(--text-primary)',
                                background: org.id === activeOrg?.id ? 'var(--success-bg)' : 'transparent'
                              }}
                            >
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: org.id === activeOrg?.id ? 'var(--success-color)' : 'var(--surface-border)' }} />
                              {org.name}
                            </div>
                          ))}
                        </div>
                        <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                          <button 
                            onClick={() => navigate('/dashboard/settings')} // O un modal de crear
                            style={{ width: '100%', padding: '0.5rem', fontSize: '0.75rem', background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', textAlign: 'left', fontWeight: 600 }}
                          >
                            + Añadir Restaurante
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <ThemeToggle />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-color)', padding: '0.5rem 0.75rem 0.5rem 1rem', borderRadius: '2px', border: '1px solid var(--surface-border)' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: roleBg, color: roleColor, padding: '0.2rem 0.5rem', borderRadius: '2px',
                  fontFamily: 'JetBrains Mono, monospace', border: `1px solid ${roleBorder}`
                }}>
                  <RoleIcon size={11} /> {roleLabel}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {userName}
                </span>
                <div style={{
                    width: '30px', height: '30px',
                    borderRadius: '2px',
                    background: roleBg,
                    color: roleColor,
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    border: `1px solid ${roleBorder}`
                 }}>
                   {userName?.substring(0,2).toUpperCase() || 'OK'}
                 </div>
            </div>
        </div>
    </header>

        <div style={{ flex: 1, overflowX: 'auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
