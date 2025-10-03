// import { useState } from 'react';
import './Photos360Overlay.css';

interface Photos360OverlayProps {
  isVisible?: boolean;
  onClose?: () => void;
  iframeSrc?: string;
}

const Photos360Overlay = ({ 
  isVisible = false, 
  onClose,
  iframeSrc = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.9663095343008!2d-74.00425878459418!3d40.74844097932681!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b3117469%3A0xd134e199a405a163!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1625097602920!5m2!1sen!2sus'
}: Photos360OverlayProps) => {
  const handleClose = () => {
    onClose?.();
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
      className={`overlay-360-background ${isVisible ? 'show' : ''}`}
      id="overlay360"
      onClick={handleOverlayClick}
      style={{ display: isVisible ? 'flex' : 'none' }}
    >
      <div className="overlay-360">
        <button 
          className="close-btn" 
          id="overlay-360-close-btn"
          onClick={handleClose}
        >
          <i className="fas fa-times"></i>
        </button>
        <div className="overlay-360-content">
          <iframe 
            id="overlay360Iframe" 
            src={iframeSrc}
            frameBorder="0" 
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; xr-spatial-tracking"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      </div>
    </div>
  );
};

export default Photos360Overlay;
