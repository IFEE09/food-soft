import { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const [modal, setModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info', // info, success, warning, error, confirm
        onConfirm: null,
        onCancel: null,
    });

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
        switch (modal.type) {
            case 'success': return <CheckCircle size={48} className="notification-icon-success" />;
            case 'warning': return <AlertTriangle size={48} className="notification-icon-warning" />;
            case 'error': return <XCircle size={48} className="notification-icon-error" />;
            case 'confirm': return <AlertTriangle size={48} className="notification-icon-confirm" />;
            default: return <Info size={48} className="notification-icon-info" />;
        }
    };

    return (
        <NotificationContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {modal.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ 
                        maxWidth: '400px', 
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '2.5rem 2rem'
                    }}>
                        <div className="notification-icon-container">
                            {getIcon()}
                        </div>
                        
                        <h2 style={{ 
                            fontSize: '1.25rem', 
                            fontWeight: 700, 
                            margin: 0,
                            color: 'var(--text-primary)' 
                        }}>
                            {modal.title}
                        </h2>
                        
                        <p style={{ 
                            fontSize: '0.95rem', 
                            color: 'var(--text-secondary)', 
                            margin: 0,
                            lineHeight: '1.5'
                        }}>
                            {modal.message}
                        </p>

                        <div style={{ 
                            display: 'flex', 
                            gap: '0.75rem', 
                            width: '100%', 
                            marginTop: '1rem' 
                        }}>
                            {modal.type === 'confirm' ? (
                                <>
                                    <button 
                                        onClick={modal.onCancel}
                                        style={{ 
                                            flex: 1, 
                                            padding: '0.75rem', 
                                            background: 'none', 
                                            border: '1px solid var(--surface-border)', 
                                            borderRadius: '8px', 
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={modal.onConfirm}
                                        className="btn-primary"
                                        style={{ 
                                            flex: 1,
                                            background: 'var(--primary-color)',
                                            borderRadius: '8px'
                                        }}
                                    >
                                        Aceptar
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={modal.onConfirm}
                                    className="btn-primary"
                                    style={{ 
                                        width: '100%',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Entendido
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <style dangerouslySetInnerHTML={{ __html: `
                .notification-icon-container {
                    margin-bottom: 0.5rem;
                }
                .notification-icon-success { color: #10B981; }
                .notification-icon-warning { color: #F59E0B; }
                .notification-icon-error { color: #EF4444; }
                .notification-icon-confirm { color: #6366F1; }
                .notification-icon-info { color: #3B82F6; }
            `}} />
        </NotificationContext.Provider>
    );
};
