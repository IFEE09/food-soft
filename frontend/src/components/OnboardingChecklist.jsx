/**
 * OnboardingChecklist — Guía de configuración inicial para nuevos usuarios.
 * Aparece en el OwnerDashboard cuando la cuenta es nueva (sin cocinas ni menú).
 * Se puede descartar permanentemente guardando en localStorage.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ChefHat, UtensilsCrossed, Users, X, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    id: 'kitchen',
    icon: ChefHat,
    title: 'Crea tu primera sucursal',
    desc: 'Registra la ubicación física de tu negocio y sus áreas de trabajo.',
    cta: 'Ir a Sucursales',
    path: '/dashboard/kitchen',
  },
  {
    id: 'menu',
    icon: UtensilsCrossed,
    title: 'Agrega tu menú',
    desc: 'Sube los platillos, precios y categorías de tu carta.',
    cta: 'Ir al Menú',
    path: '/dashboard/menu',
  },
  {
    id: 'team',
    icon: Users,
    title: 'Invita a tu equipo',
    desc: 'Añade cocineros y recepcionistas para que puedan usar la app.',
    cta: 'Ir a Equipo',
    path: '/dashboard/team',
  },
];

const STORAGE_KEY = 'omnikook_onboarding_dismissed';

export default function OnboardingChecklist({ completedSteps = [] }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  );

  if (dismissed) return null;

  const allDone = STEPS.every(s => completedSteps.includes(s.id));

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="Guía de configuración inicial"
      style={{
        background: 'var(--surface-color)',
        border: '1px solid var(--accent-border)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {allDone ? '¡Todo listo! 🎉' : 'Primeros pasos'}
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {allDone
              ? 'Tu negocio está completamente configurado.'
              : `${completedSteps.length} de ${STEPS.length} pasos completados`}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Cerrar guía de configuración"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', padding: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px', minWidth: '28px', minHeight: '28px',
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={completedSteps.length}
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-label={`${completedSteps.length} de ${STEPS.length} pasos completados`}
        style={{
          height: '4px',
          background: 'var(--surface-border)',
          borderRadius: '9999px',
          marginBottom: '1.25rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(completedSteps.length / STEPS.length) * 100}%`,
            background: allDone ? 'var(--success-color)' : 'var(--accent-blue)',
            borderRadius: '9999px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Steps */}
      <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {STEPS.map((step) => {
          const done = completedSteps.includes(step.id);
          const Icon = step.icon;
          return (
            <li
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '0.875rem 1rem',
                borderRadius: '10px',
                background: done ? 'var(--success-bg)' : 'var(--neutral-bg)',
                border: `1px solid ${done ? 'var(--success-border)' : 'var(--surface-border)'}`,
                opacity: done ? 0.7 : 1,
              }}
            >
              {/* Check icon */}
              <div aria-hidden="true">
                {done
                  ? <CheckCircle2 size={20} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
                  : <Circle size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                }
              </div>

              {/* Step icon */}
              <div
                aria-hidden="true"
                style={{
                  width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                  background: done ? 'var(--success-bg)' : 'var(--accent-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon size={18} style={{ color: done ? 'var(--success-color)' : 'var(--accent-blue)' }} />
              </div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)',
                  textDecoration: done ? 'line-through' : 'none', marginBottom: '0.125rem',
                }}>
                  {step.title}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {step.desc}
                </p>
              </div>

              {/* CTA */}
              {!done && (
                <button
                  onClick={() => navigate(step.path)}
                  className="btn-primary"
                  style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem', minHeight: '34px', flexShrink: 0 }}
                >
                  {step.cta} <ArrowRight size={13} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {allDone && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button onClick={handleDismiss} className="btn-secondary" style={{ fontSize: '0.875rem' }}>
            Cerrar esta guía
          </button>
        </div>
      )}
    </div>
  );
}
