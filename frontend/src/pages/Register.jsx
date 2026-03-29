import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { 
  User, 
  Mail, 
  Lock, 
  ChefHat, 
  ArrowLeft, 
  ArrowRight, 
  ShieldCheck,
  Eye,
  EyeOff 
} from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden. Por favor, verifica.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      await apiClient.post('/auth/register', {
        email,
        full_name: fullName,
        password,
        role: 'owner'
      });
      navigate('/login');
    } catch (error) {
      console.error('Registration error:', error);
      setErrorMsg(error.response?.data?.detail || 'Error al crear la cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  const getBorderColor = () => {
    if (!confirmPassword) return 'var(--surface-border)';
    return password === confirmPassword ? 'var(--success-color)' : 'var(--danger-color)';
  };

  return (
    <div className="login-container" style={{ background: 'radial-gradient(circle at top right, #f1f5f9, #f8fafc)' }}>
      <div className="glass-card" style={{ padding: '3rem 2.5rem', width: '100%', maxWidth: '420px', margin: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '16px', background: 'var(--primary-color)', color: 'white', marginBottom: '1rem' }}>
            <ChefHat size={28} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Crea tu Cuenta</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Management para Dark Kitchens</p>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Nombre Completo / Empresa</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type="text" placeholder="James L. / Food-Soft" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ width: '100%', paddingLeft: '44px', height: '48px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type="email" placeholder="ejemplo@foodsoft.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', paddingLeft: '44px', height: '48px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', paddingLeft: '44px', paddingRight: '45px', height: '48px' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', opacity: 0.6 }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Confirmar Contraseña</label>
            <div style={{ position: 'relative' }}>
              <ShieldCheck size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: confirmPassword ? (password === confirmPassword ? 'var(--success-color)' : 'var(--danger-color)') : 'var(--text-secondary)' }} />
              <input 
                type={showConfirm ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} required 
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '45px', height: '48px', borderColor: getBorderColor(), borderWidth: confirmPassword ? '2px' : '1px' }} 
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', opacity: 0.6 }}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errorMsg && <p style={{ color: 'var(--danger-color)', fontSize: '0.85rem', fontWeight: 600 }}>{errorMsg}</p>}

          <button type="submit" className="btn-primary" style={{ height: '52px', marginTop: '0.5rem', gap: '0.75rem' }} disabled={isLoading}>
            {isLoading ? 'Registrando...' : <>Crear Cuenta <ArrowRight size={18} /></>}
          </button>

          <button type="button" onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <ArrowLeft size={16} /> Ya tengo cuenta
          </button>
        </form>
      </div>
    </div>
  );
}
