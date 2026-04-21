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
  HeadphonesIcon
} from 'lucide-react';

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
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
    return { title: 'Food-Soft', sub: 'Sistema de gestión' };
  };

  const page = getPageTitle();
  const roleLabel = ROLE_LABEL[role] || 'Usuario';

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--primary-color)' }}>Food-Soft</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Management</span>
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
            gap: '0.75rem',
            background: 'transparent',
            border: '1px solid var(--surface-border)',
            color: 'var(--text-primary)',
            padding: '0.75rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.9rem',
            transition: 'all 0.2s',
            marginTop: '2rem'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'var(--danger-bg)';
            e.currentTarget.style.color = 'var(--danger-color)';
            e.currentTarget.style.borderColor = 'var(--danger-border)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--surface-border)';
          }}
        >
          <LogOut size={18} />
          Cerrar Sesión
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="dashboard-header">
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {page.title}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                {page.sub}
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface-color)', padding: '0.5rem 1rem', borderRadius: '50px', border: '1px solid var(--surface-border)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {roleLabel} ({userName})
                </span>
                <div style={{ 
                    width: '32px', height: '32px', 
                    borderRadius: '50%', 
                    background: '#F1F5F9',
                    color: 'var(--text-primary)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    border: '1px solid var(--surface-border)'
                 }}>
                   {userName?.substring(0,2).toUpperCase() || 'FS'}
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
