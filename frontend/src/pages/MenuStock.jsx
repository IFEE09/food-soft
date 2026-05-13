import { useState } from 'react';
import { Utensils, Package } from 'lucide-react';
import Menu from './Menu';
import Supplies from './Supplies';

const TABS = [
  {
    key: 'menu',
    icon: Utensils,
    label: 'Menú',
    desc: 'Platillos y precios',
  },
  {
    key: 'stock',
    icon: Package,
    label: 'Stock',
    desc: 'Insumos e inventario',
  },
];

export default function MenuStock() {
  const [active, setActive] = useState('menu');

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
        {active === 'menu'  && <Menu />}
        {active === 'stock' && <Supplies />}
      </div>
    </div>
  );
}
