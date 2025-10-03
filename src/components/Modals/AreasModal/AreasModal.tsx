// import { useState } from 'react'; // Not used
import './AreasModal.css';

interface AreasModalProps {
  isVisible?: boolean;
  onClose?: () => void;
  areasData?: any;
}

const AreasModal = ({ isVisible = false, onClose, areasData }: AreasModalProps) => {
  
  const handleClose = () => {
    onClose?.();
  };

  const handleViewImage = (imageUrl: string) => {
    if (window.openAreasComunesImage) {
      window.openAreasComunesImage(imageUrl);
    }
  };

  const handleViewOnMap = (fid: number) => {
    if (window.flyToAreaComun) {
      window.flyToAreaComun(fid);
    }
  };

  // No renderizar si no es visible
  if (!isVisible) return null;

  return (
    <div className="common-areas-modal background-container border-container" id="commonAreasModalOverlay">
      <button className="close-btn" id="closeCommonAreasModal" onClick={handleClose}>
        <i className="fas fa-times"></i>
      </button>
      
      <div className="common-areas-modal-header">
        <div className="common-areas-modal-title">
          <img src="/images/sidebar/areas/comunidad.svg" alt="Comunidad" className="common-areas-modal-icon" />
          <span>Comunidad</span>
        </div>
      </div>
      
      <div className="common-areas-modal-content">
        <div className="common-areas-section">
          <div className="common-areas-grid" id="commonAreasGrid">
            {areasData && areasData.features ? (
              areasData.features.map((feature: any) => {
                const fid = feature.properties.fid;
                const name = feature.properties.name;
                const image = feature.properties.image;

                return (
                  <div key={fid} className="common-areas-card" data-marker={`area_comun_${fid}`}>
                    <div 
                      className="common-areas-card-image" 
                      style={{ backgroundImage: `url('${image}')` }}
                    />
                    <div className="common-areas-card-title">{name}</div>
                    <div className="common-areas-card-buttons">
                      <button 
                        className="common-areas-card-button" 
                        style={{ backgroundColor: '#948f8f80' }}
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
                );
              })
            ) : (
              <div>No hay áreas comunes disponibles</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AreasModal;
