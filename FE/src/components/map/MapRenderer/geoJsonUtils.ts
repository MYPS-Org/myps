import maplibregl from 'maplibre-gl';
import type { MapLayerDefinition, ProjectFeatureProperties } from './types';
import { METRO_MANILA_CENTER } from './mapStyle';

export interface BoundsAndCentroid {
  bounds: maplibregl.LngLatBounds;
  centroid: [number, number];
}

export function computeBoundsAndCentroid(featureCollection: GeoJSON.FeatureCollection): BoundsAndCentroid {
  const bounds = new maplibregl.LngLatBounds();
  let totalLng = 0;
  let totalLat = 0;
  let pointCount = 0;

  const extend = (coord: number[]) => {
    bounds.extend(coord as [number, number]);
    totalLng += coord[0];
    totalLat += coord[1];
    pointCount++;
  };

  featureCollection.features.forEach((feature) => {
    const geometry = feature.geometry;
    if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
      geometry.coordinates.forEach((coord) => extend(coord as number[]));
    } else if (geometry.type === 'Point') {
      extend(geometry.coordinates);
    } else if (geometry.type === 'Polygon') {
      geometry.coordinates[0].forEach((coord) => extend(coord as number[]));
    }
  });

  const centroid: [number, number] = pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : METRO_MANILA_CENTER;

  return { bounds, centroid };
}

export function groupFeaturesByLayer(
  featureCollection: GeoJSON.FeatureCollection,
  layers: MapLayerDefinition[]
): Record<string, GeoJSON.FeatureCollection> {
  const grouped: Record<string, GeoJSON.FeatureCollection> = {};
  layers.forEach((layer) => {
    grouped[layer.id] = { type: 'FeatureCollection', features: [] };
  });

  featureCollection.features.forEach((feature) => {
    const properties = (feature.properties ?? {}) as ProjectFeatureProperties;
    const matchedLayer = layers.find((layer) => layer.matches(properties));
    if (matchedLayer) {
      grouped[matchedLayer.id].features.push(feature);
    }
  });

  return grouped;
}

export function buildPopupHtml(properties: ProjectFeatureProperties): string {
  return `
    <div style="padding: 10px; max-width: 300px;">
      <h3 style="margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">
        ${properties.name || 'Project Location'}
      </h3>
      ${properties.dsow ? `<p style="margin: 4px 0;"><strong>Scope:</strong> ${properties.dsow}</p>` : ''}
      ${properties.work_scope ? `<p style="margin: 4px 0;"><strong>Work Type:</strong> ${properties.work_scope}</p>` : ''}
      ${properties.length ? `<p style="margin: 4px 0;"><strong>Length:</strong> ${properties.length}m</p>` : ''}
      ${properties.target_amount ? `<p style="margin: 4px 0;"><strong>Target:</strong> ${properties.target_amount} ${properties.target_unit || ''}</p>` : ''}
      ${properties.cost_x ? `<p style="margin: 4px 0;"><strong>Cost:</strong> ₱${properties.cost_x.toLocaleString('en-PH')}</p>` : ''}
      ${
        properties.start_station_limit && properties.end_station_limit
          ? `<p style="margin: 4px 0;"><strong>Station:</strong> ${properties.start_station_limit} - ${properties.end_station_limit}</p>`
          : ''
      }
    </div>
  `;
}
