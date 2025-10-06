import { useState, useEffect } from 'react';
import BottomBarItem from './BottomBarItem';
import './BottomBar.css';

const BottomBar = () => {
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

  // Detectar si es móvil o tablet
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const toggleStatusMenu = () => {
    setIsStatusMenuOpen(!isStatusMenuOpen);
  };

  const handleButtonClick = (buttonId: string) => {
    
    // Llamar a la función correspondiente en JavaScript
    switch (buttonId) {
      case 'home':
        if (window.goHome) window.goHome();
        break;
      case 'up':
        if (window.moveCameraUp) window.moveCameraUp();
        break;
      case 'down':
        if (window.moveCameraDown) window.moveCameraDown();
        break;
      case 'zoomIn':
        if (window.zoomIn) window.zoomIn();
        break;
      case 'zoomOut':
        if (window.zoomOut) window.zoomOut();
        break;
      case 'view3d':
        if (window.view3D) window.view3D();
        break;
      case 'grid':
        if (window.toggleGrid) window.toggleGrid();
        // Para el grid, mantener el estado activo
        setActiveButton(activeButton === buttonId ? null : buttonId);
        return;
      default:
        console.warn('Función no encontrada para:', buttonId);
    }
    
    // Para botones que no son grid, no mantener estado activo
    setActiveButton(null);
  };

  const iconButtons = [
    { id: 'home', icon: '/images/bottombar/home.svg', alt: 'Home' },
    { id: 'up', icon: '/images/bottombar/up.svg', alt: 'Up' },
    { id: 'down', icon: '/images/bottombar/down.svg', alt: 'Down' },
    { id: 'zoomIn', icon: '/images/bottombar/zoom+.svg', alt: 'Zoom In' },
    { id: 'zoomOut', icon: '/images/bottombar/zoom-.svg', alt: 'Zoom Out' },
    { id: 'view3d', icon: '/images/bottombar/3D.svg', alt: '3D' },
    { id: 'grid', icon: '/images/bottombar/plot.svg', alt: 'Plot' }
  ];

  const statusButtons = [
    { id: 'disponible', text: 'Disponible', type: 'disponible' },
    { id: 'reservado', text: 'Reservado', type: 'reservado' },
    { id: 'vendido', text: 'Vendido', type: 'vendido' },
    { id: 'negociacion', text: 'En negociación', type: 'negociacion' }
  ];

  return (
    <div className={`bottombar ${isMobile ? 'mobile-bottombar' : ''}`}>
      {/* Status buttons - desplegable en móvil */}
      {isMobile ? (
        <div className="mobile-status-container">
          <button 
            className="mobile-status-toggle"
            onClick={toggleStatusMenu}
          >
            <span>Ver leyenda</span>
            <i className={`toggle-icon fas ${isStatusMenuOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
          </button>
          
          {isStatusMenuOpen && (
            <div className="mobile-status-menu">
              {statusButtons.map((button) => (
                <div key={button.id} className={`mobile-status-item ${button.type}`}>
                  <span className="mobile-status-indicator"></span>
                  <span className="mobile-status-text">{button.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bottombar-status-buttons">
          {statusButtons.map((button) => (
            <button key={button.id} className={`bottombar-status-button ${button.type}`}>
              <span className="bottombar-status-indicator"></span>
              {button.text}
            </button>
          ))}
        </div>
      )}

      {/* Icon bar */}
      <div className={`bottombar-icon-toolbar background-container border-container ${isMobile ? 'mobile-icon-toolbar' : ''}`}>
        {iconButtons.map((button, index) => (
          <div key={button.id} style={{ display: 'flex', alignItems: 'center' }}>
            <BottomBarItem
              id={button.id}
              icon={button.icon}
              alt={button.alt}
              isActive={activeButton === button.id}
              onClick={handleButtonClick}
            />
            {index < iconButtons.length - 1 && <div className="bottombar-divider"></div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BottomBar;
