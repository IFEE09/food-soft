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
        const iconSize = 40;
        switch (modal.type) {
            case 'success': return <CheckCircle size={iconSize} style={{ color: 'var(--success-color)' }} />;
            case 'warning': return <AlertTriangle size={iconSize} style={{ color: '#F59E0B' }} />;
            case 'error': return <XCircle size={iconSize} style={{ color: 'var(--danger-color)' }} />;
            case 'confirm': return <AlertTriangle size={iconSize} style={{ color: 'var(--primary-color)' }} />;
            default: return <Info size={iconSize} style={{ color: 'var(--text-secondary)' }} />;
        }
    };

    return (
        <NotificationContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {modal.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ 
                        maxWidth: '420px', 
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.25rem',
                        padding: '2.5rem 2rem',
                        borderRadius: '2px',
                        border: '1px solid var(--surface-border)'
                    }}>
                        <div className="notification-icon-container">
                            {getIcon()}
                        </div>
                        
                        <h2 style={{ 
                            fontSize: '1rem', 
                            fontWeight: 700, 
                            margin: 0,
                            color: 'var(--text-primary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em'
                        }}>
                            {modal.title}
                        </h2>
                        
                        <p style={{ 
                            fontSize: '0.85rem', 
                            color: 'var(--text-secondary)', 
                            margin: 0,
                            lineHeight: '1.6',
                            fontFamily: 'JetBrains Mono, monospace'
                        }}>
                            {modal.message}
                        </p>

                        <div style={{ 
                            display: 'flex', 
                            gap: '0.75rem', 
                            width: '100%', 
                            marginTop: '0.5rem' 
                        }}>
                            {modal.type === 'confirm' ? (
                                <>
                                    <button 
                                        onClick={modal.onCancel}
                                        style={{ 
                                            flex: 1, 
                                            padding: '0.75rem', 
                                            background: 'transparent', 
                                            border: '1px solid var(--surface-border)', 
                                            borderRadius: '2px', 
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.8rem',
                                            color: 'var(--text-secondary)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}
                                    >
                                        ABORT
                                    </button>
                                    <button 
                                        onClick={modal.onConfirm}
                                        className="btn-primary"
                                        style={{ 
                                            flex: 1,
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        PROCEED
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={modal.onConfirm}
                                    className="btn-primary"
                                    style={{ 
                                        width: '100%',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    ACKNOWLEDGE
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <style dangerouslySetInnerHTML={{ __html: `
                .notification-icon-container {
                    margin-bottom: 0.25rem;
                }
            `}} />
        </NotificationContext.Provider>
    );
};
