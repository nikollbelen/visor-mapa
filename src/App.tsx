import { useEffect, useState, useCallback } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import SplashScreen from "./Layout/SplashScreen/SplashScreen";
import Instructions from "./Layout/Instructions/Instructions";
import Sidebar from "./components/Sidebar/Sidebar";
import BottomBar from "./components/BottomBar/BottomBar";
import LotInfoModal from "./components/Modals/LotInfoModal/LotInfoModal";
import AreasModal from "./components/Modals/AreasModal/AreasModal";
import LotSearchModal from "./components/Modals/LotSearchModal/LotSearchModal";
import EntornoModal from "./components/Modals/EntornoModal/EntornoModal";
import EntornoButtons from "./components/Overlays/EntornoButtons/EntornoButtons";
import VideoOverlay from "./components/Overlays/VideoOverlay/VideoOverlay";
import ImageOverlay from "./components/Overlays/ImageOverlay/ImageOverlay";
import Photos360Overlay from "./components/Overlays/Photos360Overlay/Photos360Overlay";
import TimeOfDayControl from "./components/Overlays/TimeOfDayControl/TimeOfDayControl";
import { useWebSocket } from "./hooks/useWebSocket";

function AppContent() {
  const { user } = useAuth();
  
  // Inicializar WebSocket para recibir actualizaciones de lotes en tiempo real
  useWebSocket();
  
  // Verificar si hay highlight en la URL al inicializar
  const urlParams = new URLSearchParams(window.location.search);
  const hasHighlight = urlParams.get('highlight') !== null;
  
  const [showSplash, setShowSplash] = useState(true); // Siempre mostrar splash al inicio
  const [showInstructions, setShowInstructions] = useState(!hasHighlight); // Solo ocultar instrucciones si hay highlight
  const [selectedLote, setSelectedLote] = useState(null);
  const [showLotInfoModal, setShowLotInfoModal] = useState(false);
  const [showPhotos360, setShowPhotos360] = useState(false);
  const [photos360Src, setPhotos360Src] = useState("");
  const [showAreasModal, setShowAreasModal] = useState(false);
  const [areasData, setAreasData] = useState(null);
  const [showAreasImage, setShowAreasImage] = useState(false);
  const [areasImageSrc, setAreasImageSrc] = useState("");
  const [showLotSearchModal, setShowLotSearchModal] = useState(false);
  const [showEntornoButtons, setShowEntornoButtons] = useState(false);
  const [showEntornoModal, setShowEntornoModal] = useState(false);
  const [entornoData, setEntornoData] = useState<any>(null);
  const [showVideoOverlay, setShowVideoOverlay] = useState(false);
  // Rastrear si LotSearchModal estaba abierto cuando se abrió LotInfoModal
  const [wasLotSearchModalOpen, setWasLotSearchModalOpen] = useState(false);


  // Handlers para eventos de Cesium
  const handleLoteSelected = useCallback(
    (event: CustomEvent) => {
      const loteData = event.detail;

      // Verificar si LotSearchModal está visible en el DOM (más confiable que el estado)
      const lotSearchModalElement = document.getElementById('lotSearchModalOverlay');
      const isSearchModalVisible = lotSearchModalElement && lotSearchModalElement.offsetParent !== null;
      
      // Guardar si LotSearchModal estaba abierto antes de abrir LotInfoModal
      setWasLotSearchModalOpen(isSearchModalVisible || showLotSearchModal);

      // Forzar re-renderizado cerrando y abriendo el modal
      setShowLotInfoModal(false);

      // Usar setTimeout para asegurar que el estado se actualice
      setTimeout(() => {
        setSelectedLote(loteData);
        setShowLotInfoModal(true);
      }, 10);
    },
    [showLotInfoModal, selectedLote, showLotSearchModal]
  );

  // Handler para actualizar el lote cuando llega un evento del WebSocket
  const handleLoteUpdated = useCallback(
    (event: CustomEvent) => {
      const updatedLoteData = event.detail;
      
      // Solo actualizar si el modal está abierto y es el mismo lote
      if (showLotInfoModal && selectedLote) {
        const currentId = (selectedLote as any)?.id;
        const updatedId = updatedLoteData?.id;
        const currentDireccion = (selectedLote as any)?.direccion;
        const updatedDireccion = updatedLoteData?.direccion;
        
        // Comparar por ID o por direccion para verificar que es el mismo lote
        const isSameLot = 
          (currentId && updatedId && String(currentId) === String(updatedId)) ||
          (currentDireccion && updatedDireccion && String(currentDireccion) === String(updatedDireccion));
        
        if (isSameLot) {
          console.log('[App] Actualizando lote en modal en tiempo real:', updatedLoteData);
          // Actualizar el estado del lote seleccionado con los nuevos datos
          setSelectedLote(updatedLoteData);
        }
      }
    },
    [showLotInfoModal, selectedLote]
  );

  const handleOpenPhotos360 = (event: CustomEvent) => {
    const { kuulaUrl } = event.detail;
    setPhotos360Src(kuulaUrl);
    setShowPhotos360(true);
  };

  const handleClosePhotos360 = () => {
    setShowPhotos360(false);
    setPhotos360Src("");
  };

  const handleOpenAreasModal = useCallback(
    (event: CustomEvent) => {
      const { areasData } = event.detail;

      // Forzar re-renderizado cerrando y abriendo
      setShowAreasModal(false);
      setAreasData(null);

      // Usar setTimeout para asegurar que el estado se actualice
      setTimeout(() => {
        setAreasData(areasData);
        setShowAreasModal(true);
      }, 10);
    },
    [showAreasModal]
  );

  const handleOpenAreasImage = (event: CustomEvent) => {
    const { imageUrl } = event.detail;
    setAreasImageSrc(imageUrl);
    setShowAreasImage(true);
  };

  const handleOpenLotSearchModal = useCallback(() => {
    // Forzar re-renderizado cerrando y abriendo
    setShowLotSearchModal(false);

    // Usar setTimeout para asegurar que el estado se actualice
    setTimeout(() => {
      setShowLotSearchModal(true);

      // Cargar datos de lotes cuando se abre el modal
      if (window.loadLotData) {
        window.loadLotData();
      }
    }, 10);
  }, [showLotSearchModal]);

  const handleOpenEntornoButtons = () => {
    setShowEntornoButtons(true);
  };

  const handleOpenEntornoModal = (event: CustomEvent) => {
    const { title, coordinates, tipo, imagen } = event.detail;
    setEntornoData({ title, coordinates, tipo, imagen });
    setShowEntornoModal(true);
  };

  const handleOpenVideoOverlay = () => {
    setShowVideoOverlay(true);
  };

  const handleCloseVideoOverlay = () => {
    // Primero ocultar el overlay
    setShowVideoOverlay(false);

    // Llamar a la función de JavaScript para desactivar el botón y reiniciar
    if (window.closeVideoOverlay) {
      window.closeVideoOverlay();
    }
  };

  // Handler para limpiar todo el estado cuando se hace click en un lote
  const handleClearAllModals = () => {
    setShowPhotos360(false);
    setShowAreasModal(false);
    setShowAreasImage(false);
    setShowLotSearchModal(false);
    setShowEntornoButtons(false);
    setShowEntornoModal(false);
    setShowVideoOverlay(false);
    setPhotos360Src("");
    setAreasImageSrc("");
    setEntornoData(null);
  };

  // Función para seleccionar un lote por ID desde la URL
  // Usa la misma lógica que el click handler existente
  const selectLotById = useCallback((lotId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // Máximo 30 segundos (60 * 500ms)
    
    const performSelection = () => {
      attempts++;
      
      // Verificar que las funciones necesarias estén disponibles
      if (!window.viewer || !window.getId || !window.selectLotByEntity) {
        if (attempts < maxAttempts) {
          setTimeout(performSelection, 500);
        }
        return;
      }

      try {
        // Obtener todas las entidades del datasource
        const datasource = window.viewer.dataSources.get(0);
        if (!datasource || !datasource.entities || datasource.entities.values.length === 0) {
          if (attempts < maxAttempts) {
            setTimeout(performSelection, 500);
          }
          return;
        }

        const allEntities = datasource.entities.values;
        
        // Buscar la entidad con el ID especificado
        const lotIdStr = String(lotId).trim();
        const lotEntity = allEntities.find((entity: any) => {
          if (!entity || !entity.polygon) return false;
          try {
            const entityId = window.getId!(entity);
            return entityId ? String(entityId).trim() === lotIdStr : false;
          } catch (e) {
            return false;
          }
        });

        if (lotEntity && window.selectLotByEntity) {
          // Usar la función existente que hace toda la lógica de selección
          // (limpiar menú, seleccionar polígono, cambiar material, disparar evento)
          window.selectLotByEntity(lotEntity);
        } else {
          // Si no se encuentra, seguir intentando
          if (attempts < maxAttempts) {
            setTimeout(performSelection, 500);
          }
        }
      } catch (error) {
        console.error('Error al seleccionar lote por ID:', error);
        if (attempts < maxAttempts) {
          setTimeout(performSelection, 500);
        }
      }
    };

    // Esperar el evento cesiumReady antes de intentar seleccionar
    const handleCesiumReady = () => {
      // Esperar un poco para asegurar que todo esté completamente cargado
      setTimeout(performSelection, 2000);
      window.removeEventListener('cesiumReady', handleCesiumReady);
    };
    
    if (window.viewer && window.getId && window.selectLotByEntity) {
      // Si ya está listo, empezar después de un delay
      setTimeout(performSelection, 2000);
    } else {
      // Si no está listo, esperar el evento
      window.addEventListener('cesiumReady', handleCesiumReady);
    }
  }, []);

  // Verificar parámetro highlight en la URL al cargar
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightId = urlParams.get('highlight');
    
    if (highlightId) {
      // La función selectLotById esperará el evento cesiumReady antes de seleccionar
      selectLotById(highlightId);
      
      // Limpiar el parámetro de la URL después de usarlo (con un delay para asegurar que se procese)
      setTimeout(() => {
        urlParams.delete('highlight');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, document.title, newUrl);
      }, 2000);
    }
  }, [selectLotById]);

  // Escuchar eventos de Cesium
  useEffect(() => {
    window.addEventListener(
      "loteSelected",
      handleLoteSelected as EventListener
    );

    window.addEventListener(
      "loteUpdated",
      handleLoteUpdated as EventListener
    );

    window.addEventListener(
      "openPhotos360",
      handleOpenPhotos360 as EventListener
    );
    window.addEventListener(
      "closePhotos360",
      handleClosePhotos360 as EventListener
    );
    window.addEventListener(
      "openAreasModal",
      handleOpenAreasModal as EventListener
    );
    window.addEventListener(
      "openAreasImage",
      handleOpenAreasImage as EventListener
    );
    window.addEventListener(
      "openLotSearchModal",
      handleOpenLotSearchModal as EventListener
    );
    window.addEventListener(
      "openEntornoButtons",
      handleOpenEntornoButtons as EventListener
    );
    window.addEventListener(
      "openEntornoModal",
      handleOpenEntornoModal as EventListener
    );
    window.addEventListener(
      "openVideoOverlay",
      handleOpenVideoOverlay as EventListener
    );
    window.addEventListener(
      "closeVideoOverlay",
      handleCloseVideoOverlay as EventListener
    );
    window.addEventListener(
      "clearAllModals",
      handleClearAllModals as EventListener
    );

    return () => {
      window.removeEventListener(
        "loteSelected",
        handleLoteSelected as EventListener
      );
      window.removeEventListener(
        "loteUpdated",
        handleLoteUpdated as EventListener
      );
      window.removeEventListener(
        "openPhotos360",
        handleOpenPhotos360 as EventListener
      );
      window.removeEventListener(
        "closePhotos360",
        handleClosePhotos360 as EventListener
      );
      window.removeEventListener(
        "openAreasModal",
        handleOpenAreasModal as EventListener
      );
      window.removeEventListener(
        "openAreasImage",
        handleOpenAreasImage as EventListener
      );
      window.removeEventListener(
        "openLotSearchModal",
        handleOpenLotSearchModal as EventListener
      );
      window.removeEventListener(
        "openEntornoButtons",
        handleOpenEntornoButtons as EventListener
      );
      window.removeEventListener(
        "openEntornoModal",
        handleOpenEntornoModal as EventListener
      );
      window.removeEventListener(
        "openVideoOverlay",
        handleOpenVideoOverlay as EventListener
      );
      window.removeEventListener(
        "closeVideoOverlay",
        handleCloseVideoOverlay as EventListener
      );
      window.removeEventListener(
        "clearAllModals",
        handleClearAllModals as EventListener
      );
    };
  }, [handleOpenAreasModal, handleOpenLotSearchModal, handleLoteSelected, handleLoteUpdated]);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  const handleInstructionsClose = () => {
    setShowInstructions(false);
  };

  const handleLotInfoModalClose = () => {
    setShowLotInfoModal(false);
    setSelectedLote(null);
    
    // Verificar si LotSearchModal estaba abierto cuando se abrió LotInfoModal
    // Usar el estado guardado Y verificar si el modal está visible en el DOM como respaldo
    const lotSearchModalElement = document.getElementById('lotSearchModalOverlay');
    const shouldReopenSearch = wasLotSearchModalOpen || (lotSearchModalElement && lotSearchModalElement.offsetParent !== null);
    
    if (shouldReopenSearch) {
      // Usar un pequeño delay para asegurar que el modal se cierre primero
      setTimeout(() => {
        // Activar el botón del sidebar y abrir el modal correctamente
        // handleLotes() activa el botón, vuela a la vista de lotes, y dispara el evento openLotSearchModal
        if (window.handleLotes) {
          window.handleLotes();
        } else {
          // Fallback: activar botón manualmente y abrir modal
          const lotesBtn = document.getElementById("lotes");
          if (lotesBtn) {
            lotesBtn.classList.add("active");
          }
          setShowLotSearchModal(true);
          // Cargar datos de lotes cuando se vuelve a abrir el modal
          if (window.loadLotData) {
            window.loadLotData();
          }
        }
      }, 150);
      setWasLotSearchModalOpen(false);
    } else {
      // Si no venimos de LotSearchModal, limpiar estado en Cesium
      if (window.reiniciarMenu) {
        window.reiniciarMenu();
      }
    }
  };

  const handlePhotos360Close = () => {
    setShowPhotos360(false);
    setPhotos360Src("");
    // También llamar a la función de Cesium para sincronizar
    if (window.closeOverlay360) {
      window.closeOverlay360();
    }
  };

  const handleAreasModalClose = () => {
    setShowAreasModal(false);
    setAreasData(null);
    // Limpiar estado en Cesium
    if (window.reiniciarMenu) {
      window.reiniciarMenu();
    }
  };

  const handleAreasImageClose = () => {
    setShowAreasImage(false);
    setAreasImageSrc("");
  };

  const handleLotSearchModalClose = () => {
    setShowLotSearchModal(false);
    // Resetear el flag cuando se cierra LotSearchModal
    setWasLotSearchModalOpen(false);
    // Limpiar estado en Cesium
    if (window.reiniciarMenu) {
      window.reiniciarMenu();
    }
  };

  const handleEntornoModalClose = () => {
    setShowEntornoModal(false);
    setEntornoData(null);
    // En lugar de cerrar todo, volver al estado inicial del entorno
    // Mantener los botones y marcadores visibles
    if (window.resetEntornoToInitialState) {
      window.resetEntornoToInitialState();
    }
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      {showInstructions && <Instructions onClose={handleInstructionsClose} />}
      <Sidebar />
      <BottomBar />
      {/* LotInfoModal always rendered but controlled by isVisible */}
      <LotInfoModal
        key={
          selectedLote ? (selectedLote as any).direccion || "lote" : "no-lote"
        } // Forzar re-renderizado cuando cambie el lote
        isVisible={showLotInfoModal}
        onClose={handleLotInfoModalClose}
        loteData={selectedLote}
        currentUser={user}
      />

      {showAreasModal && (
        <AreasModal
          isVisible={showAreasModal}
          onClose={handleAreasModalClose}
          areasData={areasData}
        />
      )}

      {showLotSearchModal && (
        <LotSearchModal
          isVisible={showLotSearchModal}
          onClose={handleLotSearchModalClose}
        />
      )}

      {showEntornoModal && (
        <EntornoModal
          isVisible={showEntornoModal}
          onClose={handleEntornoModalClose}
          entornoData={entornoData}
        />
      )}

      {showEntornoButtons && <EntornoButtons isVisible={showEntornoButtons} />}

      {showVideoOverlay && (
        <VideoOverlay
          isVisible={showVideoOverlay}
          onClose={handleCloseVideoOverlay}
        />
      )}

      {showAreasImage && (
        <ImageOverlay
          isVisible={showAreasImage}
          onClose={handleAreasImageClose}
          imageSrc={areasImageSrc}
          imageAlt="Área común"
        />
      )}

      {showPhotos360 && (
        <Photos360Overlay
          isVisible={showPhotos360}
          onClose={handlePhotos360Close}
          iframeSrc={
            photos360Src ||
            "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.9663095343008!2d-74.00425878459418!3d40.74844097932681!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b3117469%3A0xd134e199a405a163!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1625097602920!5m2!1sen!2sus"
          }
        />
      )}

      {/* Control de hora del día - siempre visible */}
      <TimeOfDayControl isVisible={false} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
