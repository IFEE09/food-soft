import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [errorMsg, setErrorMsg]     = useState(null);
  // on-blur validation
  const [emailTouched, setEmailTouched]       = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const navigate = useNavigate();

  const emailError    = emailTouched && !email ? 'El correo es obligatorio.' : emailTouched && !/\S+@\S+\.\S+/.test(email) ? 'Ingresa un correo válido.' : null;
  const passwordError = passwordTouched && !password ? 'La contraseña es obligatoria.' : null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);
    if (emailError || passwordError || !email || !password) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token, refresh_token, role, full_name, organization_id } = response.data;

      localStorage.setItem('token', access_token);
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('role', role);
      localStorage.setItem('userName', full_name);
      if (organization_id != null) {
        localStorage.setItem('organizationId', String(organization_id));
      } else {
        localStorage.removeItem('organizationId');
      }

      if (role === 'owner') navigate('/dashboard/owner');
      else if (role === 'receptionist') navigate('/dashboard/reception');
      else navigate('/dashboard/kitchen');

    } catch (error) {
      const detail = error.response?.data?.detail;
      if (error.response?.status === 404) {
        setErrorMsg('Error de conexión. Verifica que el servidor esté en línea.');
      } else {
        setErrorMsg(detail || 'Credenciales incorrectas. Intenta de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ background: 'var(--bg-color)' }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--surface-color)',
        border: '1px solid var(--surface-border)',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        boxShadow: 'var(--shadow-md)',
      }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/omnikook-logo.png"
            alt="Logo de Omnikook"
            style={{ width: '56px', height: '56px', objectFit: 'contain', marginBottom: '1rem' }}
          />
          <h1 style={{
            fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em',
            color: 'var(--text-primary)', marginBottom: '0.375rem'
          }}>
            <span style={{ color: 'var(--accent-blue)' }}>o</span>mnikook
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
            Gestión inteligente para tu restaurante
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">Correo electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} aria-hidden="true" style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none'
              }} />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="tu@restaurante.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                required
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'login-email-error' : undefined}
                style={{
                  paddingLeft: '40px',
                  borderColor: emailError ? 'var(--danger-color)' : undefined,
                }}
              />
            </div>
            {emailError && (
              <span id="login-email-error" className="form-error" role="alert">{emailError}</span>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} aria-hidden="true" style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none'
              }} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                required
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'login-password-error' : undefined}
                style={{
                  paddingLeft: '40px', paddingRight: '44px',
                  borderColor: passwordError ? 'var(--danger-color)' : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '4px',
                  minWidth: '32px', minHeight: '32px', justifyContent: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            {passwordError && (
              <span id="login-password-error" className="form-error" role="alert">{passwordError}</span>
            )}
          </div>

          {/* Server error */}
          {errorMsg && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                padding: '0.75rem 1rem', borderRadius: '8px',
                background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
                color: 'var(--danger-color)', fontSize: '0.8125rem', lineHeight: '1.5'
              }}
            >
              <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
            aria-busy={isLoading}
            style={{ marginTop: '0.5rem', height: '48px', fontSize: '0.9375rem' }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="spinner" aria-hidden="true" style={{ width: '18px', height: '18px' }} />
                Iniciando sesión...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Iniciar sesión <ArrowRight size={18} aria-hidden="true" />
              </span>
            )}
          </button>

          {/* Register link */}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="btn-secondary"
            style={{ height: '44px', fontSize: '0.875rem' }}
          >
            Crear cuenta nueva
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: '1.75rem', textAlign: 'center', paddingTop: '1.25rem', borderTop: '1px solid var(--surface-border)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Omnikook · Plataforma para restaurantes
          </p>
        </div>
      </div>
    </div>
  );
}
