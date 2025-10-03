import { useState, useEffect } from 'react';
import SidebarItem from './SidebarItem';
import './Sidebar.css';

const Sidebar = () => {
  const [activeItem, setActiveItem] = useState<string | null>(null);

  // Sincronizar estado de React con el estado real del DOM
  useEffect(() => {
    const checkActiveButtons = () => {
      const buttons = ['fotos', 'areas', 'lotes', 'entorno', 'video'];
      let activeButtonId = null;
      
      for (const buttonId of buttons) {
        const buttonElement = document.getElementById(buttonId);
        if (buttonElement?.classList.contains('active')) {
          activeButtonId = buttonId;
          break;
        }
      }
      
      if (activeButtonId !== activeItem) {
        setActiveItem(activeButtonId);
      }
    };

    // Verificar cada 100ms para sincronizar
    const interval = setInterval(checkActiveButtons, 100);
    
    return () => clearInterval(interval);
  }, [activeItem]);

  const handleItemClick = (itemId: string) => {
    // Verificar el estado real del botón en el DOM
    const buttonElement = document.getElementById(itemId);
    const isCurrentlyActive = buttonElement?.classList.contains('active');
    
    // Si el botón ya está activo en el DOM, desactivarlo
    if (isCurrentlyActive) {
      setActiveItem(null);
      // Llamar a reiniciar menú para limpiar todo
      if (window.reiniciarMenu) {
        window.reiniciarMenu();
      }
      return;
    }

    // Activar el nuevo item
    setActiveItem(itemId);

    // Llamar a la función correspondiente de Cesium
    switch (itemId) {
      case 'fotos':
        if (window.handleFotos) {
          window.handleFotos();
        }
        break;
      case 'areas':
        if (window.handleAreasComunes) {
          window.handleAreasComunes();
        }
        break;
      case 'lotes':
        if (window.handleLotes) {
          window.handleLotes();
        }
        break;
      case 'entorno':
        if (window.handleEntorno) {
          window.handleEntorno();
        }
        break;
      case 'video':
        if (window.handleVideo) {
          window.handleVideo();
        }
        break;
      default:
        console.log('Función no implementada para:', itemId);
    }
  };

  const sidebarItems = [
    {
      id: 'fotos',
      icon: '/images/sidebar/icon_fotos.svg',
      alt: 'Fotos 360°',
      text: 'Fotos 360°'
    },
    {
      id: 'areas',
      icon: '/images/sidebar/icon_areas.svg',
      alt: 'Áreas comunes',
      text: 'Áreas comunes'
    },
    {
      id: 'lotes',
      icon: '/images/sidebar/icon_lotes.svg',
      alt: 'Lotes',
      text: 'Lotes'
    },
    {
      id: 'entorno',
      icon: '/images/sidebar/icon_entorno.svg',
      alt: 'Entorno',
      text: 'Entorno'
    },
    {
      id: 'video',
      icon: '/images/sidebar/icon_video.svg',
      alt: 'Video',
      text: 'Video'
    }
  ];

  return (
    <nav className="sidebar background-container border-container">
      <div className="sidebar-logo">
        <img src="/images/logo_mikonos.png" alt="Mykonos Residencial Playa" />
      </div>

      <div className="sidebar-container">
        <div className="sidebar-items">
          {sidebarItems.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id}
              icon={item.icon}
              alt={item.alt}
              text={item.text}
              isActive={activeItem === item.id}
              onClick={handleItemClick}
            />
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
