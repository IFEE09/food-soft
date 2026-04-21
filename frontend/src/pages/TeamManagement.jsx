import { useState, useEffect } from 'react';
import { useNotification } from '../components/NotificationProvider';
import { apiClient } from '../api/client';
import { 
  Plus, 
  Trash2, 
  Users, 
  ShieldCheck, 
  ChefHat, 
  HeadphonesIcon,
  X,
  Mail,
  Lock,
  User
} from 'lucide-react';

const ROLE_CONFIG = {
  owner: { label: 'SYSTEM_OWNER', color: '#0044FF', bg: 'rgba(0,68,255,0.1)', icon: ShieldCheck },
  receptionist: { label: 'RECEPTION_OFFICER', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: HeadphonesIcon },
  cook: { label: 'KITCHEN_STAFF', color: 'var(--success-color)', bg: 'rgba(204,255,0,0.1)', icon: ChefHat },
};

export default function TeamManagement() {
  const { showAlert, showConfirm } = useNotification();
  const [team, setTeam] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'receptionist'
  });

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const res = await apiClient.get('/users/team');
      setTeam(res.data);
    } catch (err) {
      console.error("Error fetching team:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/users/team', formData);
      showAlert('Miembro Creado', `Se ha registrado a "${formData.full_name}" como ${ROLE_CONFIG[formData.role]?.label}.`, 'success');
      fetchTeam();
      setIsModalOpen(false);
      setFormData({ full_name: '', email: '', password: '', role: 'receptionist' });
    } catch (err) {
      const detail = err.response?.data?.detail || 'Error al crear miembro.';
      showAlert('Error', detail, 'error');
    }
  };

  const deleteMember = async (id, name) => {
    const confirmed = await showConfirm(
      '¿Eliminar Miembro?',
      `"${name}" ya no tendrá acceso al sistema. ¿Deseas continuar?`
    );
    if (confirmed) {
      try {
        await apiClient.delete(`/users/team/${id}`);
        fetchTeam();
        showAlert('Eliminado', `"${name}" ha sido removido del equipo.`, 'success');
      } catch (err) {
        showAlert('Error', err.response?.data?.detail || 'No se pudo eliminar.', 'error');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Users size={20} style={{ color: 'var(--primary-color)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{team.length} miembros en tu equipo</span>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ gap: '0.5rem' }}>
          <Plus size={18} /> Agregar Miembro
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando equipo...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {team.map(member => {
            const roleConf = ROLE_CONFIG[member.role] || ROLE_CONFIG.cook;
            const RoleIcon = roleConf.icon;
            return (
              <div key={member.id} className="glass-panel" style={{ 
                padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ 
                      width: '42px', height: '42px', borderRadius: '2px', 
                      background: 'var(--surface-border)', color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '0.85rem', border: '1px solid var(--surface-border)',
                      fontFamily: 'JetBrains Mono, monospace'
                    }}>
                      {member.full_name?.substring(0, 2).toUpperCase() || '??'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{member.full_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{member.email}</div>
                    </div>
                  </div>
                  {member.role !== 'owner' && (
                    <button 
                      onClick={() => deleteMember(member.id, member.full_name)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="mono" style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    fontSize: '0.65rem', fontWeight: 800, 
                    padding: '0.2rem 0.5rem', borderRadius: '2px',
                    border: `1px solid ${roleConf.color}44`, color: roleConf.color,
                    textTransform: 'uppercase'
                  }}>
                    <RoleIcon size={12} /> {roleConf.label}
                  </span>
                  <span style={{ 
                    fontSize: '0.75rem', fontWeight: 600,
                    color: member.is_active ? '#059669' : 'var(--danger-color)'
                  }}>
                    {member.is_active ? '● Activo' : '○ Inactivo'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Nuevo Miembro</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Nombre Completo</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input 
                    type="text" placeholder="Ej. María López" 
                    style={{ paddingLeft: '38px' }}
                    value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} required 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Correo Electrónico</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input 
                    type="email" placeholder="correo@ejemplo.com" 
                    style={{ paddingLeft: '38px' }}
                    value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Contraseña Temporal</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input 
                    type="text" placeholder="Contraseña inicial"
                    style={{ paddingLeft: '38px' }}
                    value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Rol</label>
                <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                  <option value="receptionist">Recepcionista</option>
                  <option value="cook">Cocinero</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} 
                  style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1px solid var(--surface-border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  Crear Miembro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
