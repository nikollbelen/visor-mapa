import { useState, useEffect } from 'react';
import './EntornoModal.css';

interface EntornoModalProps {
  isVisible?: boolean;
  onClose?: () => void;
  entornoData?: any;
}

const EntornoModal = ({ isVisible = false, onClose, entornoData }: EntornoModalProps) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // Detectar si es móvil o tablet
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
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

  useEffect(() => {
    setShowTimeEstimate(false);
    setTimeEstimate('');
  }, [entornoData]);

  const handleClose = () => {
    // Resetear todo cuando se cierra completamente
    setIsHidden(false);
    onClose?.();
  };

  const handleShow = () => {
    // Mostrar el modal nuevamente
    setIsHidden(false);
  };

  // Ocultar el botón de reabrir cuando se cambia de sección
  useEffect(() => {
    if (!isVisible) {
      setIsHidden(false);
    }
  }, [isVisible]);

  // No renderizar si no es visible
  if (!isVisible) return null;

  const handleCalculateRoute = async () => {
    setShowTimeEstimate(true);
    
    // Llamar a la función de Cesium para calcular la ruta
    if (window.calculateRoute && data.coordinates) {
      // Pasar el token desde las variables de entorno
      const token = import.meta.env.VITE_OPEN_ROUTE_SERVICE_KEY;

      const startLonLat = [-71.8968, -17.1000]; // Coordenadas de inicio
      
      // Las coordenadas ya vienen como array [longitud, latitud] desde el JavaScript
      const endCoords = Array.isArray(data.coordinates) 
        ? data.coordinates 
        : data.coordinates.split(',').map((coord: string) => parseFloat(coord.trim()));
      
      const result = await window.calculateRoute(token, startLonLat, endCoords, data.tipo);
      
      if (result && result.success) {
        // Actualizar el tiempo estimado en el estado
        setTimeEstimate(`${result.duration} min (${Math.round(result.distance / 1000)} km)`);
      } else {
        setTimeEstimate('Error al calcular la ruta');
      }
    }

    // En móviles ocultar el modal después de calcular la ruta
    if (isMobile) {
      setTimeout(() => {
        setIsHidden(true);
      }, 1000);
    }
  };

  const handleOpenGoogleMaps = () => {
    if (!data.coordinates) return;

    const coords = Array.isArray(data.coordinates)
      ? data.coordinates
      : data.coordinates
          .split(',')
          .map((coord: string) => parseFloat(coord.trim()))
          .filter((value: number) => !Number.isNaN(value));

    if (coords.length < 2) return;

    const [longitude, latitude] = coords;
    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  // No renderizar si no es visible
  if (!isVisible) {
    return null;
  }

  return (
    <>
      {/* Botón para reabrir el modal en móviles cuando está oculto */}
      {isMobile && isHidden && (
        <button 
          className="reopen-entorno-modal-btn"
          onClick={handleShow}
          title="Reabrir información de entorno"
        >
          <i className="fas fa-map-marker-alt"></i>
        </button>
      )}

      {/* Modal principal */}
      {!isHidden && (
        <div className={`around-modal background-container border-container ${isMobile ? 'mobile-modal' : ''}`} id="aroundModalOverlay" style={{ display: 'flex' }}>
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
            <span>{data.title}</span>
            {showTimeEstimate && (
              <div 
                className="around-card-time-estimate inline" 
                id="aroundModalTimeEstimate"
              >
                <i className="fas fa-car" style={{ marginRight: '6px' }}></i><span id="aroundModalTime">{timeEstimate}</span>
              </div>
            )}
          </div>
            <div className="around-card-details">
              <h2>Ubicación:</h2>
              <p id="aroundModalAddress">
                {Array.isArray(data.coordinates) 
                  ? `${data.coordinates[0]}, ${data.coordinates[1]}` 
                  : data.coordinates}
              </p>
            <div className="around-card-info-row">
              <button
                className="around-card-link-button"
                id="openGoogleMapsBtn"
                onClick={handleOpenGoogleMaps}
              >
                Ver en Google Maps <i className="fas fa-map-location-dot"></i>
              </button>
              {!showTimeEstimate && (
                <button 
                  className="background-btn around-card-link-button" 
                  id="calculateRouteBtn"
                  onClick={handleCalculateRoute}
                >
                  Cómo llegar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
      )}
    </>
  );
};

export default EntornoModal;
