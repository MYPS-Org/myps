import React from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapLibreMap } from './useMapLibreMap';
import { useProjectMapLayers } from './useProjectMapLayers';
import { DEFAULT_MAP_LAYERS } from './layerConfig';
import LayerControlWidget from './LayerControlWidget';
import BasemapSwitcherWidget from './BasemapSwitcherWidget';
import { MapEmptyState, MapErrorBanner, MapLoadingOverlay } from './MapStatusOverlays';

interface MapRendererProps {
  geoJsonData?: GeoJSON.FeatureCollection | null;
  height?: string;
  projectId?: string;
  programId?: string;
}

const MapRenderer: React.FC<MapRendererProps> = ({ geoJsonData, height = '400px' }) => {
  const { containerRef, mapRef, isMapReady, basemap, setBasemap, styleGeneration } = useMapLibreMap();
  const { visibility, toggleLayer, isLoading, error } = useProjectMapLayers(
    mapRef,
    isMapReady,
    styleGeneration,
    geoJsonData,
    DEFAULT_MAP_LAYERS
  );

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />

      {isLoading && <MapLoadingOverlay />}
      {error && <MapErrorBanner message={error} />}
      {!geoJsonData && !isLoading && <MapEmptyState />}

      <BasemapSwitcherWidget current={basemap} onChange={setBasemap} />
      <LayerControlWidget layers={DEFAULT_MAP_LAYERS} visibility={visibility} onToggle={toggleLayer} />
    </div>
  );
};

export default MapRenderer;
