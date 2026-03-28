import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // Simulate login for now - later replace with real API call
    // apiClient.post('/auth/login', { email, password })
    if (email.includes('owner')) {
      localStorage.setItem('role', 'owner');
      navigate('/dashboard/owner');
    } else {
      localStorage.setItem('role', 'cook');
      navigate('/dashboard/cook');
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

        <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>
          Ingresar al Sistema
        </button>
      </form>
    </>
  );
}
