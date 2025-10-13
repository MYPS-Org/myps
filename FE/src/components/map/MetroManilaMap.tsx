import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MetroManilaMapProps {
  projectLocation?: {
    lat: number;
    lng: number;
    name?: string;
  };
  height?: string;
}

const MetroManilaMap: React.FC<MetroManilaMapProps> = ({ 
  projectLocation, 
  height = "300px" 
}) => {
  // Metro Manila center coordinates
  const metroManilaCenter: [number, number] = [14.6091, 121.0223];
  
  // Sample project location (you can replace this with actual project coordinates)
  const defaultProjectLocation = {
    lat: 14.5995,
    lng: 120.9842,
    name: "Sample Project Location"
  };

  const currentLocation = projectLocation || defaultProjectLocation;

  return (
    <div style={{ height, width: '100%' }}>
      <MapContainer
        center={metroManilaCenter}
        zoom={11}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Project location marker */}
        <Marker position={[currentLocation.lat, currentLocation.lng]}>
          <Popup>
            <div>
              <strong>{currentLocation.name || "Project Location"}</strong>
              <br />
              Coordinates: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </div>
          </Popup>
        </Marker>
        
        {/* You can add more markers for Metro Manila landmarks */}
        <Marker position={[14.5995, 120.9842]}>
          <Popup>Manila City Hall</Popup>
        </Marker>
        
        <Marker position={[14.6760, 121.0437]}>
          <Popup>Quezon City Hall</Popup>
        </Marker>
        
        <Marker position={[14.5547, 121.0244]}>
          <Popup>Makati City Hall</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

export default MetroManilaMap;
