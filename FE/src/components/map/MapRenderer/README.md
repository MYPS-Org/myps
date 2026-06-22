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
/>
```

That's it from the caller's side — everything else (basemap, layer toggling, popups,
loading/error/empty states) is handled internally. `geoJsonData` is expected to be the
raw response from `fetchProjectGeoJSON` (`pages/Project/Service.ts`): one flat
`FeatureCollection` where each feature's `properties` include `work_scope`, `dsow`,
`length`, `cost_x`, `start_station_limit`, etc.

## How it's put together

```
MapRenderer.tsx          orchestrator — wires the two hooks below to the JSX
├── useMapLibreMap.ts     owns the map instance (create/destroy, controls, resize)
├── useProjectMapLayers.ts owns the data: sources, layers, popups, visibility
├── layerConfig.ts         the layer definitions (the "source of truth" for buckets)
├── geoJsonUtils.ts        pure helpers: bounds/centroid, grouping, popup HTML
├── mapStyle.ts            basemap style spec + initial center/zoom
├── LayerControlWidget.tsx the on-map checkbox widget
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

Creates the MapLibre map on mount (carto-light basemap from `mapStyle.ts`), adds
navigation/fullscreen controls, handles resize. Returns:

```ts
{ containerRef, mapRef, isMapReady }
```

`containerRef` goes on the `<div>` MapLibre mounts into. `isMapReady` flips to `true`
on the map's `load` event — native MapLibre sources/layers can only be added safely
after that, which is why this is split out from the data hook below.

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
