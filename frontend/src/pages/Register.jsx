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

  return (    <div className="login-container">
      <div className="glass-card" style={{ padding: '3rem 2.5rem', width: '100%', maxWidth: '420px', margin: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <img 
            src="/src/assets/omnikook-logo.png" 
            alt="OMNIKOOK" 
            style={{ height: '36px', marginBottom: '1.25rem', filter: 'brightness(0) invert(1)' }} 
          />
          <h1 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--success-color)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>New Registration</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>Management Layer for Dark Kitchens</p>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Organization Name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type="text" placeholder="GHOST_KITCHEN_01" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mono" style={{ width: '100%', paddingLeft: '44px', height: '48px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Email Endpoint</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type="email" placeholder="ops@omnikook.cx" value={email} onChange={(e) => setEmail(e.target.value)} required className="mono" style={{ width: '100%', paddingLeft: '44px', height: '48px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Access Key</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="mono" style={{ width: '100%', paddingLeft: '44px', paddingRight: '45px', height: '48px' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Verify Key</label>
            <div style={{ position: 'relative' }}>
              <ShieldCheck size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: confirmPassword ? (password === confirmPassword ? 'var(--success-color)' : 'var(--danger-color)') : 'var(--text-secondary)' }} />
              <input 
                type={showConfirm ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} required 
                className="mono"
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '45px', height: '48px', borderColor: getBorderColor() }} 
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px' }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {errorMsg && <p className="mono" style={{ color: 'var(--danger-color)', fontSize: '0.75rem', fontWeight: 600 }}>ERROR: {errorMsg}</p>}

          <button type="submit" className="btn-primary" style={{ height: '52px', marginTop: '0.5rem', gap: '0.75rem' }} disabled={isLoading}>
            {isLoading ? 'INITIATING...' : <>COMMIT_REGISTRATION <ArrowRight size={18} /></>}
          </button>

          <button type="button" onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ArrowLeft size={14} /> Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}
