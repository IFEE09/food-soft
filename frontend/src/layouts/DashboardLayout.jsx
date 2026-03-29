import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ChefHat, 
  Package, 
  ClipboardList, 
  BarChart3, 
  LogOut,
  Settings as SettingsIcon 
} from 'lucide-react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <div className="dashboard-container">
      {/* Sidebar - Clean, responsive with icons */}
      <aside className="sidebar">
        <div style={{ marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--primary-color)' }}>Food-Soft</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Corporativo</span>
        </div>
        
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <NavItem path="/dashboard/owner" icon={LayoutDashboard} label="Dashboard General" />
          <NavItem path="/dashboard/kitchen" icon={ChefHat} label="Panel Cocinas" />
          <NavItem path="/dashboard/supplies" icon={Package} label="Stock de Cocina" />
          <NavItem path="/dashboard/settings" icon={SettingsIcon} label="Configuración" />
          
          <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.95rem', opacity: 0.6 }}>
            <ClipboardList size={18} />
            <span>Órdenes Hist.</span>
          </div>
          
          <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.95rem', opacity: 0.6 }}>
            <BarChart3 size={18} />
            <span>Reportes</span>
          </div>
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
                {isActive('/dashboard/supplies') ? 'Inventario de Insumos' : 
                 isActive('/dashboard/kitchen') ? 'Dashboard de Cocinas' : 
                 isActive('/dashboard/settings') ? 'Configuración de Sistema' :
                 'Dashboard General'}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                {isActive('/dashboard/supplies') ? 'Control detallado de stock y reposición' : 
                 isActive('/dashboard/kitchen') ? 'Monitor de flujo de pedidos para Dark Kitchens' : 
                 isActive('/dashboard/settings') ? 'Gestiona tu perfil corporativo y seguridad de cuenta' :
                 'Métricas clave de operación hoy'}
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface-color)', padding: '0.5rem 1rem', borderRadius: '50px', border: '1px solid var(--surface-border)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Admin ({localStorage.getItem('userName') || 'James L.'})
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
                   {localStorage.getItem('userName')?.substring(0,2).toUpperCase() || 'JL'}
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
