import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  AlertCircle, 
  ChefHat,
  ArrowRight,
  UserPlus
} from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token, role, full_name } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', role);
      localStorage.setItem('userName', full_name);

      if (role === 'owner') {
        navigate('/dashboard/owner');
      } else if (role === 'receptionist') {
        navigate('/dashboard/reception');
      } else {
        navigate('/dashboard/kitchen');
      }
    } catch (error) {
      console.error('Login error:', error);
      const detail = error.response?.data?.detail;
      if (error.response?.status === 404) {
        setErrorMsg("Error de conexión: Revisa que tu servidor esté respondiendo y en línea.");
      } else {
        setErrorMsg(detail || 'Credenciales incorrectas o error de servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="glass-card" style={{ 
        padding: '3rem 2.5rem', 
        width: '100%', 
        maxWidth: '420px', 
        margin: 'auto',
        position: 'relative'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <img 
            src="/src/assets/omnikook-logo.png" 
            alt="OMNIKOOK" 
            style={{ 
              height: '40px', 
              marginBottom: '1.5rem',
              filter: 'brightness(0) invert(1)'
            }} 
          />
          <h1 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--success-color)', marginBottom: '0.4rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            OMNIKOOK
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
            Dark Kitchen OS
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Terminal ID / Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail 
                size={16} 
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} 
              />
              <input 
                type="email" 
                placeholder="admin@omnikook.cx" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mono"
                style={{ width: '100%', paddingLeft: '44px', height: '48px', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Access Key
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={16} 
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} 
              />
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mono"
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '48px', height: '48px', fontSize: '0.9rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ 
              marginTop: '1rem', 
              gap: '0.75rem', 
              height: '52px'
            }}
            disabled={isLoading}
          >
            {isLoading ? 'AUTH_IN_PROGRESS...' : (
              <>
                ESTABLISH_SESSION <ArrowRight size={18} />
              </>
            )}
          </button>

          <button 
            type="button" 
            onClick={() => navigate('/register')}
            style={{ 
              background: 'transparent', 
              border: '1px solid var(--surface-border)', 
              color: 'var(--text-secondary)',
              height: '48px',
              borderRadius: '2px',
              fontWeight: 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
          >
            New Registration
          </button>
        </form>

        <div style={{ marginTop: '2.5rem', textAlign: 'center', paddingTop: '1.5rem', borderTop: '1px solid var(--surface-border)' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
                OMNIKOOK v1.0.0 // SECTOR DARK KITCHEN
            </p>
        </div>
      </div>

      {errorMsg && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '2.5rem' }}>
            <div className="modal-header" style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'var(--danger-bg)', padding: '8px', borderRadius: '2px', border: '1px solid var(--danger-border)' }}>
                    <AlertCircle size={22} />
                </div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Error de Acceso</h2>
              </div>
            </div>
            <div style={{ marginBottom: '2rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              {errorMsg}
            </div>
            <button 
              className="btn-primary" 
              onClick={() => setErrorMsg(null)}
              style={{ width: '100%', height: '48px' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
