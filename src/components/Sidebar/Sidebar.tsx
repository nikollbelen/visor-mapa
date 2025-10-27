import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SidebarItem from './SidebarItem';
import LoginModal from '../Modals/LoginModal/LoginModal';
import UserInfoModal from '../Modals/UserInfoModal/UserInfoModal';
import './Sidebar.css';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);


  // Detectar si es móvil o tablet
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogin = (user: {id: string; nombre: string; email: string}) => {
    // El contexto de autenticación ya maneja el estado del usuario
    console.log('Usuario logueado:', user);
  };

  const handleCloseLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsUserInfoModalOpen(false);
  };

  const handleCloseUserInfoModal = () => {
    setIsUserInfoModalOpen(false);
  };

  const handleItemClick = (itemId: string) => {
    // Si es el botón de usuario
    if (itemId === 'usuario') {
      if (user) {
        // Si ya está logueado, mostrar modal de información del usuario
        setIsUserInfoModalOpen(true);
      } else {
        // Si no está logueado, abrir modal de login
        setIsLoginModalOpen(true);
      }
      // Cerrar menú en móvil si está abierto
      if (isMobile) {
        setIsMenuOpen(false);
      }
      return;
    }

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
      // Cerrar menú en móvil si está abierto
      if (isMobile) {
        setIsMenuOpen(false);
      }
      return;
    }

    // Activar el nuevo item
    setActiveItem(itemId);
    
    // Cerrar menú en móvil después de seleccionar un item
    if (isMobile) {
      setIsMenuOpen(false);
    }

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
    },
    {
      id: 'usuario',
      icon: '/images/sidebar/icon_user.png',
      alt: 'Usuario',
      text: user ? user.full_name : 'Invitado'
    }
  ];

  return (
    <>
      {/* Barra superior para móvil */}
      {isMobile && (
        <div className="mobile-top-bar">
          <div className="mobile-logo">
            <img src="/images/init/init-logo.svg" alt="Mykonos Residencial Playa" />
          </div>
          <button 
            className="hamburger-button"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            <div className={`hamburger-icon ${isMenuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>
        </div>
      )}

      {/* Sidebar normal para desktop */}
      {!isMobile && (
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
      )}

      {/* Menú desplegable para móvil */}
      {isMobile && isMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu-content">
            <div className="mobile-menu-items">
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
        </div>
      )}

      {/* Modal de Login */}
      <LoginModal
        isVisible={isLoginModalOpen}
        onClose={handleCloseLoginModal}
      />

      {/* Modal de Información del Usuario */}
      {user && (
        <UserInfoModal
          isVisible={isUserInfoModalOpen}
          user={user}
          onClose={handleCloseUserInfoModal}
          onLogout={handleLogout}
        />
      )}
    </>
  );
};

export default Sidebar;
