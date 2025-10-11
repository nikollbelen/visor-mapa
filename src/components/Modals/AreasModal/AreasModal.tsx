import { useState, useEffect } from 'react';
import './AreasModal.css';

interface AreasModalProps {
  isVisible?: boolean;
  onClose?: () => void;
  areasData?: any;
}

const AreasModal = ({ isVisible = false, onClose, areasData }: AreasModalProps) => {
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

  const handleViewImage = (imageUrl: string) => {
    if (window.openAreasComunesImage) {
      window.openAreasComunesImage(imageUrl);
    }
  };

  const handleViewOnMap = (fid: number) => {
    if (window.flyToAreaComun) {
      window.flyToAreaComun(fid);
      // Solo ocultar en móviles, en desktop mantener el modal abierto
      if (isMobile) {
        setTimeout(() => {
          setIsHidden(true);
        }, 1000);
      }
      // En desktop no hacer nada más, solo mover la cámara
    }
  };

  // No renderizar si no es visible
  if (!isVisible) return null;

  return (
    <>
      {/* Botón para reabrir el modal en móviles cuando está oculto */}
      {isMobile && isHidden && (
        <button 
          className="reopen-areas-modal-btn"
          onClick={handleShow}
          title="Reabrir áreas comunes"
        >
          <i className="fas fa-map-marker-alt"></i>
        </button>
      )}

      {/* Modal principal */}
      {!isHidden && (
        <div className={`common-areas-modal background-container border-container ${isMobile ? 'mobile-modal' : ''}`} id="commonAreasModalOverlay">
          <button className="close-btn" id="closeCommonAreasModal" onClick={handleClose}>
            <i className="fas fa-times"></i>
          </button>
      
      <div className="common-areas-modal-header">
        <div className="common-areas-modal-title">
          <img src="/images/sidebar/areas/comunidad.svg" alt="Comunidad" className="common-areas-modal-icon" />
          <span>Comunidad</span>
        </div>
      </div>
      
      <div className={`common-areas-modal-content ${isMobile ? 'mobile-modal-content' : ''}`}>
        <div className="common-areas-section">
          <div className={`common-areas-grid ${isMobile ? 'mobile-grid' : ''}`} id="commonAreasGrid">
            {areasData && areasData.values ? (
              areasData.values.map((row: any) => {
                const fid = parseInt(row[0]);
                const name = row[1];
                const image = row[3];

                return (
                  <div key={fid} className={`common-areas-card background-container border-container ${isMobile ? 'mobile-card' : ''}`} data-marker={`area_comun_${fid}`}>
                    <div 
                      className="common-areas-card-image" 
                      style={{ backgroundImage: `url('${image}')` }}
                    />
                    <div className="common-areas-card-content">
                      <div className="common-areas-card-title">{name}</div>
                      <div className="common-areas-card-buttons">
                        <button 
                          className="background-btn common-areas-card-button" 
                          onClick={() => handleViewImage(image)}
                        >
                          <span>Ver imágenes</span>
                        </button>
                        <button 
                          className="common-areas-card-button" 
                          onClick={() => handleViewOnMap(fid)}
                        >
                          <span>Ver en el mapa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div>No hay áreas comunes disponibles</div>
            )}
          </div>
        </div>
      </div>
    </div>
      )}
    </>
  );
};

export default AreasModal;
