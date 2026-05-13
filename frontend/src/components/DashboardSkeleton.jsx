/**
 * DashboardSkeleton — Skeleton screens para estados de carga
 * Reemplaza el spinner genérico "Cargando…" con placeholders
 * que imitan el layout real de cada sección.
 */

/** Skeleton de una stat-card individual */
export function StatCardSkeleton() {
  return (
    <div className="stat-card skeleton-card" aria-hidden="true">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div className="skeleton skeleton-text" style={{ width: '40%' }} />
        <div className="skeleton skeleton-avatar" style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
      </div>
      <div className="skeleton" style={{ height: '2rem', width: '55%', borderRadius: '6px', marginBottom: '0.5rem' }} />
      <div className="skeleton skeleton-text" style={{ width: '30%' }} />
    </div>
  );
}

/** Skeleton de una fila de tabla */
export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--surface-border)' }}>
          <div
            className="skeleton skeleton-text"
            style={{ width: i === 0 ? '80%' : i === cols - 1 ? '50%' : '65%' }}
          />
        </td>
      ))}
    </tr>
  );
}

/** Skeleton de una order-card */
export function OrderCardSkeleton() {
  return (
    <div
      className="skeleton-card"
      aria-hidden="true"
      style={{ borderRadius: '16px', borderTop: '3px solid var(--surface-border)', marginBottom: '0.75rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div className="skeleton" style={{ height: '1rem', width: '35%', borderRadius: '4px' }} />
        <div className="skeleton skeleton-badge" />
      </div>
      <div className="skeleton skeleton-text" style={{ width: '60%' }} />
      <div className="skeleton skeleton-text" style={{ width: '45%' }} />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <div className="skeleton" style={{ height: '36px', flex: 1, borderRadius: '9999px' }} />
        <div className="skeleton" style={{ height: '36px', flex: 1, borderRadius: '9999px' }} />
      </div>
    </div>
  );
}

/** Skeleton completo del OwnerDashboard */
export function OwnerDashboardSkeleton() {
  return (
    <div aria-label="Cargando panel de control..." aria-busy="true">
      {/* Stat cards */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
      </div>
      {/* Tabla */}
      <div className="skeleton-card" style={{ borderRadius: '16px' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--surface-border)' }}>
          <div className="skeleton skeleton-title" />
        </div>
        <table style={{ width: '100%' }}>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => <TableRowSkeleton key={i} cols={5} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Skeleton del ReceptionDashboard */
export function ReceptionDashboardSkeleton() {
  return (
    <div aria-label="Cargando recepción..." aria-busy="true">
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        {[1, 2, 3].map(i => <StatCardSkeleton key={i} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i}>
            {[1, 2].map(j => <OrderCardSkeleton key={j} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton genérico de página */
export function PageSkeleton({ rows = 5 }) {
  return (
    <div aria-label="Cargando..." aria-busy="true">
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="skeleton skeleton-title" style={{ width: '30%', marginBottom: '0.5rem' }} />
        <div className="skeleton skeleton-text" style={{ width: '50%' }} />
      </div>
      <div className="skeleton-card" style={{ borderRadius: '16px' }}>
        <table style={{ width: '100%' }}>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} cols={4} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
