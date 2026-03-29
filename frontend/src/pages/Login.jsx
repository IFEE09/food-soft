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
    <div className="login-container" style={{ 
      background: 'radial-gradient(circle at top right, #f1f5f9, #f8fafc)',
    }}>
      <div className="glass-card" style={{ 
        padding: '3rem 2.5rem', 
        width: '100%', 
        maxWidth: '420px', 
        margin: 'auto',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative element */}
        <div style={{ 
          position: 'absolute', 
          top: '-20px', 
          right: '-20px', 
          opacity: 0.03, 
          transform: 'rotate(15deg)' 
        }}>
          <ChefHat size={150} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2.5rem', position: 'relative' }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: '12px', 
            borderRadius: '16px', 
            background: 'var(--primary-color)', 
            color: 'white',
            marginBottom: '1rem'
          }}>
            <ChefHat size={28} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
            Food-Soft
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500 }}>
            Plataforma Corporativa
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Correo Electrónico
            </label>
            <div style={{ position: 'relative' }}>
              <Mail 
                size={18} 
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', opacity: 0.7 }} 
              />
              <input 
                type="email" 
                placeholder="usuario@foodsoft.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', paddingLeft: '44px', height: '48px', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={18} 
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', opacity: 0.7 }} 
              />
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
                  padding: '6px',
                  opacity: 0.6
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ 
              marginTop: '1rem', 
              gap: '0.75rem', 
              height: '52px', 
              fontSize: '1rem', 
              boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.1)' 
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Iniciando sesión...' : (
              <>
                Ingresar <ArrowRight size={18} />
              </>
            )}
          </button>

          <button 
            type="button" 
            onClick={() => navigate('/register')}
            style={{ 
              background: 'none', 
              border: '1px solid var(--surface-border)', 
              color: 'var(--text-primary)',
              height: '52px',
              borderRadius: '6px',
              fontWeight: 500,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease',
              marginTop: '-0.5rem'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <UserPlus size={18} /> Registrarse
          </button>
        </form>

        <div style={{ marginTop: '2.5rem', textAlign: 'center', paddingTop: '1.5rem', borderTop: '1px solid var(--surface-border)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                &copy; 2026 Food-Soft Group. Todos los derechos reservados.
            </p>
        </div>
      </div>

      {errorMsg && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderRadius: '12px', padding: '2.5rem' }}>
            <div className="modal-header" style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'var(--danger-bg)', padding: '8px', borderRadius: '10px' }}>
                    <AlertCircle size={24} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Error de Acceso</h2>
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
