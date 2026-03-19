import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Deck } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
// import type { MapboxOverlay } from '@deck.gl/mapbox';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapRendererProps {
  geoJsonData?: GeoJSON.FeatureCollection | null;
  height?: string;
  projectId?: string;
  programId?: string;
}

const MapRenderer: React.FC<MapRendererProps> = ({ 
  geoJsonData,
  height = '400px',
//   projectId,
//   programId
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const deckRef = useRef<Deck | null>(null);
  const deckCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize MapLibre map with basic/minimal style
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'carto-light': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#f8f8f8'
            }
          },
          {
            id: 'carto-light',
            type: 'raster',
            source: 'carto-light',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: [121.0223, 14.6091], // Metro Manila center (lng, lat)
      zoom: 11,
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Handle resize and fullscreen events
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
      if (deckRef.current && deckCanvasRef.current && mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        deckCanvasRef.current.width = rect.width;
        deckCanvasRef.current.height = rect.height;
        deckRef.current.setProps({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    map.on('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    window.addEventListener('resize', handleResize);

    mapRef.current = map;

    // Cleanup on unmount
    return () => {
      document.removeEventListener('fullscreenchange', handleResize);
      window.removeEventListener('resize', handleResize);
      if (deckRef.current) {
        deckRef.current.finalize();
        deckRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !geoJsonData) return;

    try {
      setIsLoading(true);
      setError(null);

      // Calculate bounds and centroid from GeoJSON features
      const bounds = new maplibregl.LngLatBounds();
      let totalLng = 0;
      let totalLat = 0;
      let pointCount = 0;
      
      geoJsonData.features.forEach((feature) => {
        if (feature.geometry.type === 'LineString') {
          feature.geometry.coordinates.forEach((coord) => {
            bounds.extend(coord as [number, number]);
            totalLng += coord[0];
            totalLat += coord[1];
            pointCount++;
          });
        } else if (feature.geometry.type === 'Point') {
          bounds.extend(feature.geometry.coordinates as [number, number]);
          totalLng += feature.geometry.coordinates[0];
          totalLat += feature.geometry.coordinates[1];
          pointCount++;
        } else if (feature.geometry.type === 'MultiPoint') {
          feature.geometry.coordinates.forEach((coord) => {
            bounds.extend(coord as [number, number]);
            totalLng += coord[0];
            totalLat += coord[1];
            pointCount++;
          });
        } else if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord) => {
            bounds.extend(coord as [number, number]);
            totalLng += coord[0];
            totalLat += coord[1];
            pointCount++;
          });
        }
      });

      // Calculate centroid
      const centroid: [number, number] = pointCount > 0 
        ? [totalLng / pointCount, totalLat / pointCount]
        : [121.0223, 14.6091]; // Fallback to Metro Manila

      // Fit map to bounds if there are features
      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15,
          duration: 1000,
        });
      } else {
        // If no bounds, center on calculated centroid
        mapRef.current.setCenter(centroid);
      }

      // Initialize or update Deck.gl overlay
      if (!deckRef.current && deckCanvasRef.current && mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        // Create new Deck instance with centroid as initial view
        const deck = new Deck({
          canvas: deckCanvasRef.current,
          width: rect.width,
          height: rect.height,
          initialViewState: {
            longitude: centroid[0],
            latitude: centroid[1],
            zoom: 11,
          },
          controller: true,
          layers: [],
        });

        // Sync Deck.gl with MapLibre
        const updateDeckViewState = () => {
          if (!mapRef.current || !deck) return;
          
          const center = mapRef.current.getCenter();
          const zoom = mapRef.current.getZoom();
          const bearing = mapRef.current.getBearing();
          const pitch = mapRef.current.getPitch();

          deck.setProps({
            viewState: {
              longitude: center.lng,
              latitude: center.lat,
              zoom: zoom,
              bearing: bearing,
              pitch: pitch,
            },
          });
        };

        mapRef.current.on('move', updateDeckViewState);
        mapRef.current.on('zoom', updateDeckViewState);
        mapRef.current.on('rotate', updateDeckViewState);
        mapRef.current.on('pitch', updateDeckViewState);

        deckRef.current = deck;
      }

      // Create GeoJsonLayer with styling based on properties
      const geoJsonLayer = new GeoJsonLayer({
        id: 'geojson-layer',
        data: geoJsonData,
        pickable: true,
        stroked: true,
        filled: true,
        extruded: false,
        lineWidthScale: 2,
        lineWidthMinPixels: 8,
        lineWidthMaxPixels: 25,
        getFillColor: [160, 160, 180, 100],
        getLineColor: (feature: any) => {
          // Color by work scope or type
          const workScope = feature.properties?.work_scope || '';
          if (workScope.toLowerCase().includes('widening')) {
            return [255, 140, 0, 255]; // Orange for road widening
          } else if (workScope.toLowerCase().includes('rehabilitation')) {
            return [0, 150, 255, 255]; // Blue for rehabilitation
          } else if (workScope.toLowerCase().includes('construction')) {
            return [0, 200, 0, 255]; // Green for construction
          }
          return [255, 0, 0, 255]; // Red default
        },
        getLineWidth: 8,
        getPointRadius: 12,
        pointRadiusMinPixels: 8,
        pointRadiusMaxPixels: 30,
        onHover: (info: any) => {
          if (info.object && mapContainerRef.current) {
            mapContainerRef.current.style.cursor = 'pointer';
          } else if (mapContainerRef.current) {
            mapContainerRef.current.style.cursor = 'default';
          }
        },
        onClick: (info: any) => {
          if (info.object) {
            const props = info.object.properties;
            const popupContent = `
              <div style="padding: 10px; max-width: 300px;">
                <h3 style="margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">
                  ${props.name || 'Project Location'}
                </h3>
                ${props.dsow ? `<p style="margin: 4px 0;"><strong>Scope:</strong> ${props.dsow}</p>` : ''}
                ${props.work_scope ? `<p style="margin: 4px 0;"><strong>Work Type:</strong> ${props.work_scope}</p>` : ''}
                ${props.length ? `<p style="margin: 4px 0;"><strong>Length:</strong> ${props.length}m</p>` : ''}
                ${props.target_amount ? `<p style="margin: 4px 0;"><strong>Target:</strong> ${props.target_amount} ${props.target_unit || ''}</p>` : ''}
                ${props.cost_x ? `<p style="margin: 4px 0;"><strong>Cost:</strong> ₱${props.cost_x.toLocaleString('en-PH')}</p>` : ''}
                ${props.start_station_limit && props.end_station_limit ? 
                  `<p style="margin: 4px 0;"><strong>Station:</strong> ${props.start_station_limit} - ${props.end_station_limit}</p>` : ''}
              </div>
            `;

            // Create popup
            new maplibregl.Popup()
              .setLngLat(info.coordinate as [number, number])
              .setHTML(popupContent)
              .addTo(mapRef.current!);
          }
        },
      });

      // Update Deck.gl layers
      if (deckRef.current) {
        deckRef.current.setProps({
          layers: [geoJsonLayer],
        });
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error rendering GeoJSON:', err);
      setError('Failed to render map data');
      setIsLoading(false);
    }
  }, [geoJsonData]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div 
        ref={mapContainerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'relative'
        }} 
      />
      <canvas
        ref={deckCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
      
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 1000,
        }}>
          <p style={{ margin: 0, fontSize: '14px' }}>Loading map data...</p>
        </div>
      )}
      
      {error && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 1000,
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {!geoJsonData && !isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 1,
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            No map data available
          </p>
        </div>
      )}

      {/* Legend */}
      {/* {geoJsonData && geoJsonData.features.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '10px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 999,
          fontSize: '12px',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Legend</div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ 
              width: '20px', 
              height: '3px', 
              background: 'rgb(255, 140, 0)', 
              marginRight: '8px' 
            }} />
            <span>Road Widening</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ 
              width: '20px', 
              height: '3px', 
              background: 'rgb(0, 150, 255)', 
              marginRight: '8px' 
            }} />
            <span>Rehabilitation</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ 
              width: '20px', 
              height: '3px', 
              background: 'rgb(0, 200, 0)', 
              marginRight: '8px' 
            }} />
            <span>Construction</span>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default MapRenderer;
