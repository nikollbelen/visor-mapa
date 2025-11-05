import { useState, useEffect } from 'react';
import './TimeOfDayControl.css';

interface TimeOfDayControlProps {
  isVisible?: boolean;
}

const TimeOfDayControl = ({ isVisible = false }: TimeOfDayControlProps) => {
  const [timeOfDay, setTimeOfDay] = useState(12); // Hora inicial: 12:00 (mediodía)
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Estado para controlar si está expandido

  // Detectar si es móvil o tablet
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Formatear hora para mostrar
  const formatTime = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.floor((hour - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Obtener etiqueta descriptiva de la hora
  const getTimeLabel = (hour: number) => {
    if (hour >= 5 && hour < 7) return 'Amanecer';
    if (hour >= 7 && hour < 12) return 'Mañana';
    if (hour >= 12 && hour < 14) return 'Mediodía';
    if (hour >= 14 && hour < 18) return 'Tarde';
    if (hour >= 18 && hour < 20) return 'Atardecer';
    if (hour >= 20 || hour < 5) return 'Noche';
    return '';
  };

  // Manejar cambio de hora
  const handleTimeChange = (newTime: number) => {
    setTimeOfDay(newTime);
    // Llamar a la función global de Cesium para actualizar la hora del día
    if (window.setTimeOfDay) {
      window.setTimeOfDay(newTime);
    }
  };

  // Presets de hora del día
  const timePresets = [
    { label: 'Amanecer', hour: 6 },
    { label: 'Mediodía', hour: 12 },
    { label: 'Atardecer', hour: 18 },
    { label: 'Noche', hour: 22 }
  ];

  if (!isVisible) return null;

  // Si no está expandido, mostrar solo el botón del sol
  if (!isExpanded) {
    return (
      <button
        className="time-of-day-toggle-btn"
        onClick={() => setIsExpanded(true)}
        aria-label="Mostrar control de hora del día"
      >
        <span className="sun-icon">☀️</span>
      </button>
    );
  }

  // Si está expandido, mostrar el panel completo
  return (
    <div className={`time-of-day-control ${isMobile ? 'mobile' : ''}`}>
      <div className="time-of-day-header">
        <span className="time-of-day-icon">☀️</span>
        <span className="time-of-day-title">Hora del Día</span>
        <button
          className="time-of-day-close-btn"
          onClick={() => setIsExpanded(false)}
          aria-label="Cerrar control de hora del día"
        >
          ✕
        </button>
      </div>
      
      <div className="time-of-day-display">
        <div className="time-value">{formatTime(timeOfDay)}</div>
        <div className="time-label">{getTimeLabel(timeOfDay)}</div>
      </div>

      <div className="time-of-day-slider-container">
        <input
          type="range"
          min="0"
          max="24"
          step="0.1"
          value={timeOfDay}
          onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
          className="time-of-day-slider"
        />
        <div className="slider-labels">
          <span>00:00</span>
          <span>12:00</span>
          <span>24:00</span>
        </div>
      </div>

      <div className="time-presets">
        {timePresets.map((preset) => (
          <button
            key={preset.label}
            className={`preset-btn ${Math.abs(timeOfDay - preset.hour) < 0.5 ? 'active' : ''}`}
            onClick={() => handleTimeChange(preset.hour)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeOfDayControl;

