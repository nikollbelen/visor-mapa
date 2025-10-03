import { useState } from 'react';
import './EntornoModal.css';

interface EntornoModalProps {
  isVisible?: boolean;
  onClose?: () => void;
  entornoData?: any;
}

const EntornoModal = ({ isVisible = false, onClose, entornoData }: EntornoModalProps) => {
  
  // Datos por defecto si no hay datos del entorno
  const defaultEntornoData = {
    title: 'Ubicación',
    tipo: 'Turismo',
    imagen: '/images/club_house.jpg',
    coordinates: 'Coordenadas no disponibles'
  };

  // Usar datos del entorno si están disponibles, sino usar datos por defecto
  const data = entornoData ? {
    title: entornoData.title || 'Ubicación',
    tipo: entornoData.tipo || 'Turismo',
    imagen: entornoData.imagen || '/images/club_house.jpg',
    coordinates: entornoData.coordinates || 'Coordenadas no disponibles'
  } : defaultEntornoData;

  const [showTimeEstimate, setShowTimeEstimate] = useState(false);
  const [timeEstimate, setTimeEstimate] = useState('');

  const handleClose = () => {
    onClose?.();
  };

  // No renderizar si no es visible
  if (!isVisible) return null;

  const handleCalculateRoute = async () => {
    setShowTimeEstimate(true);
    
    // Llamar a la función de Cesium para calcular la ruta
    if (window.calculateRoute && data.coordinates) {
      const startLonLat = [-71.8968, -17.1000]; // Coordenadas de inicio
      
      // Las coordenadas ya vienen como array [longitud, latitud] desde el JavaScript
      const endCoords = Array.isArray(data.coordinates) 
        ? data.coordinates 
        : data.coordinates.split(',').map((coord: string) => parseFloat(coord.trim()));
      
      const result = await window.calculateRoute(startLonLat, endCoords, data.tipo);
      
      if (result && result.success) {
        // Actualizar el tiempo estimado en el estado
        setTimeEstimate(`${result.duration} min (${Math.round(result.distance / 1000)} km)`);
      } else {
        setTimeEstimate('Error al calcular la ruta');
      }
    }
  };

  // No renderizar si no es visible
  if (!isVisible) {
    return null;
  }

  return (
    <div className="around-modal background-container border-container" id="aroundModalOverlay" style={{ display: 'flex' }}>
      <button className="close-btn" id="closeAroundModal" onClick={handleClose}>
        <i className="fas fa-times"></i>
      </button>
      
      <div className="around-modal-header">
        <div className="around-modal-title">
          <img 
            src={`/images/sidebar/entorno/iconos/${data.tipo.toLowerCase()}.svg`} 
            id="locationModalIcon" 
            alt={data.title}
            className="around-modal-icon" 
          />
          <span id="aroundModalTitle">{data.tipo}</span>
        </div>
      </div>
      
      <div className="around-modal-content">
        <div className="around-section">
          <div 
            className="around-card-image" 
            id="aroundModalImage"
            style={{ backgroundImage: `url(${data.imagen})` }}
          ></div>
          <div className="around-card-title" id="aroundCardTitle">
            {data.title}
          </div>
            <div className="around-card-details">
              <h2>Ubicación:</h2>
              <p id="aroundModalAddress">
                {Array.isArray(data.coordinates) 
                  ? `${data.coordinates[0]}, ${data.coordinates[1]}` 
                  : data.coordinates}
              </p>
            <div className="around-card-info-row">
              <div 
                className="around-card-time-estimate" 
                id="aroundModalTimeEstimate"
                style={{ display: showTimeEstimate ? 'block' : 'none' }}
              >
                <span id="aroundModalTime">{timeEstimate}</span>
              </div>
              <button 
                className="around-card-link-button" 
                id="calculateRouteBtn"
                onClick={handleCalculateRoute}
              >
                Cómo llegar <i className="fas fa-route"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntornoModal;
