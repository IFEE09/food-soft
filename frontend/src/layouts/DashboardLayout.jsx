import { Outlet, useNavigate } from 'react-router-dom';

export default function DashboardLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="glass-panel" style={{ 
        width: '260px', 
        padding: '2rem',
        margin: '1rem',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '24px'
      }}>
        <h2 className="text-gradient" style={{ marginBottom: '2rem', fontSize: '1.5rem', fontWeight: 700 }}>Food-Soft</h2>
        
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ padding: '0.8rem 1rem', cursor: 'pointer', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', fontWeight: 500 }}>
            Dashboard
          </div>
          <div style={{ padding: '0.8rem 1rem', cursor: 'pointer', borderRadius: '12px', opacity: 0.7 }}>
            Ordenes
          </div>
        </nav>

        <button 
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: 'var(--danger-color)',
            padding: '0.8rem',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
          onMouseOut={(e) => e.target.style.background = 'transparent'}
        >
          Cerrar Sesión
        </button>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '1rem 2rem 1rem 0' }}>
        <header style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            alignItems: 'center',
            marginBottom: '2rem',
            height: '60px'
         }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Pos Dashboard</span>
                <div style={{ 
                    width: '40px', height: '40px', 
                    borderRadius: '50%', 
                    background: 'var(--primary-color)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontWeight: 700
                 }}>UI</div>
            </div>
        </header>

        {/* This renders the actual dashboard page (Owner or Cook) */}
        <Outlet />
      </main>
    </div>
  );
}
