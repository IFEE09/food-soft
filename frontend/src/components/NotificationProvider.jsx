import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

// Focus trap hook: mantiene el foco dentro del modal mientras está abierto
function useFocusTrap(isOpen) {
    const containerRef = useRef(null);
    const previousFocusRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        // Guardar el elemento que tenía foco antes de abrir el modal
        previousFocusRef.current = document.activeElement;

        const container = containerRef.current;
        if (!container) return;

        // Enfocar el primer elemento interactivo del modal
        const focusable = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
            focusable[focusable.length > 1 ? focusable.length - 1 : 0].focus();
        }

        const handleKeyDown = (e) => {
            if (e.key !== 'Tab') return;
            const first = focusable[0];
            const last  = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
            }
        };

        container.addEventListener('keydown', handleKeyDown);
        return () => {
            container.removeEventListener('keydown', handleKeyDown);
            // Restaurar el foco al elemento original al cerrar
            previousFocusRef.current?.focus();
        };
    }, [isOpen]);

    return containerRef;
}

export const NotificationProvider = ({ children }) => {
    const [modal, setModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        onCancel: null,
    });

    const containerRef = useFocusTrap(modal.isOpen);

    // Cerrar con Escape
    useEffect(() => {
        if (!modal.isOpen) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                if (modal.onCancel) modal.onCancel();
                else if (modal.onConfirm) modal.onConfirm();
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [modal]);

    const showAlert = useCallback((title, message, type = 'info') => {
        return new Promise((resolve) => {
            setModal({
                isOpen: true,
                title,
                message,
                type,
                onConfirm: () => {
                    setModal(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: null,
            });
        });
    }, []);

    const showConfirm = useCallback((title, message) => {
        return new Promise((resolve) => {
            setModal({
                isOpen: true,
                title,
                message,
                type: 'confirm',
                onConfirm: () => {
                    setModal(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setModal(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
                },
            });
        });
    }, []);

    const getIcon = () => {
        const iconSize = 40;
        switch (modal.type) {
            case 'success': return <CheckCircle size={iconSize} aria-hidden="true" style={{ color: 'var(--success-color)' }} />;
            case 'warning': return <AlertTriangle size={iconSize} aria-hidden="true" style={{ color: '#F59E0B' }} />;
            case 'error':   return <XCircle      size={iconSize} aria-hidden="true" style={{ color: 'var(--danger-color)' }} />;
            case 'confirm': return <AlertTriangle size={iconSize} aria-hidden="true" style={{ color: 'var(--primary-color)' }} />;
            default:        return <Info          size={iconSize} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />;
        }
    };

    const titleId   = 'notification-title';
    const messageId = 'notification-message';

    return (
        <NotificationContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {modal.isOpen && (
                <div
                    className="modal-overlay"
                    style={{ zIndex: 9999 }}
                    onClick={(e) => {
                        // Cerrar al hacer clic en el overlay (fuera del modal)
                        if (e.target === e.currentTarget) {
                            if (modal.onCancel) modal.onCancel();
                            else if (modal.onConfirm) modal.onConfirm();
                        }
                    }}
                >
                    <div
                        ref={containerRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={messageId}
                        className="modal-content"
                        style={{
                            maxWidth: '420px',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1.25rem',
                            padding: '2.5rem 2rem',
                            borderRadius: '16px',
                            border: '1px solid var(--surface-border)',
                        }}
                    >
                        <div aria-hidden="true">
                            {getIcon()}
                        </div>

                        <h2
                            id={titleId}
                            style={{
                                fontSize: '1rem',
                                fontWeight: 700,
                                margin: 0,
                                color: 'var(--text-primary)',
                            }}
                        >
                            {modal.title}
                        </h2>

                        <p
                            id={messageId}
                            style={{
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)',
                                margin: 0,
                                lineHeight: '1.6',
                            }}
                        >
                            {modal.message}
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
                            {modal.type === 'confirm' ? (
                                <>
                                    <button
                                        onClick={modal.onCancel}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            background: 'transparent',
                                            border: '1px solid var(--surface-border)',
                                            borderRadius: '9999px',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.875rem',
                                            color: 'var(--text-secondary)',
                                            minHeight: '44px',
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={modal.onConfirm}
                                        className="btn-primary"
                                        style={{ flex: 1, fontSize: '0.875rem' }}
                                    >
                                        Confirmar
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={modal.onConfirm}
                                    className="btn-primary"
                                    style={{ width: '100%', fontSize: '0.875rem' }}
                                >
                                    Entendido
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
};
