interface ButtonProps {
    location: {
      lon: number;
      lat: number;
      height: number;
      name: string;
    };
    isActive: boolean;
    onClick: () => void;
  }
  
  export default function Button({ location, isActive, onClick }: ButtonProps) {
    const handleClick = () => {
      // Llamar a la función global de Cesium
      if (window.flyToLocation) {
        window.flyToLocation(
          location.lon,
          location.lat,
          location.height,
          location.name
        );
      }
      onClick();
    };
  
    return (
      <button
        onClick={handleClick}
        className={`px-5 py-3 rounded-lg font-medium transition-all ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        {location.name}
      </button>
    );
  }