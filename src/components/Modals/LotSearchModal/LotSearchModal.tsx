import { useState, useEffect } from 'react';
import './LotSearchModal.css';

interface LotSearchModalProps {
  isVisible?: boolean;
  onClose?: () => void;
}

const DEFAULT_PRICE_BOUNDS = { min: 0, max: 100000 };
const DEFAULT_AREA_BOUNDS = { min: 90, max: 1000 };

const LotSearchModal = ({ isVisible = false, onClose }: LotSearchModalProps) => {
  const [priceMin, setPriceMin] = useState(DEFAULT_PRICE_BOUNDS.min);
  const [priceMax, setPriceMax] = useState(DEFAULT_PRICE_BOUNDS.max); // Valor inicial más alto
  const [areaMin, setAreaMin] = useState(DEFAULT_AREA_BOUNDS.min);
  const [areaMax, setAreaMax] = useState(DEFAULT_AREA_BOUNDS.max); // Valor inicial más alto
  const [priceBounds, setPriceBounds] = useState(DEFAULT_PRICE_BOUNDS);
  const [areaBounds, setAreaBounds] = useState(DEFAULT_AREA_BOUNDS);
  const [sortBy, setSortBy] = useState('area-asc');
  const [status, setStatus] = useState('disponible');
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

  // Obtener configuración de lotes cada vez que se abre el modal
  useEffect(() => {
    if (!isVisible) return;

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const projectId = import.meta.env.VITE_PROJECT_ID;
    if (!apiBaseUrl || !projectId) return;

    const controller = new AbortController();
    const fetchLotConfig = async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/lots/project/${projectId}/config`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          console.error('No se pudo obtener la configuración de lotes', response.status);
          return;
        }

        const json = await response.json();
        const config = json?.data;
        if (!config) return;

        console.info('[LotSearchModal] Configuración de lotes recibida:', {
          max_price: config.max_price,
          min_price: config.min_price,
          max_area: config.max_area,
          min_area: config.min_area,
        });

        const parseNumber = (value: unknown) => {
          if (typeof value === 'number') return value;
          if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? undefined : parsed;
          }
          return undefined;
        };

        const maxPriceFromConfig = parseNumber(config.max_price);
        const minPriceFromConfig = parseNumber(config.min_price);
        const maxAreaFromConfig = parseNumber(config.max_area);
        const minAreaFromConfig = parseNumber(config.min_area);

        const normalizedPriceBounds = {
          min: minPriceFromConfig !== undefined
            ? Math.max(0, Math.floor(minPriceFromConfig))
            : DEFAULT_PRICE_BOUNDS.min,
          max: maxPriceFromConfig !== undefined
            ? Math.max(0, Math.ceil(maxPriceFromConfig))
            : DEFAULT_PRICE_BOUNDS.max,
        };
        if (normalizedPriceBounds.min > normalizedPriceBounds.max) {
          normalizedPriceBounds.min = normalizedPriceBounds.max;
        }

        const normalizedAreaBounds = {
          min: minAreaFromConfig !== undefined
            ? Math.max(0, Math.floor(minAreaFromConfig))
            : DEFAULT_AREA_BOUNDS.min,
          max: maxAreaFromConfig !== undefined
            ? Math.max(0, Math.ceil(maxAreaFromConfig))
            : DEFAULT_AREA_BOUNDS.max,
        };
        if (normalizedAreaBounds.min > normalizedAreaBounds.max) {
          normalizedAreaBounds.min = normalizedAreaBounds.max;
        }

        setPriceBounds(normalizedPriceBounds);
        setAreaBounds(normalizedAreaBounds);
        setPriceMin(normalizedPriceBounds.min);
        setPriceMax(normalizedPriceBounds.max);
        setAreaMin(normalizedAreaBounds.min);
        setAreaMax(normalizedAreaBounds.max);

        if (window.setLotRangeConfig) {
          window.setLotRangeConfig({
            maxPrice: normalizedPriceBounds.max,
            minPrice: normalizedPriceBounds.min,
            maxArea: normalizedAreaBounds.max,
            minArea: normalizedAreaBounds.min,
          });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('No se pudo obtener la configuración de lotes', error);
      }
    };

    fetchLotConfig();
    return () => controller.abort();
  }, [isVisible]);

  // Función para actualizar la barra visual del slider
  const clampToBounds = (value: number, bounds: { min: number; max: number }) => {
    if (Number.isNaN(value)) return bounds.min;
    return Math.max(bounds.min, Math.min(value, bounds.max));
  };

  const updateRangeSlider = (
    minInput: number,
    maxInput: number,
    minOutput: string,
    maxOutput: string,
    inclRange: string,
    formatValue: (value: number) => string,
    rangeBounds: { min: number; max: number }
  ) => {
    const minValue = minInput;
    const maxValue = maxInput;
    
    const minRange = rangeBounds?.min ?? 0;
    const maxRangeRaw = rangeBounds?.max ?? minRange + 1;
    const maxRange = maxRangeRaw > minRange ? maxRangeRaw : minRange + 1;
    const rangeSpan = maxRange - minRange;

    // Actualizar outputs (solo contenido, no posición)
    const minOutputEl = document.querySelector(minOutput);
    const maxOutputEl = document.querySelector(maxOutput);
    if (minOutputEl) minOutputEl.innerHTML = formatValue(minValue);
    if (maxOutputEl) maxOutputEl.innerHTML = formatValue(maxValue);

    // Actualizar rango incluido
    const inclRangeEl = document.querySelector(inclRange) as HTMLElement;
    if (inclRangeEl) {
      const effectiveMin = Math.min(minValue, maxValue);
      const effectiveMax = Math.max(minValue, maxValue);
      inclRangeEl.style.width = ((effectiveMax - effectiveMin) / rangeSpan) * 100 + "%";
      inclRangeEl.style.left = ((effectiveMin - minRange) / rangeSpan) * 100 + "%";
    }
  };

  // Efecto para actualizar los sliders cuando cambien los valores máximos
  useEffect(() => {
    if (isVisible && window.loadLotData) {
      // Pequeño delay para asegurar que los sliders estén renderizados
      setTimeout(() => {
        window.loadLotData();
      }, 100);
    }
  }, [isVisible, priceMax, areaMax]);

  // Efecto para actualizar las barras visuales cuando cambien los valores
  useEffect(() => {
    if (isVisible) {
      // Actualizar barra de precio
      updateRangeSlider(
        priceMin,
        priceMax,
        ".price-output-min",
        ".price-output-max",
        ".price-range-slider .incl-range",
        (value) => `$${parseInt(value.toString()).toLocaleString()}`,
        priceBounds
      );

      // Actualizar barra de área
      updateRangeSlider(
        areaMin,
        areaMax,
        ".area-output-min",
        ".area-output-max",
        ".area-range-slider .incl-range",
        (value) => `${parseInt(value.toString())} m²`,
        areaBounds
      );
    }
  }, [isVisible, priceMin, priceMax, areaMin, areaMax, priceBounds, areaBounds]);

  const handleClose = () => {
    onClose?.();
  };

  const handleClearFilters = () => {
    // Usar valores mínimos reales si están disponibles
    const minPrice = priceBounds.min;
    const minArea = areaBounds.min;
    const maxPrice = priceBounds.max;
    const maxArea = areaBounds.max;
    
    setPriceMin(minPrice);
    setPriceMax(maxPrice);
    setAreaMin(Math.ceil(minArea));
    setAreaMax(Math.ceil(maxArea));
    setSortBy('area-asc');
    setStatus('disponible');
    
    // Llamar a la función de Cesium para actualizar los datos
    if (window.loadLotData) {
      window.loadLotData();
    }
  };

  const handlePriceMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseInt(e.target.value);
    const value = clampToBounds(rawValue, priceBounds);
    setPriceMin(value);
    // Actualizar barra visual inmediatamente
    updateRangeSlider(
      value,
      priceMax,
      ".price-output-min",
      ".price-output-max",
      ".price-range-slider .incl-range",
      (val) => `$${parseInt(val.toString()).toLocaleString()}`,
      priceBounds
    );
    // Llamar a la función de Cesium para actualizar los datos
    if (window.loadLotData) {
      window.loadLotData();
    }
  };

  const handlePriceMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseInt(e.target.value);
    const value = clampToBounds(rawValue, priceBounds);
    setPriceMax(value);
    // Actualizar barra visual inmediatamente
    updateRangeSlider(
      priceMin,
      value,
      ".price-output-min",
      ".price-output-max",
      ".price-range-slider .incl-range",
      (val) => `$${parseInt(val.toString()).toLocaleString()}`,
      priceBounds
    );
    // Llamar a la función de Cesium para actualizar los datos
    if (window.loadLotData) {
      window.loadLotData();
    }
  };

  const handleAreaMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseInt(e.target.value);
    const value = clampToBounds(rawValue, areaBounds);
    setAreaMin(value);
    // Actualizar barra visual inmediatamente
    updateRangeSlider(
      value,
      areaMax,
      ".area-output-min",
      ".area-output-max",
      ".area-range-slider .incl-range",
      (val) => `${parseInt(val.toString())} m²`,
      areaBounds
    );
    // Llamar a la función de Cesium para actualizar los datos
    if (window.loadLotData) {
      window.loadLotData();
    }
  };

  const handleAreaMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseInt(e.target.value);
    const value = clampToBounds(rawValue, areaBounds);
    setAreaMax(value);
    // Actualizar barra visual inmediatamente
    updateRangeSlider(
      areaMin,
      value,
      ".area-output-min",
      ".area-output-max",
      ".area-range-slider .incl-range",
      (val) => `${parseInt(val.toString())} m²`,
      areaBounds
    );
    // Llamar a la función de Cesium para actualizar los datos
    if (window.loadLotData) {
      window.loadLotData();
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    
    // Forzar re-render inmediato de los botones
    setTimeout(() => {
      // Llamar a la función de Cesium para actualizar los datos
      if (window.loadLotData) {
        window.loadLotData();
      }
    }, 0);
  };

  // No renderizar si no es visible
  if (!isVisible) return null;

  return (
    <div className={`lot-search-modal background-container border-container ${isMobile ? 'mobile-modal' : ''}`} id="lotSearchModalOverlay">
      <button className="close-btn" id="closeLotSearchModal" onClick={handleClose}>
        <i className="fas fa-times"></i>
      </button>
      
      <div className="lot-search-header">
        <div className="lot-search-title">
          <img src="/images/sidebar/lotes/busqueda_lotes.svg" alt="Búsqueda de lotes" className="lot-search-icon" />
          <span>Búsqueda de lotes</span>
        </div>
      </div>

      <div className="lot-search-content">
        <div className="filters-container">
          <div className="filter-section">
            <label className="filter-label">Precio</label>
            <div className="range-slider-container">
              <div className="range-slider price-range-slider">
                <span className="output outputOne price-output-min">{priceMin.toLocaleString()}</span>
                <span className="output outputTwo price-output-max">{priceMax.toLocaleString()}</span>
                <span className="full-range"></span>
                <span className="incl-range"></span>
                <input 
                  name="priceMin" 
                  value={priceMin} 
                  min={priceBounds.min} 
                  max={priceBounds.max} 
                  step="1000" 
                  type="range"
                  onChange={handlePriceMinChange}
                />
                <input 
                  name="priceMax" 
                  value={priceMax} 
                  min={priceBounds.min} 
                  max={priceBounds.max} 
                  step="1000" 
                  type="range"
                  onChange={handlePriceMaxChange}
                />
              </div>
            </div>
          </div>
          
          <div className="filter-section">
            <label className="filter-label">Área</label>
            <div className="range-slider-container">
              <div className="range-slider area-range-slider">
                <span className="output outputOne area-output-min">{areaMin}</span>
                <span className="output outputTwo area-output-max">{areaMax}</span>
                <span className="full-range"></span>
                <span className="incl-range"></span>
                <input 
                  name="areaMin" 
                  value={areaMin} 
                  min={areaBounds.min} 
                  max={areaBounds.max} 
                  step="1" 
                  type="range"
                  onChange={handleAreaMinChange}
                />
                <input 
                  name="areaMax" 
                  value={areaMax} 
                  min={areaBounds.min} 
                  max={areaBounds.max} 
                  step="1" 
                  type="range"
                  onChange={handleAreaMaxChange}
                />
              </div>
            </div>
          </div>
          
          <div className="clear-filters-container">
            <button className="clear-filters" id="clearFiltersBtn" onClick={handleClearFilters}>
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="filters-secondary">
          <div className="filter-section">
            <label className="filter-label">Ordenar por</label>
            <div className="dropdown-container">
              <select 
                id="sortSelect" 
                className="sort-dropdown"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  // Llamar a la función de Cesium para actualizar los datos
                  if (window.loadLotData) {
                    window.loadLotData();
                  }
                }}
              >
                <option value="area-asc">Área: de menor a mayor</option>
                <option value="area-desc">Área: de mayor a menor</option>
                <option value="price-asc">Precio: de menor a mayor</option>
                <option value="price-desc">Precio: de mayor a menor</option>
                <option value="number-asc">Número: de menor a mayor</option>
                <option value="number-desc">Número: de mayor a menor</option>
              </select>
            </div>
          </div>
          
          <div className="filter-section">
            <label className="filter-label">Estado</label>
            <div className="status-buttons" key={`status-buttons-${status}`}>
              <button 
                className={`status-btn vendido ${status === 'vendido' ? 'active' : ''}`}
                data-status="vendido"
                onClick={() => handleStatusChange('vendido')}
                key={`vendido-${status}`}
              >
                Vendido
              </button>
              <button 
                className={`status-btn reservado ${status === 'reservado' ? 'active' : ''}`}
                data-status="reservado"
                onClick={() => handleStatusChange('reservado')}
                key={`reservado-${status}`}
              >
                Reservado
              </button>
              <button 
                className={`status-btn negociacion ${status === 'negociacion' ? 'active' : ''}`}
                data-status="negociacion"
                onClick={() => handleStatusChange('negociacion')}
                key={`negociacion-${status}`}
              >
                Negociación
              </button>
              <button 
                className={`status-btn disponible ${status === 'disponible' ? 'active' : ''}`}
                data-status="disponible"
                onClick={() => handleStatusChange('disponible')}
                key={`disponible-${status}`}
              >
                Disponible
              </button>
            </div>
          </div>
        </div>

        <div className="results-section">
          <div className="results-count" id="resultsCount">Mostrando (0) lotes</div>
          <div className="lot-cards-container" id="lotCardsContainer">
          </div>
        </div>
      </div>
    </div>
  );
};

export default LotSearchModal;
