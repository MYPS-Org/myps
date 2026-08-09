import React from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapLibreMap } from './useMapLibreMap';
import { useProjectMapLayers } from './useProjectMapLayers';
import { DEFAULT_MAP_LAYERS } from './layerConfig';
import LayerControlWidget from './LayerControlWidget';
import BasemapSwitcherWidget from './BasemapSwitcherWidget';
import { MapEmptyState, MapErrorBanner, MapLoadingOverlay } from './MapStatusOverlays';
import type { MapLayerDefinition } from './types';

interface MapRendererProps {
  geoJsonData?: GeoJSON.FeatureCollection | null;
  height?: string;
  projectId?: string;
  programId?: string;
  layers?: MapLayerDefinition[];
}

const MapRenderer: React.FC<MapRendererProps> = ({ geoJsonData, height = '400px', layers = DEFAULT_MAP_LAYERS }) => {
  const { containerRef, mapRef, isMapReady, basemap, setBasemap, styleGeneration } = useMapLibreMap();
  const { visibility, toggleLayer, isLoading, error } = useProjectMapLayers(
    mapRef,
    isMapReady,
    styleGeneration,
    geoJsonData,
    layers
  );

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />

      {isLoading && <MapLoadingOverlay />}
      {error && <MapErrorBanner message={error} />}
      {!geoJsonData && !isLoading && <MapEmptyState />}

      <BasemapSwitcherWidget current={basemap} onChange={setBasemap} />
      <LayerControlWidget layers={layers} visibility={visibility} onToggle={toggleLayer} />
    </div>
  );
};

export default MapRenderer;
