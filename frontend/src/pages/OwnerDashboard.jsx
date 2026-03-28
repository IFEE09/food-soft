import React from 'react';

export default function OwnerDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Hola, Dueño 👋</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Aquí tienes el resumen de tu restaurante hoy.</p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.5rem' }}>Ventas del Día</h4>
          <h3 className="text-gradient" style={{ fontSize: '2.5rem', margin: 0 }}>$1,240.00</h3>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.5rem' }}>Ordenes Completadas</h4>
          <h3 style={{ fontSize: '2.5rem', margin: 0 }}>42</h3>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
           <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.5rem' }}>Mesas Ocupadas</h4>
           <h3 style={{ fontSize: '2.5rem', margin: 0 }}>8 <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ 12</span></h3>
        </div>

      </div>

      {/* Recent Activity */}
      <div className="glass-panel" style={{ padding: '2rem', flex: 1 }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Actividad Reciente</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Aún no hay actividad fuerte conectada del backend...</p>
      </div>
    </div>
  );
}
