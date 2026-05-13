import { useState } from 'react';
import { Monitor, TableProperties } from 'lucide-react';
import POSCounter from './POSCounter';
import POSTable from './POSTable';

const TABS = [
  {
    key: 'counter',
    icon: Monitor,
    label: 'Mostrador',
    desc: 'Pedidos rápidos sin mesa',
  },
  {
    key: 'table',
    icon: TableProperties,
    label: 'Mesas',
    desc: 'Pedidos por mesa',
  },
];

export default function POS() {
  const [active, setActive] = useState('counter');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Tab selector grande tipo Apple ── */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        padding: '1rem 1.75rem 0',
        background: 'var(--surface-color)',
        borderBottom: '1px solid var(--surface-border)',
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
                gap: '0.6rem',
                padding: '0.75rem 1.25rem',
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
                borderRadius: '10px 10px 0 0',
                borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
                cursor: 'pointer',
                color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9375rem',
                transition: 'all 0.15s',
                marginBottom: '-1px',
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Contenido del tab activo ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {active === 'counter' ? <POSCounter /> : <POSTable />}
      </div>
    </div>
  );
}
