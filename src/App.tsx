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

function AppContent() {
  const { user } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
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


  // Handlers para eventos de Cesium
  const handleLoteSelected = useCallback(
    (event: CustomEvent) => {
      const loteData = event.detail;

      // Forzar re-renderizado cerrando y abriendo el modal
      setShowLotInfoModal(false);

      // Usar setTimeout para asegurar que el estado se actualice
      setTimeout(() => {
        setSelectedLote(loteData);
        setShowLotInfoModal(true);
      }, 10);
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

  // Escuchar eventos de Cesium
  useEffect(() => {
    window.addEventListener(
      "loteSelected",
      handleLoteSelected as EventListener
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
  }, [handleOpenAreasModal, handleOpenLotSearchModal, handleLoteSelected]);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  const handleInstructionsClose = () => {
    setShowInstructions(false);
  };

  const handleLotInfoModalClose = () => {
    setShowLotInfoModal(false);
    // Limpiar estado en Cesium
    if (window.reiniciarMenu) {
      window.reiniciarMenu();
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
