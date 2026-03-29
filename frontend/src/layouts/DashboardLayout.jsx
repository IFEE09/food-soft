import { Outlet, useNavigate, useLocation } from 'react-router-dom';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="dashboard-container">
      {/* Sidebar - Clean, responsive */}
      <aside className="sidebar">
        <div style={{ marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--primary-color)' }}>Food-Soft</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Corporativo</span>
        </div>
        
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div 
            className={`sidebar-link ${isActive('/dashboard/owner') ? 'active' : ''}`} 
            onClick={() => navigate('/dashboard/owner')}
          >
            Dashboard
          </div>
          <div 
            className={`sidebar-link ${isActive('/dashboard/supplies') ? 'active' : ''}`} 
            onClick={() => navigate('/dashboard/supplies')}
          >
            Stock de Cocina
          </div>
          <div className="sidebar-link">
            Órdenes
          </div>
          <div className="sidebar-link">
            Reportes
          </div>
        </nav>

        <button 
          onClick={handleLogout}
          style={{
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
            e.target.style.background = 'var(--danger-bg)';
            e.target.style.color = 'var(--danger-color)';
            e.target.style.borderColor = 'var(--danger-border)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = 'var(--text-primary)';
            e.target.style.borderColor = 'var(--surface-border)';
          }}
        >
          Cerrar Sesión
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="dashboard-header">
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {isActive('/dashboard/supplies') ? 'Stock de Cocina' : 'Dashboard General'}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                {isActive('/dashboard/supplies') ? 'Gestión de inventario e insumos' : 'Métricas al día de hoy'}
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface-color)', padding: '0.5rem 1rem', borderRadius: '50px', border: '1px solid var(--surface-border)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>Admin (James L.)</span>
                <div style={{ 
                    width: '32px', height: '32px', 
                    borderRadius: '50%', 
                    background: '#F1F5F9',
                    color: 'var(--text-primary)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    border: '1px solid var(--surface-border)'
                 }}>JL</div>
            </div>
        </header>

        <div style={{ flex: 1, overflowX: 'auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
