import React from 'react';

export default function CookDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Panel de Cocina</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Órdenes pendientes por preparar.</p>
        </div>
        <div style={{ 
          padding: '0.5rem 1rem', 
          backgroundColor: 'var(--danger-bg)', 
          color: 'var(--danger-color)', 
          border: '1px solid var(--danger-border)',
          borderRadius: '6px',
          fontWeight: 600,
          fontSize: '0.85rem'
        }}>
          3 Órdenes Pendientes
        </div>
      </div>

      {/* Orders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>

        {/* Fake Order Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Mesa 4</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Hace 5 min</span>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
            <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ 
                backgroundColor: '#F1F5F9', color: 'var(--primary-color)', fontWeight: 600, 
                padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' 
              }}>2x</span> 
              <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>Hamburguesa Doble</span>
            </li>
            <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ 
                backgroundColor: '#F1F5F9', color: 'var(--primary-color)', fontWeight: 600, 
                padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' 
              }}>1x</span> 
              <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>Papas Fritas (Sin Sal)</span>
            </li>
          </ul>
          <button 
            style={{ 
              marginTop: '1rem', 
              background: 'var(--surface-color)', 
              color: 'var(--text-primary)', 
              border: '1px solid var(--surface-border)', 
              padding: '0.75rem', borderRadius: '6px', 
              fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'center'
            }}
            onMouseOver={(e) => {
              e.target.style.background = '#ECFDF5';
              e.target.style.color = '#059669';
              e.target.style.borderColor = '#10B981';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'var(--surface-color)';
              e.target.style.color = 'var(--text-primary)';
              e.target.style.borderColor = 'var(--surface-border)';
            }}
          >
            Marcar Listo
          </button>
        </div>

      </div>
    </div>
  );
}
