import { useState } from 'react';
import './Instructions.css';

interface InstructionsProps {
  onClose?: () => void;
}

const Instructions = ({ onClose }: InstructionsProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  const handleClose = () => {
    setIsFading(true);
    
    // Remover del DOM después de la animación
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 500);
  };

  // No renderizar si no es visible
  if (!isVisible) return null;

  return (
    <div 
      className={`instructions-overlay ${isFading ? 'fade-out' : ''}`}
      id="instructions-overlay"
    >
      <div style={{ maxWidth: '90%' }}>
        <h2>Instrucciones de navegación</h2>

        {/* Desktop instructions */}
        <div className="instructions-container">
          <div className="instruction background-container">
            <img 
              src="/images/instructions/PC/click.svg" 
              alt="Clic sostenido" 
              className="mouse-icon"
            />
            <div className="instruction-text background-light-container">
              <div className="instruction-title">Clic sostenido</div>
              <div className="instruction-subtitle">Desplazarse</div>
            </div>
          </div>

          <div className="instruction background-container">
            <img 
              src="/images/instructions/PC/wheel.svg" 
              alt="Deslizar rueda" 
              className="mouse-icon"
            />
            <div className="instruction-text background-light-container">
              <div className="instruction-title">Deslizar rueda</div>
              <div className="instruction-subtitle">Ajustar zoom</div>
            </div>
          </div>

          <div className="instruction background-container">
            <img 
              src="/images/instructions/PC/scroll.svg" 
              alt="Rueda sostenida" 
              className="mouse-icon"
            />
            <div className="instruction-text background-light-container">
              <div className="instruction-title">Rueda sostenida</div>
              <div className="instruction-subtitle">Cambiar perspectiva</div>
            </div>
          </div>
        </div>

        {/* Mobile instructions */}
        <div className="instructions-container-mobile">
          <div className="instruction-mobile background-container">
            <img 
              src="/images/instructions/movil/pinch-zoom.png" 
              alt="Tocar y arrastrar" 
              className="hand-icon"
            />
            <div className="instruction-text background-light-container">
              <div className="instruction-title">Pellizca con dos dedos</div>
              <div className="instruction-subtitle">Ajustar zoom</div>
            </div>
          </div>

          <div className="instruction-mobile background-container">
            <img 
              src="/images/instructions/movil/rotate-fingers.png" 
              alt="Pellizcar" 
              className="hand-icon"
            />
            <div className="instruction-text background-light-container">
              <div className="instruction-title">Girar con dos dedos</div>
              <div className="instruction-subtitle">Rotación</div>
            </div>
          </div>

          <div className="instruction-mobile background-container">
            <img 
              src="/images/instructions/movil/drag-finger.png" 
              alt="Arrastrar con dos dedos" 
              className="hand-icon"
            />
            <div className="instruction-text background-light-container">
              <div className="instruction-title">Arrastrar el dedo</div>
              <div className="instruction-subtitle">Desplazarse</div>
            </div>
          </div>

          <div className="instruction-mobile background-container">
            <img 
              src="/images/instructions/movil/tap-finger.png" 
              alt="Tocar elemento" 
              className="hand-icon"
            />
            <div className="instruction-text background-light-container">
              <div className="instruction-title">Hacer tap</div>
              <div className="instruction-subtitle">Ver más detalles</div>
            </div>
          </div>
        </div>

        <button 
          className="understood-btn background-btn"
          id="instructions-close-button"
          onClick={handleClose}
        >
          Entendido
        </button>
      </div>
    </div>
  );
};

export default Instructions;
