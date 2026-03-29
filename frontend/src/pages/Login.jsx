import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

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
        navigate('/dashboard/cook');
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
      <div className="glass-card" style={{ padding: '2.5rem 2rem', width: '100%', maxWidth: '380px', margin: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Food-Soft</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Accede a tu cuenta corporativa
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)' }}>Correo Electrónico</label>
            <input 
              type="email" 
              placeholder="ejemplo@foodsoft.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', paddingRight: '45px' }}
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
                  padding: '4px'
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ marginTop: '0.5rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Iniciando sesión...' : 'Ingresar'}
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Aviso del Sistema</h2>
              <button onClick={() => setErrorMsg(null)} className="modal-close">×</button>
            </div>
            <div style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {errorMsg}
            </div>
            <button 
              className="btn-primary" 
              onClick={() => setErrorMsg(null)}
              style={{ width: '100%' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
