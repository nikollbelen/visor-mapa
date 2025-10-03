import { useState } from 'react';
import Button from './Button';

interface Location {
  lon: number;
  lat: number;
  height: number;
  name: string;
}

const LOCATIONS: Record<string, Location> = {
  peru: { lon: -77.0428, lat: -12.0464, height: 5000000, name: 'Lima, Perú' },
  paris: { lon: 2.3522, lat: 48.8566, height: 5000000, name: 'París, Francia' },
  tokyo: { lon: 139.6917, lat: 35.6895, height: 5000000, name: 'Tokio, Japón' },
  nyc: { lon: -74.0060, lat: 40.7128, height: 5000000, name: 'Nueva York, USA' },
};

export default function ControlPanel() {
  const [activeLocation, setActiveLocation] = useState('peru');

  return (
    <div className="h-full flex items-center px-5">
      <div className="w-full max-w-6xl mx-auto">
        <h3 className="text-white text-sm font-semibold mb-3">
          🌍 Volar a ubicación:
        </h3>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(LOCATIONS).map(([key, location]) => (
            <Button
              key={key}
              location={location}
              isActive={activeLocation === key}
              onClick={() => setActiveLocation(key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}