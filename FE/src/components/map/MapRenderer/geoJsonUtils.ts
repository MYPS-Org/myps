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

// Average of a LineString's own coordinates -- good enough as a rough "where is this" marker;
// no need for a real geometric midpoint-by-distance given it's only ever shown at a zoom level
// where the whole line is a handful of pixels wide anyway.
export function representativePointForLineString(coordinates: GeoJSON.Position[]): GeoJSON.Position {
  let sumLng = 0;
  let sumLat = 0;
  coordinates.forEach(([lng, lat]) => {
    sumLng += lng;
    sumLat += lat;
  });
  return [sumLng / coordinates.length, sumLat / coordinates.length];
}

export function groupFeaturesByLayer(
  featureCollection: GeoJSON.FeatureCollection,
  layers: MapLayerDefinition[],
  representativePointAtLowZoom = false,
  // When regionConfig is active, a LineString WITH a region label gets its low-zoom
  // representative point from MapRenderer.tsx's clusteredPointData instead (so it can merge
  // into that region's cluster count alongside real points, instead of always standing alone --
  // see MapRenderer.tsx's own comment on clusteredPointData for the full picture). Generating
  // one here too would double it up. A LineString with NO region label isn't covered by any
  // region's cluster source, so it still gets the original always-visible representative point
  // here, same as when regionConfig isn't used at all.
  regionClusteringActive = false
): Record<string, GeoJSON.FeatureCollection> {
  const grouped: Record<string, GeoJSON.FeatureCollection> = {};
  layers.forEach((layer) => {
    grouped[layer.id] = { type: 'FeatureCollection', features: [] };
  });

  featureCollection.features.forEach((feature) => {
    const properties = (feature.properties ?? {}) as ProjectFeatureProperties;
    const matchedLayer = layers.find((layer) => layer.matches(properties));
    if (!matchedLayer) return;

    grouped[matchedLayer.id].features.push(feature);

    // Below the zoom level useProjectMapLayers.ts switches the line sublayer on, a short road
    // segment is only a few pixels long -- effectively invisible at province/country scale even
    // though it's real data, not an empty area. A same-colored point at the line's rough center
    // gives zoomed-out users something to actually see (and click) there; the point and line
    // sublayers use mutually exclusive minzoom/maxzoom, so only one of the two is ever on screen.
    // Opt-in (representativePointAtLowZoom): only the Program map turns this on, so a single
    // project's map -- usually already zoomed in on its own work -- keeps its original behavior.
    const hasRegion = typeof properties.Region === 'string' && properties.Region.trim() !== '';
    if (
      representativePointAtLowZoom &&
      feature.geometry.type === 'LineString' &&
      !(regionClusteringActive && hasRegion)
    ) {
      grouped[matchedLayer.id].features.push({
        type: 'Feature',
        properties: { ...properties, __representativePoint: true },
        geometry: {
          type: 'Point',
          coordinates: representativePointForLineString(feature.geometry.coordinates as GeoJSON.Position[]),
        },
      });
    }
  });

  return grouped;
}

const escapeHtml = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

const popupRow = (label: string, value: unknown): string =>
  `<p style="margin: 4px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;

function buildConfiguredFieldsHtml(properties: ProjectFeatureProperties, fields: PopupFieldConfig[]): string {
  return fields
    .filter(({ key }) => properties[key] !== undefined && properties[key] !== null && properties[key] !== '')
    .map(({ label, key }) => popupRow(label, properties[key]))
    .join('');
}

function buildSingleFeaturePopupHtml(properties: ProjectFeatureProperties, fields?: PopupFieldConfig[]): string {
  // Rendered inside a header bar (myps-popup-header) so it sits to the left of
  // MapLibre's absolutely-positioned close button instead of being overlapped by it.
  const headerContent = fields
    ? buildConfiguredFieldsHtml(properties, fields)
    : properties.name
      ? `<h3 style="margin: 0; font-weight: bold; font-size: 14px;">${escapeHtml(properties.name)}</h3>`
      : '';

  const bodyRows = [
    properties.dsow ? popupRow('Scope', properties.dsow) : '',
    properties.work_scope ? popupRow('Work Type', properties.work_scope) : '',
    properties.length ? popupRow('Length', `${properties.length}m`) : '',
    properties.target_amount ? popupRow('Target', `${properties.target_amount} ${properties.target_unit || ''}`) : '',
    properties.cost_x ? popupRow('Cost', `₱${properties.cost_x.toLocaleString('en-PH')}`) : '',
    properties.start_station_limit && properties.end_station_limit
      ? popupRow('Station', `${properties.start_station_limit} - ${properties.end_station_limit}`)
      : '',
  ].join('');

  return `
    ${headerContent ? `<div class="myps-popup-header">${headerContent}</div>` : ''}
    ${bodyRows ? `<div style="padding: 8px 10px 10px;">${bodyRows}</div>` : ''}
  `;
}

// Takes every feature found at the clicked point, not just one -- two projects' LineStrings can
// legitimately share the same road corridor (e.g. a widening project and a separate rehab project
// over the same stretch, from different funding programs/years), and nothing upstream dedupes or
// offsets overlapping geometry. Without this, a click on the overlap only ever revealed whichever
// feature MapLibre happened to return first, and the other project was invisible -- not just a
// cosmetic issue, a real loss of information.
export function buildPopupHtml(featuresProperties: ProjectFeatureProperties[], fields?: PopupFieldConfig[]): string {
  if (featuresProperties.length <= 1) {
    return `<div style="max-width: 300px;">${buildSingleFeaturePopupHtml(featuresProperties[0] ?? {}, fields)}</div>`;
  }

  const sections = featuresProperties
    .map((properties, index) => `
      ${index > 0 ? '<hr style="margin: 4px 0; border: none; border-top: 1px solid #e5e7eb;" />' : ''}
      ${buildSingleFeaturePopupHtml(properties, fields)}
    `)
    .join('');

  return `
    <div style="max-width: 320px; max-height: 320px; overflow-y: auto;">
      <div style="padding: 6px 10px; font-size: 12px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">
        ${featuresProperties.length} items overlap at this point
      </div>
      ${sections}
    </div>
  `;
}
