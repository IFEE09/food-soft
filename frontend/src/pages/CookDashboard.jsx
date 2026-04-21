import React from 'react';

export default function CookDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>KITCHEN_TERMINAL</h2>
          <p className="mono" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Active production line monitoring</p>
        </div>
        <div className="mono" style={{ 
          padding: '0.4rem 0.75rem', 
          backgroundColor: 'rgba(255,51,51,0.1)', 
          color: 'var(--danger-color)', 
          border: '1px solid var(--danger-color)',
          borderRadius: '2px',
          fontWeight: 700,
          fontSize: '0.7rem',
          textTransform: 'uppercase'
        }}>
          {3} QUEUED_TASKS
        </div>
      </div>

      {/* Orders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>

        {/* Fake Order Card */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '2px solid var(--danger-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.75rem' }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--success-color)' }}>NODE_TABLE_04</span>
            <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 600 }}>T+ 5M</span>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
            <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span className="mono" style={{ 
                backgroundColor: 'var(--surface-border)', color: 'var(--success-color)', fontWeight: 800, 
                padding: '0.2rem 0.5rem', borderRadius: '1px', fontSize: '0.7rem' 
              }}>x2</span> 
              <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase' }}>Double Burger</span>
            </li>
            <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span className="mono" style={{ 
                backgroundColor: 'var(--surface-border)', color: 'var(--success-color)', fontWeight: 800, 
                padding: '0.2rem 0.5rem', borderRadius: '1px', fontSize: '0.7rem' 
              }}>x1</span> 
              <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase' }}>Fries (No Salt)</span>
            </li>
          </ul>
          <button 
            className="btn-primary"
            style={{ 
              marginTop: '0.5rem', 
              fontSize: '0.8rem'
            }}
          >
            EXECUTE_FINISH
          </button>
        </div>

      </div>
    </div>
  );
}
