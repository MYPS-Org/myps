import type { StyleSpecification } from 'maplibre-gl';

export const METRO_MANILA_CENTER: [number, number] = [121.0223, 14.6091];
export const DEFAULT_ZOOM = 11;

// 'light' | 'voyager' | 'dark' | 'hazard' commented out for now — see BASEMAPS below
export type BasemapId = 'osm' | 'satellite' | 'topo';

export interface BasemapDefinition {
  id: BasemapId;
  label: string;
  style: StyleSpecification;
}

const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// const cartoAttribution = `${osmAttribution} &copy; <a href="https://carto.com/attributions">CARTO</a>`;
const esriAttribution = '&copy; <a href="https://www.esri.com">Esri</a>';
const topoAttribution = `${osmAttribution}, SRTM &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`;

const rasterStyle = (sourceId: string, tiles: string[], attribution: string): StyleSpecification => ({
  version: 8,
  sources: {
    [sourceId]: {
      type: 'raster',
      tiles,
      tileSize: 256,
      attribution,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#f8f8f8' },
    },
    {
      id: sourceId,
      type: 'raster',
      source: sourceId,
      minzoom: 0,
      maxzoom: 22,
    },
  ],
});

export const BASEMAPS: Record<BasemapId, BasemapDefinition> = {
  // Commented out for now — light/voyager/dark basemaps disabled, Streets is the default.
  // light: {
  //   id: 'light',
  //   label: 'Light',
  //   style: rasterStyle(
  //     'carto-light',
  //     [
  //       'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  //       'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  //       'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  //     ],
  //     cartoAttribution
  //   ),
  // },
  // voyager: {
  //   id: 'voyager',
  //   label: 'Voyager',
  //   style: rasterStyle(
  //     'carto-voyager',
  //     [
  //       'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  //       'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  //       'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  //     ],
  //     cartoAttribution
  //   ),
  // },
  // dark: {
  //   id: 'dark',
  //   label: 'Dark',
  //   style: rasterStyle(
  //     'carto-dark',
  //     [
  //       'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  //       'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  //       'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  //     ],
  //     cartoAttribution
  //   ),
  // },
  osm: {
    id: 'osm',
    label: 'Streets',
    style: rasterStyle(
      'osm-standard',
      [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      osmAttribution
    ),
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    style: rasterStyle(
      'esri-satellite',
      ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      esriAttribution
    ),
  },
  // Commented out for now — no real hazard tile source wired up yet (e.g. PHIVOLCS/NOAH WMS).
  // hazard: {
  //   id: 'hazard',
  //   label: 'Hazard',
  //   style: rasterStyle('hazard-placeholder', ['TODO_HAZARD_TILE_URL/{z}/{x}/{y}.png'], osmAttribution),
  // },
  topo: {
    id: 'topo',
    label: 'Topo',
    style: rasterStyle(
      'opentopomap',
      [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      topoAttribution
    ),
  },
};

export const DEFAULT_BASEMAP: BasemapId = 'osm';
