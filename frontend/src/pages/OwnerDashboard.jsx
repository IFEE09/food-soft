import React from 'react';

export default function OwnerDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Metrics Row - CSS grid implicitly handles this via auto-fit */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Ventas</h4>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)', margin: 0 }}>$12,450.30</h3>
            <span style={{ color: 'var(--success-color)', fontSize: '0.85rem', fontWeight: 500 }}>+4.2%</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Órdenes</h4>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)', margin: 0 }}>142</h3>
            <span style={{ color: 'var(--success-color)', fontSize: '0.85rem', fontWeight: 500 }}>+12 Hoy</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Órdenes Pendientes</h4>
           <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
             <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--danger-color)', margin: 0 }}>8</h3>
           </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Órdenes Listas</h4>
           <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
             <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success-color)', margin: 0 }}>12</h3>
             <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Por entregar</span>
           </div>
        </div>

      </div>

      {/* Tables and Charts Area - Responsively styled via CSS Class */}
      <div className="dashboard-grid">
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Órdenes Recientes</h3>
          
          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Orden</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Cliente</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Entrada</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Salida</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {/* Mock Data */}
                {[
                  { order: '#ORD-001', client: 'Carlos M.', timeIn: '18:00', timeOut: '-', status: 'Pendiente' },
                  { order: '#ORD-002', client: 'Ana R.', timeIn: '18:15', timeOut: '18:35', status: 'Listo' },
                  { order: '#ORD-003', client: 'Luis F.', timeIn: '17:50', timeOut: '18:20', status: 'Entregado' },
                  { order: '#ORD-004', client: 'Jorge L.', timeIn: '18:30', timeOut: '-', status: 'Pendiente' },
                  { order: '#ORD-005', client: 'Valeria S.', timeIn: '18:45', timeOut: '-', status: 'Pendiente' }
                ].map((row, i) => {
                  let badgeBg = '#F1F5F9';
                  let badgeColor = 'var(--text-primary)';
                  
                  if (row.status === 'Pendiente') {
                    badgeBg = 'var(--danger-bg)';
                    badgeColor = 'var(--danger-color)';
                  } else if (row.status === 'Listo') {
                    badgeBg = '#FEF9C3'; 
                    badgeColor = '#CA8A04'; 
                  } else if (row.status === 'Entregado') {
                    badgeBg = '#ECFDF5'; 
                    badgeColor = '#059669'; 
                  }

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '1rem 0', fontWeight: 500, color: 'var(--primary-color)' }}>{row.order}</td>
                      <td style={{ padding: '1rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>{row.client}</td>
                      <td style={{ padding: '1rem 0', fontWeight: 500 }}>{row.timeIn}</td>
                      <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>{row.timeOut}</td>
                      <td style={{ padding: '1rem 0' }}>
                        <span style={{ 
                          fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 600,
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          whiteSpace: 'nowrap'
                        }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
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

            <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Stock de Cocina</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer' }}>Ver Todo</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { item: 'Carne de Res', qty: '12 kg', status: 'Normal', color: 'var(--text-secondary)' },
                  { item: 'Tomate Saladet', qty: '3 kg', status: 'Bajo', color: '#CA8A04' },
                  { item: 'Pan Brioche', qty: '8 pz', status: 'Crítico', color: 'var(--danger-color)' },
                  { item: 'Aceite Vegetal', qty: '15 L', status: 'Normal', color: 'var(--text-secondary)' },
                  { item: 'Queso Cheddar', qty: '2 kg', status: 'Bajo', color: '#CA8A04' }
                ].map((stock, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{stock.item}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>En existencia: {stock.qty}</div>
                    </div>
                    <div style={{ 
                      fontSize: '0.7rem', 
                      fontWeight: 700, 
                      color: stock.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em'
                    }}>
                      {stock.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
        </div>

      </div>

    </div>
  );
}
