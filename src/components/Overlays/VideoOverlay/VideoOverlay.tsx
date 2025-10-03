import { useRef, useEffect } from 'react'; // useState not used
import './VideoOverlay.css';

interface VideoOverlayProps {
  isVisible?: boolean;
  onClose?: () => void;
  videoSrc?: string;
  videoType?: string;
}

const VideoOverlay = ({ 
  isVisible = false, 
  onClose,
  videoSrc = '/images/sidebar/video/video.mp4',
  videoType = 'video/mp4'
}: VideoOverlayProps) => {
  // const [isAnimating, setIsAnimating] = useState(false); // Not used
  const videoRef = useRef<HTMLVideoElement>(null);

  // Efecto para manejar la reproducción del video
  useEffect(() => {
    if (isVisible && videoRef.current) {
      // Resetear el video al inicio
      videoRef.current.currentTime = 0;
      
      // Reproducir después de un pequeño delay
      const timer = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch(console.error);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    } else if (!isVisible && videoRef.current) {
      // Pausar el video cuando se oculta
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isVisible]);

  const handleClose = () => {
    
    // Pausar el video inmediatamente
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    // Cerrar después de la animación
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
      className={`video-overlay-background ${isVisible ? 'show' : ''}`}
      id="videoModalOverlay"
      onClick={handleOverlayClick}
    >
      <div className="video-overlay">
        <button 
          className="close-btn" 
          id="closeVideoModal"
          onClick={handleClose}
        >
          <i className="fas fa-times"></i>
        </button>
        <video 
          ref={videoRef}
          id="videoPlayer" 
          controls
        >
          <source src={videoSrc} type={videoType} />
          Tu navegador no soporta el elemento de video.
        </video>
      </div>
    </div>
  );
};

export default VideoOverlay;
