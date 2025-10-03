import { useState, useEffect } from 'react';
import './LotSearchModal.css';

interface LotSearchModalProps {
  isVisible?: boolean;
  onClose?: () => void;
}

const LotSearchModal = ({ isVisible = false, onClose }: LotSearchModalProps) => {
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(100000); // Valor inicial más alto
  const [areaMin, setAreaMin] = useState(90);
  const [areaMax, setAreaMax] = useState(1000); // Valor inicial más alto
  const [sortBy, setSortBy] = useState('area-asc');
  const [status, setStatus] = useState('disponible');

  // Actualizar valores máximos y mínimos cuando se abre el modal
  useEffect(() => {
    if (isVisible && window.getMaxPrice && window.getMaxArea && window.getMinPrice && window.getMinArea) {
      const maxPrice = window.getMaxPrice();
      const maxArea = window.getMaxArea();
      const minPrice = window.getMinPrice();
      const minArea = window.getMinArea();
      
      if (maxPrice > 0) {
        setPriceMax(maxPrice);
      }
      if (maxArea > 0) {
        setAreaMax(Math.ceil(maxArea));
      }
      if (minPrice > 0) {
        setPriceMin(minPrice);
      }
      if (minArea > 0) {
        setAreaMin(Math.ceil(minArea));
      }
    }
  }, [isVisible]);

  // Función para actualizar la barra visual del slider
  const updateRangeSlider = (
    minInput: number,
    maxInput: number,
    minOutput: string,
    maxOutput: string,
    inclRange: string,
    formatValue: (value: number) => string,
    isPrice: boolean = false
  ) => {
    const minValue = minInput;
    const maxValue = maxInput;
    
    // Usar valores máximos reales si están disponibles
    let maxRange: number;
    let minRange: number;
    
    if (isPrice) {
      maxRange = window.getMaxPrice ? window.getMaxPrice() : 100000;
      minRange = 0; // Valor fijo para que funcione correctamente
    } else {
      maxRange = window.getMaxArea ? window.getMaxArea() : 1000;
      minRange = 90; // Valor fijo para que funcione correctamente
    }

    // Actualizar outputs (solo contenido, no posición)
    const minOutputEl = document.querySelector(minOutput);
    const maxOutputEl = document.querySelector(maxOutput);
    if (minOutputEl) minOutputEl.innerHTML = formatValue(minValue);
    if (maxOutputEl) maxOutputEl.innerHTML = formatValue(maxValue);

    // Actualizar rango incluido
    const inclRangeEl = document.querySelector(inclRange) as HTMLElement;
    if (inclRangeEl) {
      if (minValue > maxValue) {
        inclRangeEl.style.width = ((minValue - maxValue) / (maxRange - minRange)) * 100 + "%";
        inclRangeEl.style.left = ((maxValue - minRange) / (maxRange - minRange)) * 100 + "%";
      } else {
        inclRangeEl.style.width = ((maxValue - minValue) / (maxRange - minRange)) * 100 + "%";
        inclRangeEl.style.left = ((minValue - minRange) / (maxRange - minRange)) * 100 + "%";
      }
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
        true // isPrice = true
      );

      // Actualizar barra de área
      updateRangeSlider(
        areaMin,
        areaMax,
        ".area-output-min",
        ".area-output-max",
        ".area-range-slider .incl-range",
        (value) => `${parseInt(value.toString())} m²`,
        false // isPrice = false
      );
    }
  }, [isVisible, priceMin, priceMax, areaMin, areaMax]);

  const handleClose = () => {
    onClose?.();
  };

  const handleClearFilters = () => {
    // Usar valores mínimos reales si están disponibles
    const minPrice = window.getMinPrice ? window.getMinPrice() : 0;
    const minArea = window.getMinArea ? window.getMinArea() : 90;
    const maxPrice = window.getMaxPrice ? window.getMaxPrice() : 100000;
    const maxArea = window.getMaxArea ? window.getMaxArea() : 1000;
    
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
    const value = parseInt(e.target.value);
    setPriceMin(value);
    // Actualizar barra visual inmediatamente
    updateRangeSlider(
      value,
      priceMax,
      ".price-output-min",
      ".price-output-max",
      ".price-range-slider .incl-range",
      (val) => `$${parseInt(val.toString()).toLocaleString()}`,
      true // isPrice = true
    );
    // Llamar a la función de Cesium para actualizar los datos
    if (window.loadLotData) {
      window.loadLotData();
    }
  };

  const handlePriceMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setPriceMax(value);
    // Actualizar barra visual inmediatamente
    updateRangeSlider(
      priceMin,
      value,
      ".price-output-min",
      ".price-output-max",
      ".price-range-slider .incl-range",
      (val) => `$${parseInt(val.toString()).toLocaleString()}`,
      true // isPrice = true
    );
    // Llamar a la función de Cesium para actualizar los datos
    if (window.loadLotData) {
      window.loadLotData();
    }
  };

  const handleAreaMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setAreaMin(value);
    // Actualizar barra visual inmediatamente
    updateRangeSlider(
      value,
      areaMax,
      ".area-output-min",
      ".area-output-max",
      ".area-range-slider .incl-range",
      (val) => `${parseInt(val.toString())} m²`,
      false // isPrice = false
    );
    // Llamar a la función de Cesium para actualizar los datos
    if (window.loadLotData) {
      window.loadLotData();
    }
  };

  const handleAreaMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setAreaMax(value);
    // Actualizar barra visual inmediatamente
    updateRangeSlider(
      areaMin,
      value,
      ".area-output-min",
      ".area-output-max",
      ".area-range-slider .incl-range",
      (val) => `${parseInt(val.toString())} m²`,
      false // isPrice = false
    );
    // Llamar a la función de Cesium para actualizar los datos
    if (window.loadLotData) {
      window.loadLotData();
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    // Llamar a la función de Cesium para actualizar los datos
    if (window.loadLotData) {
      window.loadLotData();
    }
  };

  // No renderizar si no es visible
  if (!isVisible) return null;

  return (
    <div className="lot-search-modal background-container border-container" id="lotSearchModalOverlay">
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
                  min="0" 
                  max={window.getMaxPrice ? window.getMaxPrice() : 100000} 
                  step="1000" 
                  type="range"
                  onChange={handlePriceMinChange}
                />
                <input 
                  name="priceMax" 
                  value={priceMax} 
                  min="0" 
                  max={window.getMaxPrice ? window.getMaxPrice() : 100000} 
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
                  min="90" 
                  max={window.getMaxArea ? window.getMaxArea() : 1000} 
                  step="1" 
                  type="range"
                  onChange={handleAreaMinChange}
                />
                <input 
                  name="areaMax" 
                  value={areaMax} 
                  min="90" 
                  max={window.getMaxArea ? window.getMaxArea() : 1000} 
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
            <div className="status-buttons">
              <button 
                className={`status-btn ${status === 'vendido' ? 'active' : ''}`}
                data-status="vendido"
                onClick={() => handleStatusChange('vendido')}
              >
                Vendido
              </button>
              <button 
                className={`status-btn ${status === 'reservado' ? 'active' : ''}`}
                data-status="reservado"
                onClick={() => handleStatusChange('reservado')}
              >
                Reservado
              </button>
              <button 
                className={`status-btn ${status === 'disponible' ? 'active' : ''}`}
                data-status="disponible"
                onClick={() => handleStatusChange('disponible')}
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
