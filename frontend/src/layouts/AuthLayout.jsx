import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      padding: '2rem'
    }}>
      <div 
        className="glass-panel" 
        style={{ 
          width: '100%', 
          maxWidth: '450px', 
          padding: '2.5rem',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Subtle glow effect behind the card */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 60%)',
          zIndex: -1,
          pointerEvents: 'none'
        }} />
        <Outlet />
      </div>
    </div>
  );
}
