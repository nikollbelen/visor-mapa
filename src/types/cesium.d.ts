export {};

declare global {
  interface Window {
    Cesium: any;
    OPEN_ROUTE_SERVICE_KEY?: string;
    initCesiumWithToken: (token: string) => void;
    flyToLocation: (
      lon: number,
      lat: number,
      height: number,
      name: string
    ) => void;
    cesiumClearSelection: () => void;
    setTerrenosAlpha: (alpha: number) => void;
    getProcessedLots: () => any[];
  getMaxPrice: () => number;
  getMaxArea: () => number;
  getMinPrice: () => number;
  getMinArea: () => number;
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
  showLocationModal: (title: string, coordinates: any, tipo?: string, imagen?: string) => void;
  calculateRoute: (start: number[], end: number[], tipo?: string) => Promise<any>;
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
  }
}