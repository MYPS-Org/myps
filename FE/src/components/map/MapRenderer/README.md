# MapRenderer

Renders a project's GeoJSON (roads, points, polygons) on a MapLibre GL map, with a
floating widget to show/hide groups of features ("layers"). Built on plain MapLibre GL
JS — no deck.gl, no second canvas.

## Usage

```tsx
import MapRenderer from '../../../components/map/MapRenderer';

<MapRenderer
  geoJsonData={geoJsonData} // GeoJSON.FeatureCollection | null
  height="500px"            // optional, defaults to '400px'
  popupFields={[                                    // optional, see below
    { label: 'Component Id', key: 'ComponentId' },
    { label: 'Start Station Limit', key: 'StartStationLimit' },
    { label: 'End Station Limit', key: 'EndStationLimit' },
  ]}
/>
```

That's it from the caller's side — everything else (basemap, layer toggling, popups,
loading/error/empty states) is handled internally. `geoJsonData` is expected to be the
raw response from `fetchProjectGeoJSON` (`pages/Project/Service.ts`): one flat
`FeatureCollection` where each feature's `properties` include `work_scope`, `dsow`,
`length`, `cost_x`, `start_station_limit`, etc.

### `popupFields` — configuring the popup header rows per consumer

Different callers pass different raw property shapes straight through as `geoJsonData`
(the Project module's `ComponentId`/`StartStationLimit`/`EndStationLimit`, GIS
Playground's adapted `name`, etc.), so the popup header isn't a single hardcoded field.
Pass a `PopupFieldConfig[]` (`types.ts`) to render one labeled row per entry, in order,
above the rest of the popup content:

```ts
{ label: string; key: string }[]
```

`key` is read off the feature's raw `properties`; the row is skipped when the value is
blank/missing. Omit the prop entirely to keep the old single-line header behavior
(`properties.name`, when present — otherwise no header is rendered at all).

## How it's put together

```
MapRenderer.tsx          orchestrator — wires the two hooks below to the JSX
├── useMapLibreMap.ts     owns the map instance (create/destroy, controls, resize)
├── useProjectMapLayers.ts owns the data: sources, layers, popups, visibility
├── layerConfig.ts         the layer definitions (the "source of truth" for buckets)
├── geoJsonUtils.ts        pure helpers: bounds/centroid, grouping, popup HTML
├── mapStyle.ts            basemap style specs (light/voyager/dark/streets/satellite) + initial center/zoom
├── LayerControlWidget.tsx the on-map checkbox widget
├── BasemapSwitcherWidget.tsx the on-map basemap dropdown
├── MapStatusOverlays.tsx  loading / error / empty-state UI
└── types.ts               shared TypeScript types
```

### 1. `layerConfig.ts` — defining what a "layer" is

A layer is just:

```ts
interface MapLayerDefinition {
  id: string;                                            // 'widening'
  label: string;                                         // 'Road Widening'
  color: string;                                         // '#FF8C00'
  matches: (properties: ProjectFeatureProperties) => boolean; // which features belong here
}
```

`DEFAULT_MAP_LAYERS` hardcodes four buckets — Widening, Rehabilitation, Construction,
Other — each matching on the feature's `work_scope` text, with `'other'` as a
catch-all (`matches: () => true`) for anything that doesn't match an earlier bucket.

This is the **only file that needs to change** if layer definitions ever move out of
the frontend (e.g. come from an admin-configurable table or a `layers` key the GIS
backend starts returning). Everything downstream — the hooks, the widget — consumes
the `MapLayerDefinition[]` shape, not the hardcoded values, so swapping
`DEFAULT_MAP_LAYERS` for `await fetchLayerDefinitions()` wouldn't require touching
anything else.

### 2. `useMapLibreMap.ts` — the map instance

Creates the MapLibre map on mount (defaults to the `light` basemap from `mapStyle.ts`),
adds navigation/fullscreen controls, handles resize. Returns:

```ts
{ containerRef, mapRef, isMapReady, basemap, setBasemap, styleGeneration }
```

`containerRef` goes on the `<div>` MapLibre mounts into. `isMapReady` flips to `true`
on the map's `load` event — native MapLibre sources/layers can only be added safely
after that, which is why this is split out from the data hook below.

`setBasemap(id)` calls `map.setStyle(...)` with one of the styles from `BASEMAPS` in
`mapStyle.ts`. Swapping styles wipes every source/layer MapLibre doesn't own (i.e. all
of `useProjectMapLayers`'s sources/layers), so `styleGeneration` is bumped each time a
style finishes (re)loading — `useProjectMapLayers` watches it to rebuild its skeleton
and re-feed the current GeoJSON after a basemap switch.

### 3. `useProjectMapLayers.ts` — turning GeoJSON into layers on the map

Two effects:

- **Skeleton (once, when `isMapReady`)** — for every entry in `DEFAULT_MAP_LAYERS`, adds
  one empty GeoJSON source plus up to four MapLibre layers reading from it: a `line`
  layer (filtered to `LineString` geometries), a `fill` + outline `line` layer
  (filtered to `Polygon`), and a `circle` layer (filtered to `Point`/`MultiPoint`).
  Click/hover handlers (popup + cursor) are attached to each interactive sublayer here.
- **Data (every time `geoJsonData` changes)** — runs `groupFeaturesByLayer` to bucket
  the incoming features by `work_scope`, then calls `source.setData(...)` per bucket
  and `fitBounds`/`setCenter` to frame the result.

It returns:

```ts
{ visibility, toggleLayer, isLoading, error }
```

`toggleLayer(id)` flips every sublayer belonging to that bucket between
`visibility: 'visible'` and `'none'` via `map.setLayoutProperty` — this is the actual
hide/show mechanism, and it's native to MapLibre (no re-fetching or re-grouping data).

### 4. `LayerControlWidget.tsx` — the widget

Pure presentational component. Given `layers`, `visibility`, and `onToggle`, renders a
small floating panel (bottom-left) with one checkbox + color swatch per layer. Reuses
the existing `Checkbox` primitive from `components/tailwindui/checkbox.tsx`.

### `BasemapSwitcherWidget.tsx` — the basemap dropdown

Pure presentational component, floating top-left. A plain `<select>` listing every
entry in `BASEMAPS` (`mapStyle.ts`); `onChange` calls `setBasemap(id)` from
`useMapLibreMap`. Available basemaps: **Light**, **Voyager**, **Dark** (all CARTO
raster tiles, no API key), **Streets** (OpenStreetMap standard tiles), and
**Satellite** (Esri World Imagery). Add a new basemap by adding an entry to
`BASEMAPS` in `mapStyle.ts` — nothing else needs to change.

### 5. `geoJsonUtils.ts` — pure helpers

- `computeBoundsAndCentroid(featureCollection)` — same bounds/centroid math the old
  component had, used to frame the map after data loads.
- `groupFeaturesByLayer(featureCollection, layers)` — runs every feature through each
  layer's `matches()` in order, first match wins, returns
  `Record<layerId, FeatureCollection>`.
- `buildPopupHtml(properties)` — the click-popup markup (name, scope, length, cost,
  station limits).

## Adding a new layer bucket

Add an entry to `DEFAULT_MAP_LAYERS` in `layerConfig.ts` with an `id`, `label`,
`color`, and a `matches` predicate. Nothing else needs to change — the skeleton effect
in `useProjectMapLayers.ts` will create its source/sublayers automatically, and
`LayerControlWidget` will render a checkbox for it automatically.

## Rendering / GPU notes

MapLibre GL JS renders via WebGL, so the basemap tiles and every feature layer (line,
circle, fill) are GPU-accelerated. Dropping deck.gl removed the *second* WebGL canvas
that used to sit on top of the map (and the per-frame code that kept its camera in sync
with MapLibre's) — it didn't move anything off the GPU. There's just one WebGL context
doing the work now instead of two.
