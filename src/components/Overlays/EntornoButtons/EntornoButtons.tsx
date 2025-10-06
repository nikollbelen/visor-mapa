import { useState, useEffect } from 'react';
import './EntornoButtons.css';

interface EntornoButtonsProps {
  isVisible?: boolean;
}

const EntornoButtons = ({ isVisible = false }: EntornoButtonsProps) => {
  const [activeButton, setActiveButton] = useState('todos');
  const [isMobile, setIsMobile] = useState(false);

  // Detectar si es móvil o tablet
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Controlar la visibilidad del desplegable de status buttons
  useEffect(() => {
    if (isMobile && isVisible) {
      // Ocultar el desplegable de status buttons cuando está en entorno
      const statusContainer = document.querySelector('.mobile-status-container');
      if (statusContainer) {
        (statusContainer as HTMLElement).style.display = 'none';
      }
    } else if (isMobile && !isVisible) {
      // Mostrar el desplegable de status buttons cuando sale de entorno
      const statusContainer = document.querySelector('.mobile-status-container');
      if (statusContainer) {
        (statusContainer as HTMLElement).style.display = 'block';
      }
    }
  }, [isMobile, isVisible]);

  const entornoButtons = [
    { id: 'todos', icon: '/images/sidebar/icon_entorno.svg', alt: 'Todos', text: 'Todos' },
    { id: 'playas', icon: '/images/sidebar/entorno/iconos/playas.svg', alt: 'Playas', text: 'Playas' },
    { id: 'restaurantes', icon: '/images/sidebar/entorno/iconos/restaurantes.svg', alt: 'Restaurantes', text: 'Restaurantes' },
    { id: 'hoteles', icon: '/images/sidebar/entorno/iconos/hoteles.svg', alt: 'Hoteles', text: 'Hoteles' },
    { id: 'turismo', icon: '/images/sidebar/entorno/iconos/turismo.svg', alt: 'Turismo', text: 'Turismo' },
    { id: 'seguridad', icon: '/images/sidebar/entorno/iconos/seguridad.svg', alt: 'Seguridad', text: 'Seguridad' }
  ];

  const handleButtonClick = (buttonId: string) => {
    setActiveButton(buttonId);
    
    // Llamar a la función de Cesium para filtrar por tipo
    if (window.filterEntornoByType) {
      // Mapear el ID del botón al tipo de filtro
      const tipoMap: { [key: string]: string } = {
        'todos': 'Todos',
        'playas': 'Playas',
        'restaurantes': 'Restaurantes',
        'hoteles': 'Hoteles',
        'turismo': 'Turismo',
        'seguridad': 'Seguridad'
      };
      
      const tipo = tipoMap[buttonId] || 'Todos';
      window.filterEntornoByType(tipo);
    }
  };

  // No renderizar si no es visible
  if (!isVisible) return null;

  return (
    <div className={`around-buttons-container ${isMobile ? 'mobile-entorno' : ''}`} id="aroundButtonsContainer" style={{ display: 'flex' }}>
      {entornoButtons.map((button) => (
        <div 
          key={button.id}
          className={`around-button ${activeButton === button.id ? 'active' : ''}`}
          onClick={() => handleButtonClick(button.id)}
        >
          <img src={button.icon} alt={button.alt} />
          <span>{button.text}</span>
        </div>
      ))}
    </div>
  );
};

export default EntornoButtons;
