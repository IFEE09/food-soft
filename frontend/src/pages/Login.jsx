import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Create OAuth2 compatible body
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token, role, full_name } = response.data;
      
      // Save session
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', role);
      localStorage.setItem('userName', full_name);

      // Redirect based on role
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
    <>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Food-Soft</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Sistema Inteligente POS</p>
      </div>

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Correo Electrónico</label>
          <input 
            type="email" 
            placeholder="dueño@restaurante.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Contraseña</label>
          <input 
            type="password" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button 
          type="submit" 
          className="btn-primary" 
          style={{ marginTop: '1rem' }}
          disabled={isLoading}
        >
          {isLoading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
        </button>
      </form>
    </>
  );
}
