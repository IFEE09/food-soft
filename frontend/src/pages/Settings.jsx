import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { 
  User, 
  Lock, 
  Activity, 
  Save, 
  ShieldCheck, 
  Building2,
  Trash2,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile'); // profile, security, stations
  const [profileData, setProfileData] = useState({ full_name: '', email: '' });
  const [passData, setPassData] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [kitchens, setKitchens] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [uRes, kRes] = await Promise.all([
        apiClient.get('/users/me'),
        apiClient.get('/kitchens/')
      ]);
      setProfileData({ full_name: uRes.data.full_name, email: uRes.data.email });
      setKitchens(kRes.data);
    } catch (err) {
      console.error("Error fetching settings data:", err);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await apiClient.put('/users/me', { full_name: profileData.full_name, email: profileData.email });
      setMsg({ text: 'Perfil actualizado correctamente.', type: 'success' });
      localStorage.setItem('userName', profileData.full_name); 
    } catch (err) {
      setMsg({ text: 'Error al actualizar perfil.', type: 'error' });
    } finally {
      setIsUpdating(false);
      setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passData.new_password !== passData.confirm) {
        setMsg({ text: 'Las contraseñas no coinciden.', type: 'error' });
        return;
    }
    setIsUpdating(true);
    try {
      await apiClient.post('/users/me/change-password', {
        current_password: passData.current_password,
        new_password: passData.new_password
      });
      setMsg({ text: 'Contraseña cambiada con éxito.', type: 'success' });
      setPassData({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setMsg({ text: err.response?.data?.detail || 'Error al cambiar contraseña.', type: 'error' });
    } finally {
      setIsUpdating(false);
      setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    }
  };

  const toggleKitchen = async (id, currentStatus) => {
    try {
      await apiClient.put(`/kitchens/${id}`, { is_active: !currentStatus });
      fetchData();
    } catch (err) {
      console.error("Error toggling kitchen:", err);
    }
  };

  const deleteKitchen = async (id) => {
    if (window.confirm("¿Eliminar esta estación definitivamente?")) {
        try {
          await apiClient.delete(`/kitchens/${id}`);
          fetchData();
        } catch (err) {
          console.error("Error deleting kitchen:", err);
        }
    }
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('profile')}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 0', cursor: 'pointer',
            color: activeTab === 'profile' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: '0.95rem',
            borderBottom: activeTab === 'profile' ? '2px solid var(--primary-color)' : '2px solid transparent'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><User size={18}/> Perfil</div>
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 0', cursor: 'pointer',
            color: activeTab === 'security' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: '0.95rem',
            borderBottom: activeTab === 'security' ? '2px solid var(--primary-color)' : '2px solid transparent'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Lock size={18}/> Seguridad</div>
        </button>
        <button 
          onClick={() => setActiveTab('stations')}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 0', cursor: 'pointer',
            color: activeTab === 'stations' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: '0.95rem',
            borderBottom: activeTab === 'stations' ? '2px solid var(--primary-color)' : '2px solid transparent'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity size={18}/> Estaciones</div>
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        {msg.text && (
          <div style={{ 
            padding: '1rem', marginBottom: '1.5rem', borderRadius: '8px', 
            backgroundColor: msg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: msg.type === 'success' ? '#059669' : '#DC2626',
            fontSize: '0.9rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            <ShieldCheck size={18} /> {msg.text}
          </div>
        )}

        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}><Building2 size={16} /> Nombre del Negocio / Propietario</label>
              <input 
                type="text" value={profileData.full_name}
                onChange={(e) => setProfileData({...profileData, full_name: e.target.value})}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Correo de Contacto</label>
              <input 
                type="email" value={profileData.email}
                onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={isUpdating} style={{ width: 'fit-content' }}>
              <Save size={18} /> {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>
        )}

        {activeTab === 'security' && (
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Contraseña Actual</label>
              <div style={{ position: 'relative' }}>
                <input 
                    type={showCurrent ? 'text' : 'password'} value={passData.current_password}
                    onChange={(e) => setPassData({...passData, current_password: e.target.value})}
                    required
                    style={{ width: '100%', paddingRight: '45px' }}
                />
                <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', opacity: 0.6 }}
                >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Nueva Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input 
                    type={showNew ? 'text' : 'password'} value={passData.new_password}
                    onChange={(e) => setPassData({...passData, new_password: e.target.value})}
                    required
                    style={{ width: '100%', paddingRight: '45px' }}
                />
                <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', opacity: 0.6 }}
                >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Confirmar Nueva Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input 
                    type={showConfirm ? 'text' : 'password'} value={passData.confirm}
                    onChange={(e) => setPassData({...passData, confirm: e.target.value})}
                    required
                    style={{ width: '100%', paddingRight: '45px' }}
                />
                <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', opacity: 0.6 }}
                >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={isUpdating} style={{ width: 'fit-content' }}>
              <Lock size={18} /> {isUpdating ? 'Actualizando...' : 'Cambiar Contraseña'}
            </button>
          </form>
        )}

        {activeTab === 'stations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Gestión de Líneas de Producción</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Configura aquí tus estaciones del monitor de cocina.</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {kitchens.map(k => (
                <div key={k.id} style={{ 
                    padding: '1.25rem', border: '1px solid var(--surface-border)', borderRadius: '10px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                   <div>
                     <div style={{ fontWeight: 700, fontSize: '0.95rem', color: k.is_active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{k.name}</div>
                     <span style={{ fontSize: '0.75rem', fontWeight: 600, color: k.is_active ? '#059669' : 'var(--danger-color)' }}>
                         {k.is_active ? 'Activa' : 'Desconectada'}
                     </span>
                   </div>
                   <div style={{ display: 'flex', gap: '0.5rem' }}>
                     <button 
                        onClick={() => toggleKitchen(k.id, k.is_active)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer' }}
                        title="Alternar estado"
                     >
                        <Activity size={18} />
                     </button>
                     <button 
                        onClick={() => deleteKitchen(k.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}
                     >
                        <Trash2 size={18} />
                     </button>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
