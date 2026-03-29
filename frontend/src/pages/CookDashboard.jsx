import React from 'react';

export default function CookDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Panel de Cocina 👨‍🍳</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Ordenes pendientes por preparar.</p>
        </div>
        <div className="glass-panel" style={{ padding: '0.5rem 1rem', color: 'var(--danger-color)', fontWeight: 600 }}>
          3 Ordenes Pendientes
        </div>
      </div>

      {/* Orders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>

        {/* Fake Order Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>Mesa 4</span>
            <span style={{ color: 'var(--text-secondary)' }}>Hace 5 min</span>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <li style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>2x</span> Hamburguesa Doble
            </li>
            <li style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>1x</span> Papas Fritas (Sin Sal)
            </li>
          </ul>
          <button className="btn-primary" style={{ marginTop: 'auto', background: 'var(--success-color)' }}>
            Marcar Listo
          </button>
        </div>

      </div>
    </div>
  );
}
