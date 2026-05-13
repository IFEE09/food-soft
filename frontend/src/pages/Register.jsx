import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { 
  User, Mail, Lock, ArrowLeft, ArrowRight, ShieldCheck, Eye, EyeOff, AlertCircle
} from 'lucide-react';

export default function Register() {
  const [email, setEmail]                   = useState('');
  const [fullName, setFullName]             = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [isLoading, setIsLoading]           = useState(false);
  const [errorMsg, setErrorMsg]             = useState(null);
  // on-blur touched state
  const [touched, setTouched] = useState({ name: false, email: false, password: false, confirm: false });

  const navigate = useNavigate();

  const touch = (field) => setTouched(t => ({ ...t, [field]: true }));

  const nameError     = touched.name     && !fullName.trim() ? 'El nombre de la organización es obligatorio.' : null;
  const emailError    = touched.email    && !email ? 'El correo es obligatorio.' : touched.email && !/\S+@\S+\.\S+/.test(email) ? 'Ingresa un correo válido.' : null;
  const passwordError = touched.password && !password ? 'La contraseña es obligatoria.'
    : touched.password && password.length < 10 ? 'Mínimo 10 caracteres.'
    : touched.password && (!/[A-Za-z]/.test(password) || !/\d/.test(password)) ? 'Debe incluir letras y números.'
    : null;
  const confirmError  = touched.confirm  && !confirmPassword ? 'Confirma tu contraseña.'
    : touched.confirm  && password !== confirmPassword ? 'Las contraseñas no coinciden.'
    : null;

  const handleRegister = async (e) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true });
    if (nameError || emailError || passwordError || confirmError || !fullName || !email || !password || !confirmPassword) return;

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

  const confirmBorderColor = () => {
    if (!confirmPassword) return undefined;
    return password === confirmPassword ? 'var(--success-color)' : 'var(--danger-color)';
  };

  return (
    <div className="login-container">
      <div className="glass-card" style={{ padding: '3rem 2.5rem', width: '100%', maxWidth: '420px', margin: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <img
            src="/omnikook-logo.png"
            alt="Logo de Omnikook"
            style={{ width: '64px', height: '64px', objectFit: 'contain', display: 'block', margin: '0 auto 1.25rem auto' }}
          />
          <h1 style={{ fontSize: '1.4rem', fontWeight: '600', marginBottom: '0.4rem', letterSpacing: '0.02em', fontFamily: 'Inter, sans-serif' }}>
            <span style={{ color: 'var(--accent-blue)' }}>o</span><span style={{ color: 'var(--text-primary)' }}>mnikook</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>Unify the kitchen. Rule the chat.</p>
        </div>

        <form onSubmit={handleRegister} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Nombre de organización */}
          <div className="form-group">
            <label htmlFor="reg-name" className="form-label">Nombre de la organización</label>
            <div style={{ position: 'relative' }}>
              <User size={16} aria-hidden="true" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                id="reg-name"
                type="text"
                autoComplete="organization"
                placeholder="Mi Restaurante"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => touch('name')}
                required
                aria-invalid={!!nameError}
                aria-describedby={nameError ? 'reg-name-error' : undefined}
                
                style={{ width: '100%', paddingLeft: '44px', height: '48px', borderColor: nameError ? 'var(--danger-color)' : undefined }}
              />
            </div>
            {nameError && <span id="reg-name-error" className="form-error" role="alert">{nameError}</span>}
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="reg-email" className="form-label">Correo electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} aria-hidden="true" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="ops@mirestaurante.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => touch('email')}
                required
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'reg-email-error' : undefined}
                
                style={{ width: '100%', paddingLeft: '44px', height: '48px', borderColor: emailError ? 'var(--danger-color)' : undefined }}
              />
            </div>
            {emailError && <span id="reg-email-error" className="form-error" role="alert">{emailError}</span>}
          </div>

          {/* Contraseña */}
          <div className="form-group">
            <label htmlFor="reg-password" className="form-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} aria-hidden="true" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Mínimo 10 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => touch('password')}
                required
                aria-invalid={!!passwordError}
                aria-describedby="reg-password-hint reg-password-error"
                
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '45px', height: '48px', borderColor: passwordError ? 'var(--danger-color)' : undefined }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', minWidth: '32px', minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            <span id="reg-password-hint" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Mínimo 10 caracteres con letras y números.</span>
            {passwordError && <span id="reg-password-error" className="form-error" role="alert">{passwordError}</span>}
          </div>

          {/* Confirmar contraseña */}
          <div className="form-group">
            <label htmlFor="reg-confirm" className="form-label">Confirmar contraseña</label>
            <div style={{ position: 'relative' }}>
              <ShieldCheck size={16} aria-hidden="true" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: confirmPassword ? (password === confirmPassword ? 'var(--success-color)' : 'var(--danger-color)') : 'var(--text-secondary)' }} />
              <input
                id="reg-confirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => touch('confirm')}
                required
                aria-invalid={!!confirmError}
                aria-describedby={confirmError ? 'reg-confirm-error' : undefined}
                
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '45px', height: '48px', borderColor: confirmBorderColor() }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', minWidth: '32px', minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {showConfirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            {confirmError && <span id="reg-confirm-error" className="form-error" role="alert">{confirmError}</span>}
          </div>

          {/* Server error */}
          {errorMsg && (
            <div role="alert" aria-live="assertive" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-color)', fontSize: '0.8125rem', lineHeight: '1.5' }}>
              <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ height: '52px', marginTop: '0.5rem', gap: '0.75rem' }}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Creando cuenta...' : <><span>Crear cuenta</span> <ArrowRight size={18} aria-hidden="true" /></>}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}
          >
            <ArrowLeft size={14} aria-hidden="true" /> Volver al inicio de sesión
          </button>
        </form>
      </div>
    </div>
  );
}
