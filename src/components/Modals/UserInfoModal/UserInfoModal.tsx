import "./UserInfoModal.css";

interface UserInfoModalProps {
  isVisible: boolean;
  user: {
    id: string;
    full_name: string;
    email: string;
  };
  onClose: () => void;
  onLogout: () => void;
}

const UserInfoModal = ({ isVisible, user, onClose, onLogout }: UserInfoModalProps) => {
  if (!isVisible) return null;

  const handleLogout = () => {
    onLogout();
    onClose();
  };

  const ADMIN_URL = import.meta.env.VITE_ADMIN_URL;

  const handleGoToDashboard = () => {
    window.open(ADMIN_URL, '_blank');
  };

  return (
    <div className="user-info-modal-overlay">
      <div className="user-info-modal">
        <div className="user-info-modal-header">
          <h2 className="user-info-modal-title">Información del Usuario</h2>
          <button className="user-info-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="user-info-modal-content">
          <div className="user-info-section">
            <div className="user-info-avatar">
              <i className="fas fa-user-circle"></i>
            </div>
            <div className="user-info-details">
              <div className="user-info-field">
                <label>Nombre:</label>
                <span>{user.full_name}</span>
              </div>
              
              <div className="user-info-field">
                <label>Email:</label>
                <span>{user.email}</span>
              </div>
              
              <div className="user-info-field">
                <label>Estado:</label>
                <span className="status-active">
                  <i className="fas fa-circle"></i>
                  Activo
                </span>
              </div>
            </div>
          </div>

          <div className="user-info-actions">
            <button 
              className="btn-dashboard" 
              onClick={handleGoToDashboard}
            >
              <i className="fas fa-tachometer-alt"></i>
              Ir al Dashboard
            </button>
            <button className="btn-logout" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i>
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="user-info-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserInfoModal;

