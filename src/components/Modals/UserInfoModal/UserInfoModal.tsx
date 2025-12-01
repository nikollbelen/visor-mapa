import "./UserInfoModal.css";
import { useAuth } from "../../../contexts/AuthContext";
import { useState } from "react";

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
  const { token } = useAuth();
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  if (!isVisible) return null;

  const handleLogout = () => {
    onLogout();
    onClose();
  };

  const ADMIN_URL = import.meta.env.VITE_ADMIN_URL;

  const handleGoToDashboard = async () => {
    if (!token) {
      console.error('No hay token de autenticación');
      return;
    }

    setIsLoadingDashboard(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const normalizedBase = apiBaseUrl?.replace(/\/$/, '') || '';
      
      const response = await fetch(`${normalizedBase}/users/generate-temp-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data?.temp_token) {
        const dashboardUrl = `${ADMIN_URL}?token=${data.data.temp_token}`;
        window.open(dashboardUrl, '_blank');
      } else {
        throw new Error(data.message || 'Error al generar token temporal');
      }
    } catch (error) {
      console.error('Error al generar token temporal:', error);
      alert('Error al acceder al dashboard. Por favor, intenta nuevamente.');
    } finally {
      setIsLoadingDashboard(false);
    }
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
              disabled={isLoadingDashboard}
            >
              <i className="fas fa-tachometer-alt"></i>
              {isLoadingDashboard ? 'Cargando...' : 'Ir al Dashboard'}
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

