import { useState } from 'react';
import './BottomBarItem.css';

interface BottomBarItemProps {
  id: string;
  icon: string;
  alt: string;
  isActive: boolean;
  onClick: (id: string) => void;
}

// Mapeo de textos para los tooltips
const tooltipTexts: { [key: string]: string } = {
  home: 'Inicio',
  up: 'Mover cámara arriba',
  down: 'Mover cámara abajo',
  zoomIn: 'Acercar',
  zoomOut: 'Alejar',
  view3d: 'Vista 3D',
  grid: 'Mostrar/Ocultar colores de lotes'
};

const BottomBarItem = ({ id, icon, alt, isActive, onClick }: BottomBarItemProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div 
      className="bottombar-item-wrapper"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
    <button 
      id={id}
      className={`bottombar-icon-button ${isActive ? 'active' : ''}`}
      onClick={() => onClick(id)}
    >
      <img src={icon} alt={alt} />
        <div className={`bottombar-tooltip ${showTooltip ? 'show' : ''}`}>
          {tooltipTexts[id] || alt}
        </div>
    </button>
    </div>
  );
};

export default BottomBarItem;
