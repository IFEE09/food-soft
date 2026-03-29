import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

const FLOATING_FOODS = [
  { icon: '🍕', size: '3rem', top: '15%', left: '10%', delay: '0s', duration: '6s' },
  { icon: '🍔', size: '4rem', top: '70%', left: '15%', delay: '1s', duration: '8s' },
  { icon: '🥗', size: '2.5rem', top: '25%', right: '15%', delay: '2s', duration: '7s' },
  { icon: '☕️', size: '3.5rem', top: '65%', right: '10%', delay: '3s', duration: '9s' },
  { icon: '🍣', size: '3rem', top: '10%', left: '45%', delay: '4s', duration: '7.5s' },
  { icon: '🌮', size: '2.5rem', bottom: '15%', left: '45%', delay: '2.5s', duration: '6.5s' },
  { icon: '🍩', size: '3.5rem', top: '45%', right: '5%', delay: '1.5s', duration: '8.5s' },
  { icon: '🥑', size: '2rem', top: '50%', left: '5%', delay: '0.5s', duration: '7s' }
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

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
      alert(error.response?.data?.detail || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ position: 'relative', overflow: 'hidden' }}>
      
      {/* Estilos Inline para Animaciones de Comida Flotante */}
      <style>{`
        @keyframes floatFood {
          0% { transform: translateY(0px) rotate(0deg); opacity: 0.05; }
          50% { transform: translateY(-20px) rotate(10deg); opacity: 0.15; }
          100% { transform: translateY(0px) rotate(0deg); opacity: 0.05; }
        }
        .floating-food {
          position: absolute;
          user-select: none;
          pointer-events: none;
          animation-name: floatFood;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
        }
      `}</style>

      {/* Figuras de Comida de Fondo */}
      {FLOATING_FOODS.map((food, idx) => (
        <div 
          key={idx} 
          className="floating-food"
          style={{
            fontSize: food.size,
            top: food.top,
            bottom: food.bottom,
            left: food.left,
            right: food.right,
            animationDuration: food.duration,
            animationDelay: food.delay,
            zIndex: 1
          }}
        >
          {food.icon}
        </div>
      ))}

      <div className="glass-card" style={{ zIndex: 10 }}>
        <h1 className="title-premium" style={{ marginBottom: '0.5rem' }}>Food-Soft</h1>
        <p style={{ textAlign: 'center', marginBottom: '2.5rem', opacity: 0.7, fontSize: '0.9rem' }}>
          Sistema de Gestión Restaurantera
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Correo Electrónico</label>
            <input 
              type="email" 
              placeholder="ejemplo@foodsoft.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Contraseña</label>
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
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  color: 'white'
                }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            style={{ marginTop: '0.8rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
