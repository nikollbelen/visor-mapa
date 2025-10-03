import { useEffect, useState } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete?: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Ocultar splash screen después de 2 segundos
    const timer = setTimeout(() => {
      setIsFading(true);
      
      // Remover del DOM después de la animación
      setTimeout(() => {
        setIsVisible(false);
        onComplete?.(); // Notificar que el splash screen terminó
      }, 800);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  // No renderizar si no es visible
  if (!isVisible) return null;

  return (
    <div 
      className={`splash-screen ${isFading ? 'fade-out' : ''}`}
      id="splash-screen"
    >
      <img 
        src="/images/init/init-logo.svg" 
        alt="Mykonos Residencial Playa logo"
        className="splash-logo"
      />
    </div>
  );
};

export default SplashScreen;
