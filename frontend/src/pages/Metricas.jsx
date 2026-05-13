import { useState } from 'react';
import { LayoutDashboard, FileText, Activity } from 'lucide-react';
import OwnerDashboard from './OwnerDashboard';
import OrderHistory from './OrderHistory';
import ActivityLogs from './ActivityLogs';

const TABS = [
  {
    key: 'resumen',
    icon: LayoutDashboard,
    label: 'Resumen',
    desc: 'Vista general del negocio hoy',
  },
  {
    key: 'historial',
    icon: FileText,
    label: 'Historial',
    desc: 'Todos los pedidos pasados',
  },
  {
    key: 'actividad',
    icon: Activity,
    label: 'Actividad',
    desc: 'Registro de acciones del equipo',
  },
];

export default function Metricas() {
  const [active, setActive] = useState('resumen');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* ── Tab selector ── */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '0 0 1.25rem 0',
        borderBottom: '1px solid var(--surface-border)',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
      }}>
        {TABS.map(tab => {
          const isActive = active === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                border: isActive ? '1px solid var(--accent-border)' : '1px solid var(--surface-border)',
                borderRadius: '9999px',
                cursor: 'pointer',
                color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.875rem',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Contenido del tab activo ── */}
      <div style={{ flex: 1 }}>
        {active === 'resumen'   && <OwnerDashboard />}
        {active === 'historial' && <OrderHistory />}
        {active === 'actividad' && <ActivityLogs />}
      </div>
    </div>
  );
}
