import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        background: 'var(--surface-color)',
        border: '1px solid var(--surface-border)',
        borderRadius: '2px',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        padding: 0
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-success)';
        e.currentTarget.style.background = 'var(--success-bg)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'var(--surface-border)';
        e.currentTarget.style.background = 'var(--surface-color)';
      }}
    >
      {theme === 'light' ? (
        <Sun size={18} strokeWidth={1.5} />
      ) : (
        <Moon size={18} strokeWidth={1.5} />
      )}
    </button>
  );
}
