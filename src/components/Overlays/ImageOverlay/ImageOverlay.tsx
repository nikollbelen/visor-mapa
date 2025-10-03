// import { useState } from 'react'; // Not used
import './ImageOverlay.css';

interface ImageOverlayProps {
  isVisible?: boolean;
  onClose?: () => void;
  imageSrc?: string;
  imageAlt?: string;
}

const ImageOverlay = ({ 
  isVisible = false, 
  onClose, 
  imageSrc = '/images/placeholder.jpg',
  imageAlt = 'Imagen del área común'
}: ImageOverlayProps) => {
  // const [isAnimating, setIsAnimating] = useState(false); // Not used

  const handleClose = () => {
    // setIsAnimating(false); // Not used
    setTimeout(() => {
      onClose?.();
    }, 400); // Tiempo de la animación de salida
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // No renderizar si no es visible
  if (!isVisible) return null;

  return (
    <div 
      className={`common-areas-overlay ${isVisible ? 'show' : ''}`}
      id="areasComunesImagesModalOverlay"
      onClick={handleOverlayClick}
    >
      <div className="common-areas-container-image">
        <button 
          className="close-btn" 
          id="areasComunesImagesCloseBtn"
          onClick={handleClose}
        >
          <i className="fas fa-times"></i>
        </button>
        <div className="common-areas-image">
          <img 
            id="areasComunesImage" 
            src={imageSrc} 
            alt={imageAlt}
            onLoad={() => {/* setIsAnimating(true); */}}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageOverlay;
