import React from 'react';

export default function OwnerDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Ventas</h4>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)', margin: 0 }}>$12,450.30</h3>
            <span style={{ color: 'var(--success-color)', fontSize: '0.85rem', fontWeight: 500 }}>+4.2%</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reservaciones</h4>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)', margin: 0 }}>84</h3>
            <span style={{ color: 'var(--success-color)', fontSize: '0.85rem', fontWeight: 500 }}>+8.0%</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personal Activo</h4>
           <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
             <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)', margin: 0 }}>18</h3>
           </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mesas Abiertas</h4>
           <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
             <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)', margin: 0 }}>22</h3>
             <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>/ 45</span>
           </div>
        </div>

      </div>

      {/* Tables and Charts Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Próximas Reservaciones</h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Hora</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Cliente</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Personas</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Mesa</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {/* Mock Data */}
                {[
                  { time: '18:00', name: 'Sarah J.', guests: 4, table: 'T5', status: 'Sentados' },
                  { time: '18:30', name: 'Mark D.', guests: 2, table: 'T9', status: 'Confirmado' },
                  { time: '19:00', name: 'Elena R.', guests: 6, table: 'T14', status: 'Esperando' },
                  { time: '19:30', name: 'James L.', guests: 4, table: 'T2', status: 'Confirmado' }
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '1rem 0', color: 'var(--text-primary)' }}>{row.time}</td>
                    <td style={{ padding: '1rem 0', fontWeight: 500 }}>{row.name}</td>
                    <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>{row.guests}</td>
                    <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>{row.table}</td>
                    <td style={{ padding: '1rem 0' }}>
                      <span style={{ 
                        fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 500,
                        backgroundColor: row.status === 'Sentados' ? '#ECFDF5' : '#F1F5F9',
                        color: row.status === 'Sentados' ? '#059669' : 'var(--text-primary)'
                      }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Resumen Semanal</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', flex: 1 }}>Gráfico de ingresos no disponible momentáneamente.</p>
              <div style={{ height: '80px', borderBottom: '1px dashed var(--surface-border)', borderLeft: '1px solid var(--surface-border)' }}></div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Conteo de Clientes</h3>
               <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', flex: 1 }}>Histórico de la semana</p>
               <div style={{ height: '80px', borderBottom: '1px dashed var(--surface-border)', borderLeft: '1px solid var(--surface-border)' }}></div>
            </div>
        </div>

      </div>

    </div>
  );
}
