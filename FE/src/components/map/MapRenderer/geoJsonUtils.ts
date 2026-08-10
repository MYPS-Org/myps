import maplibregl from 'maplibre-gl';
import type { MapLayerDefinition, PopupFieldConfig, ProjectFeatureProperties } from './types';
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

const escapeHtml = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

const popupRow = (label: string, value: unknown): string =>
  `<p style="margin: 4px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;

function buildConfiguredFieldsHtml(properties: ProjectFeatureProperties, fields: PopupFieldConfig[]): string {
  const rows = fields
    .filter(({ key }) => properties[key] !== undefined && properties[key] !== null && properties[key] !== '')
    .map(({ label, key }) => popupRow(label, properties[key]));

  if (rows.length === 0) return '';

  return `<div style="padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb;">${rows.join('')}</div>`;
}

export function buildPopupHtml(properties: ProjectFeatureProperties, fields?: PopupFieldConfig[]): string {
  const header = fields
    ? buildConfiguredFieldsHtml(properties, fields)
    : `<h3 style="margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">${escapeHtml(properties.name || 'Project Location')}</h3>`;

  return `
    <div style="padding: 10px; max-width: 300px;">
      ${header}
      ${properties.dsow ? popupRow('Scope', properties.dsow) : ''}
      ${properties.work_scope ? popupRow('Work Type', properties.work_scope) : ''}
      ${properties.length ? popupRow('Length', `${properties.length}m`) : ''}
      ${properties.target_amount ? popupRow('Target', `${properties.target_amount} ${properties.target_unit || ''}`) : ''}
      ${properties.cost_x ? popupRow('Cost', `₱${properties.cost_x.toLocaleString('en-PH')}`) : ''}
      ${
        properties.start_station_limit && properties.end_station_limit
          ? popupRow('Station', `${properties.start_station_limit} - ${properties.end_station_limit}`)
          : ''
      }
    </div>
  `;
}
