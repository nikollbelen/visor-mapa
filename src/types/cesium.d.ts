export {};

declare global {
  interface Window {
    Cesium: any;
    getMaxPrice: () => number;
    getMaxArea: () => number;
    getMinPrice: () => number;
    getMinArea: () => number;
    setLotRangeConfig?: (config: {
      maxPrice?: number | string;
      minPrice?: number | string;
      maxArea?: number | string;
      minArea?: number | string;
    }) => void;
    hoverMarcadores: () => void;
    clearRoute: () => void;
    flyToView: (positions: any[]) => void;
    reiniciarMenu: () => void;
    handleFotos: () => void;
    handleAreasComunes: () => void;
    handleLotes: () => void;
    handleEntorno: () => void;
    handleVideo: () => void;
    clickMarcadores360: () => void;
    openOverlay360: (kuulaUrl: string) => void;
    closeOverlay360: () => void;
    reiniciarMenu: () => void;
    populateAreasModal: (areasData: any) => void;
    openAreasComunesImage: (imageUrl: string) => void;
    flyToAreaComun: (fid: number) => void;
    loadLotData: () => void;
    applyFilters: (lots: any[]) => any[];
    applySorting: (lots: any[]) => any[];
    renderLotCards: (lots: any[]) => void;
    filterEntornoByType: (tipo: string) => void;
    loadEntornoMarkers: (filterType?: string) => void;
    clickMarcadoresAround: () => void;
    showLocationModal: (
      title: string,
      coordinates: any,
      tipo?: string,
      imagen?: string
    ) => void;
    calculateRoute: (
      token: string,
      start: number[],
      end: number[],
      tipo?: string
    ) => Promise<any>;
    updateEntornoButtonsState: (activeType: string) => void;
    resetEntornoToInitialState: () => void;
    closeVideoOverlay: () => void;
    moveCameraUp: () => void;
    moveCameraDown: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    goHome: () => void;
    view3D: () => void;
    toggleGrid: () => void;
    loteClickHandler?: any;
    setTimeOfDay?: (hour: number) => void;
    viewer?: any;
    getId?: (entity: any) => string | undefined;
    getDireccion?: (entity: any) => string | undefined;
    getArea?: (entity: any) => number | undefined;
    getPrecio?: (entity: any) => number | undefined;
    getEstado?: (entity: any) => string | undefined;
    getColindancias?: (entity: any) => { left: string; right: string; front: string; back: string };
    getPhase?: (entity: any) => string | undefined;
    selectLotByEntity?: (entity: any) => void;
    updateLotFromWebSocket?: (lotData: {
      id: string;
      phase: string;
      block: string;
      lot: string;
      area: number;
      price: number;
      state: string;
      fid: string;
      project_id: string;
      created_at: string;
      updated_at: string;
      is_active: boolean;
    }) => void;
  }
}
