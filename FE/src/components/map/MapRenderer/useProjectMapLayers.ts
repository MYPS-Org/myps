import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import maplibregl, { type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
import type { LayerVisibilityState, MapLayerDefinition, PopupFieldConfig, ProjectFeatureProperties } from './types';
import { buildPopupHtml, computeBoundsAndCentroid, groupFeaturesByLayer } from './geoJsonUtils';

export interface UseProjectMapLayersResult {
  visibility: LayerVisibilityState;
  toggleLayer: (id: string) => void;
  isLoading: boolean;
  error: string | null;
}

const sourceId = (layerId: string) => `source-${layerId}`;
// Separate from sourceId: MapLibre's cluster:true clustering (Supercluster under the hood) only
// understands Point features. Mixing LineStrings into a clustered source is unsupported, so when
// clustering is on, point-type features (genuine points and representativePointAtLowZoom's
// synthetic ones) are fed to this dedicated source instead, and sourceId above carries only
// lines/polygons. When clustering is off, this source is never created and nothing changes.
const pointSourceId = (layerId: string) => `source-${layerId}-points`;
const lineLayerId = (layerId: string) => `${layerId}-line`;
const fillLayerId = (layerId: string) => `${layerId}-fill`;
const outlineLayerId = (layerId: string) => `${layerId}-outline`;
const pointLayerId = (layerId: string) => `${layerId}-point`;
const representativePointLayerId = (layerId: string) => `${layerId}-rep-point`;
const clusterCircleLayerId = (layerId: string) => `${layerId}-cluster-circle`;
const clusterCountLayerId = (layerId: string) => `${layerId}-cluster-count`;
const sublayerIdsFor = (layerId: string) => [
  lineLayerId(layerId),
  fillLayerId(layerId),
  outlineLayerId(layerId),
  pointLayerId(layerId),
  representativePointLayerId(layerId),
  clusterCircleLayerId(layerId),
  clusterCountLayerId(layerId),
];

// Below this, a LineString's representative point (geoJsonUtils.ts's groupFeaturesByLayer) shows
// instead of the line itself; at or above it, the real line shows and the point disappears. One
// shared threshold, not a per-layer setting -- there's no reason different work-type buckets
// should switch over at different zoom levels.
export const LINE_REPRESENTATIVE_POINT_MAX_ZOOM = 10;

// Supercluster's own defaults, named here rather than left as magic numbers at the call site.
const CLUSTER_MAX_ZOOM = 14; // stop clustering once individual points are this far apart on screen
const CLUSTER_RADIUS = 50; // px, the grouping distance clusters are built from

const emptyFeatureCollection = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });

// Builds a MapLibre 'match' expression mapping a feature's Region property to its configured
// region color, falling back to the work-type layer's own color for anything unmatched (no
// Region label, or a label regionColorMap doesn't know about). Returns a plain color string
// when there's no map to match against, so callers don't need two separate code paths.
function representativePointColor(
  fallbackColor: string,
  regionColorMap: Record<string, string> | undefined
): string | maplibregl.DataDrivenPropertyValueSpecification<string> {
  const entries = regionColorMap ? Object.entries(regionColorMap) : [];
  if (entries.length === 0) return fallbackColor;
  return ['match', ['get', 'Region'], ...entries.flatMap(([label, color]) => [label, color]), fallbackColor] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>;
}

const isPointGeometryType = (type: GeoJSON.Geometry['type']) => type === 'Point' || type === 'MultiPoint';

// Supercluster (what MapLibre's cluster:true runs internally) only indexes plain Point geometry
// -- its coordinate read assumes a flat [lng, lat], not MultiPoint's nested array. Feeding it
// MultiPoint features doesn't throw; it silently fails to index them, so the whole clustered
// source renders nothing. "Other infra" work locations (gis_lrs.py's create_project_geom_other_infra)
// are stored as MultiPoint (Start/End in one feature), so this isn't an edge case for real
// programs -- confirmed live: a 3,106-feature program that was 100% MultiPoint rendered
// completely blank until this split existed. Each coordinate becomes its own Point feature,
// carrying the same properties; the click handler's ProjectId+ComponentId dedup already
// collapses them back into one popup entry, so this is invisible to that logic.
export function explodeMultiPoints(featureCollection: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const exploded: GeoJSON.Feature[] = [];
  featureCollection.features.forEach((feature) => {
    if (feature.geometry.type === 'MultiPoint') {
      feature.geometry.coordinates.forEach((coordinates) => {
        exploded.push({ type: 'Feature', properties: feature.properties, geometry: { type: 'Point', coordinates } });
      });
    } else {
      exploded.push(feature);
    }
  });
  return { type: 'FeatureCollection', features: exploded };
}

function splitByGeometryKind(featureCollection: GeoJSON.FeatureCollection): {
  points: GeoJSON.FeatureCollection;
  others: GeoJSON.FeatureCollection;
} {
  const points: GeoJSON.Feature[] = [];
  const others: GeoJSON.Feature[] = [];
  featureCollection.features.forEach((feature) => {
    (isPointGeometryType(feature.geometry.type) ? points : others).push(feature);
  });
  return {
    points: { type: 'FeatureCollection', features: points },
    others: { type: 'FeatureCollection', features: others },
  };
}

export function useProjectMapLayers(
  mapRef: RefObject<maplibregl.Map | null>,
  isMapReady: boolean,
  styleGeneration: number,
  geoJsonData: GeoJSON.FeatureCollection | null | undefined,
  layers: MapLayerDefinition[],
  popupFields?: PopupFieldConfig[],
  representativePointAtLowZoom = false,
  clusterPoints = false,
  // Off by default. When a caller handles its own fitBounds over the FULL (unsplit) dataset --
  // see MapRenderer.tsx's regionConfig branch -- this hook must not also fit bounds over just
  // the lines/polygons subset it was handed, or the two calls fight over the camera and
  // whichever fires last wins, framing the view to only half the data instead of everything.
  skipFitBounds = false,
  // Region label -> color, from MapRenderer.tsx's regionConfig. When provided, the
  // representative-point sublayer (the low-zoom stand-in for a LineString -- see
  // LINE_REPRESENTATIVE_POINT_MAX_ZOOM) colors each point by ITS OWN feature's Region property
  // instead of the flat work-type layer.color every other sublayer uses. Without this, those
  // points silently fall outside the Regions legend's color-coding (e.g. every "other"-bucket
  // line's point rendering red regardless of region), which looks like a map bug even though
  // the underlying data and filtering are both correct.
  regionColorMap: Record<string, string> | undefined = undefined,
  // Extra MapLibre layer IDs whose rendered features should be folded into THIS hook's own
  // click handler -- specifically, useClusteredPointLayer's per-region unclustered-point
  // circles (see its getUnclusteredPointLayerIds export). Without this, a region's real Point
  // feature and a LineString's representative point that happen to overlap at the same spot
  // (a project's CW1 point and its own ROW line, say) belong to two entirely separate click
  // systems and can each only ever show their own single feature -- the Project-level map
  // already merges overlapping features into one "N items overlap" popup (below), and the
  // Program-level map should too regardless of which of its two point-rendering systems a
  // feature happens to come from.
  extraInteractiveLayerIds: string[] = [],
  // Passed straight through to groupFeaturesByLayer -- see that function's own doc comment on
  // the param of the same name. true whenever MapRenderer.tsx's regionConfig is active.
  regionClusteringActive = false
): UseProjectMapLayersResult {
  const [visibility, setVisibility] = useState<LayerVisibilityState>(() =>
    Object.fromEntries(layers.map((layer) => [layer.id, true]))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Skeleton effect (below) only creates each representative-point layer once per
  // style/basemap generation and never recreates it, so a live regionColorMap change (e.g.
  // navigating to a different program without switching basemaps) needs its own update path --
  // see the dedicated effect further down that calls setPaintProperty. This ref lets the
  // skeleton effect read the CURRENT map without needing it in its own dependency array (adding
  // it there wouldn't help anyway: the map.getLayer(...) guard would just skip re-creating an
  // already-existing layer with stale colors baked in).
  const regionColorMapRef = useRef(regionColorMap);
  useEffect(() => {
    regionColorMapRef.current = regionColorMap;
  }, [regionColorMap]);

  // Switching basemaps replaces the whole style, wiping our sources/layers, so this
  // rebuilds the skeleton (and restores per-layer visibility) every time styleGeneration
  // changes, in addition to the initial isMapReady transition.
  const visibilityRef = useRef(visibility);
  useEffect(() => {
    visibilityRef.current = visibility;
  }, [visibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // One map-level click, not one per sublayer: two different projects' LineStrings can
    // legitimately share the same road corridor (e.g. a widening project and a separate rehab
    // project over the same stretch, from different funding programs/years), and nothing
    // upstream dedupes or offsets overlapping geometry. Binding per-sublayer used to mean a
    // click on an overlap either only ever revealed whichever feature MapLibre matched for
    // that one sublayer (same color bucket -- one source, one click binding, e.Features[0]
    // silently dropped the rest), or fired a separate popup per bucket the overlap touched
    // (different color buckets -- each had its own binding). queryRenderedFeatures across
    // every interactive sublayer at the click point, deduped, surfaces everything at once.
    const handleMapClick = (e: MapMouseEvent) => {
      // A cluster click zooms in to expand it, not a popup -- checked first, and separately from
      // the popup path below, since a cluster feature carries cluster_id/point_count instead of
      // any project's own properties.
      if (clusterPoints) {
        const clusterLayerIds = layers.map((layer) => clusterCircleLayerId(layer.id)).filter((id) => map.getLayer(id));
        const clusterHit = clusterLayerIds.length > 0
          ? map.queryRenderedFeatures(e.point, { layers: clusterLayerIds })[0]
          : undefined;
        if (clusterHit) {
          const clusterId = clusterHit.properties?.cluster_id;
          const source = map.getSource(clusterHit.source) as GeoJSONSource | undefined;
          if (source && clusterId != null) {
            source.getClusterExpansionZoom(clusterId).then((expansionZoom) => {
              map.easeTo({
                center: (clusterHit.geometry as GeoJSON.Point).coordinates as [number, number],
                zoom: expansionZoom,
                duration: 400,
              });
            }).catch(() => {
              // Already at the deepest cluster level MapLibre will split further, or the source
              // changed under us mid-click -- nothing meaningful to do, just drop the click.
            });
          }
          return;
        }
      }

      const interactiveLayerIds = layers
        .flatMap((layer) => [lineLayerId(layer.id), fillLayerId(layer.id), pointLayerId(layer.id), representativePointLayerId(layer.id)])
        .concat(extraInteractiveLayerIds)
        .filter((id) => map.getLayer(id));
      if (interactiveLayerIds.length === 0) return;

      const rendered = map.queryRenderedFeatures(e.point, { layers: interactiveLayerIds });
      if (rendered.length === 0) return;

      const seen = new Set<string>();
      const uniqueProperties: ProjectFeatureProperties[] = [];
      rendered.forEach((feature) => {
        const properties = (feature.properties ?? {}) as ProjectFeatureProperties;
        const projectId = properties.ProjectId != null ? String(properties.ProjectId) : '';
        const componentId = properties.ComponentId != null ? String(properties.ComponentId) : '';
        const key = projectId || componentId ? `${projectId}__${componentId}` : JSON.stringify(properties);
        if (seen.has(key)) return;
        seen.add(key);
        uniqueProperties.push(properties);
      });

      new maplibregl.Popup({ className: 'myps-map-popup' })
        .setLngLat(e.lngLat)
        .setHTML(buildPopupHtml(uniqueProperties, popupFields))
        .addTo(map);
    };
    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    layers.forEach((layer) => {
      const srcId = sourceId(layer.id);
      if (!map.getSource(srcId)) {
        map.addSource(srcId, { type: 'geojson', data: emptyFeatureCollection() });
      }
      // Opt-in, separate from srcId above (see pointSourceId's own comment): MapLibre's
      // clustering can only sit on an all-Points source.
      const pointSrcId = pointSourceId(layer.id);
      if (clusterPoints && !map.getSource(pointSrcId)) {
        map.addSource(pointSrcId, {
          type: 'geojson',
          data: emptyFeatureCollection(),
          cluster: true,
          clusterMaxZoom: CLUSTER_MAX_ZOOM,
          clusterRadius: CLUSTER_RADIUS,
        });
      }
      // Point/representative-point layers read from the clustered source once it exists, so
      // their own filters below (added once, never swapped per-render) stay correct for
      // whichever source backs them.
      const activePointSrcId = clusterPoints ? pointSrcId : srcId;

      if (!map.getLayer(fillLayerId(layer.id))) {
        map.addLayer({
          id: fillLayerId(layer.id),
          type: 'fill',
          source: srcId,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': layer.color, 'fill-opacity': 0.3 },
        });
      }
      if (!map.getLayer(outlineLayerId(layer.id))) {
        map.addLayer({
          id: outlineLayerId(layer.id),
          type: 'line',
          source: srcId,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'line-color': layer.color, 'line-width': 2 },
        });
      }
      if (!map.getLayer(lineLayerId(layer.id))) {
        map.addLayer({
          id: lineLayerId(layer.id),
          type: 'line',
          source: srcId,
          // Below LINE_REPRESENTATIVE_POINT_MAX_ZOOM, representativePointLayerId below shows
          // this feature's rough location instead -- a real line is only a few pixels long at
          // that scale anyway. Only set when the caller opts in; otherwise the line always shows,
          // the pre-existing behavior every other MapRenderer consumer still gets.
          ...(representativePointAtLowZoom ? { minzoom: LINE_REPRESENTATIVE_POINT_MAX_ZOOM } : {}),
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: { 'line-color': layer.color, 'line-width': 4 },
        });
      }
      if (!map.getLayer(pointLayerId(layer.id))) {
        map.addLayer({
          id: pointLayerId(layer.id),
          type: 'circle',
          source: activePointSrcId,
          // Excludes the synthetic representative points geoJsonUtils.ts adds alongside every
          // LineString (__representativePoint) -- those have their own sublayer below, with its
          // own zoom range, so a genuine Point/MultiPoint feature (e.g. a bridge) stays visible
          // at every zoom regardless of the line/point switchover. Also excludes cluster-parent
          // features (point_count only exists on those, added by MapLibre's own clustering) --
          // clusterCircleLayerId below renders those instead.
          filter: ['all',
            ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
            ['!=', ['get', '__representativePoint'], true],
            ['!', ['has', 'point_count']],
          ],
          paint: {
            'circle-color': layer.color,
            'circle-radius': 6,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
          },
        });
      }
      if (representativePointAtLowZoom && !map.getLayer(representativePointLayerId(layer.id))) {
        map.addLayer({
          id: representativePointLayerId(layer.id),
          type: 'circle',
          source: activePointSrcId,
          maxzoom: LINE_REPRESENTATIVE_POINT_MAX_ZOOM,
          filter: ['all',
            ['==', ['get', '__representativePoint'], true],
            ['!', ['has', 'point_count']],
          ],
          paint: {
            'circle-color': representativePointColor(layer.color, regionColorMapRef.current),
            'circle-radius': 6,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
          },
        });
      }
      if (clusterPoints && !map.getLayer(clusterCircleLayerId(layer.id))) {
        map.addLayer({
          id: clusterCircleLayerId(layer.id),
          type: 'circle',
          source: pointSrcId,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': layer.color,
            // Three size tiers by how many points got grouped, not a continuous scale -- plenty
            // for a count badge; a donut-chart-by-category version is the natural next step if
            // the count alone stops being enough.
            'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 22],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
      }
      if (clusterPoints && !map.getLayer(clusterCountLayerId(layer.id))) {
        map.addLayer({
          id: clusterCountLayerId(layer.id),
          type: 'symbol',
          source: pointSrcId,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 12,
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });
      }

      const interactiveSublayerIds = [lineLayerId(layer.id), fillLayerId(layer.id), pointLayerId(layer.id)];
      if (representativePointAtLowZoom) interactiveSublayerIds.push(representativePointLayerId(layer.id));
      if (clusterPoints) interactiveSublayerIds.push(clusterCircleLayerId(layer.id));
      interactiveSublayerIds.forEach((sublayerId) => {
        map.on('mouseenter', sublayerId, handleMouseEnter);
        map.on('mouseleave', sublayerId, handleMouseLeave);
      });

      const layerVisible = visibilityRef.current[layer.id] ?? true;
      sublayerIdsFor(layer.id).forEach((sublayerId) => {
        if (map.getLayer(sublayerId)) {
          map.setLayoutProperty(sublayerId, 'visibility', layerVisible ? 'visible' : 'none');
        }
      });
    });

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
      layers.forEach((layer) => {
        sublayerIdsFor(layer.id).forEach((sublayerId) => {
          map.off('mouseenter', sublayerId, handleMouseEnter);
          map.off('mouseleave', sublayerId, handleMouseLeave);
        });
      });
    };
  }, [mapRef, isMapReady, styleGeneration, layers, popupFields, representativePointAtLowZoom, clusterPoints, extraInteractiveLayerIds]);

  // Keeps the representative-point layers' colors in sync when regionColorMap changes without a
  // style reload (e.g. navigating to a different program, which has its own regions/colors, on
  // the same basemap) -- the skeleton effect above only ever creates these layers once per
  // styleGeneration and skips recreation if they already exist, so updating the live paint
  // property here is the only way an already-rendered layer picks up new region colors.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !representativePointAtLowZoom) return;

    layers.forEach((layer) => {
      const id = representativePointLayerId(layer.id);
      if (map.getLayer(id)) {
        map.setPaintProperty(id, 'circle-color', representativePointColor(layer.color, regionColorMap));
      }
    });
  }, [mapRef, isMapReady, styleGeneration, layers, representativePointAtLowZoom, regionColorMap]);

  // Feed the grouped GeoJSON into each bucket's source whenever the data changes, and
  // again whenever the style reloads (a basemap switch wipes source data back to empty).
  // Bounds are only (re)fit on an actual data change, so switching basemaps doesn't
  // jerk the camera back to the fitted view.
  const lastFitDataRef = useRef<GeoJSON.FeatureCollection | null | undefined>(undefined);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (!geoJsonData) {
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const grouped = groupFeaturesByLayer(geoJsonData, layers, representativePointAtLowZoom, regionClusteringActive);
      layers.forEach((layer) => {
        if (clusterPoints) {
          // Lines/polygons stay on the regular source; points move to the clustered one (see
          // pointSourceId's comment -- a clustered source can't also hold LineStrings).
          const { points, others } = splitByGeometryKind(grouped[layer.id]);
          const lineSource = map.getSource(sourceId(layer.id)) as GeoJSONSource | undefined;
          lineSource?.setData(others);
          const pointSource = map.getSource(pointSourceId(layer.id)) as GeoJSONSource | undefined;
          pointSource?.setData(explodeMultiPoints(points));
        } else {
          const source = map.getSource(sourceId(layer.id)) as GeoJSONSource | undefined;
          source?.setData(grouped[layer.id]);
        }
      });

      if (!skipFitBounds && lastFitDataRef.current !== geoJsonData) {
        lastFitDataRef.current = geoJsonData;
        const { bounds, centroid } = computeBoundsAndCentroid(geoJsonData);
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1000 });
        } else {
          map.setCenter(centroid);
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error rendering GeoJSON:', err);
      setError('Failed to render map data');
      setIsLoading(false);
    }
  }, [mapRef, isMapReady, styleGeneration, geoJsonData, layers, representativePointAtLowZoom, clusterPoints, skipFitBounds, regionClusteringActive]);

  const toggleLayer = useCallback(
    (id: string) => {
      const map = mapRef.current;
      if (!map) return;

      setVisibility((prev) => {
        const nextVisible = !prev[id];
        sublayerIdsFor(id).forEach((sublayerId) => {
          if (map.getLayer(sublayerId)) {
            map.setLayoutProperty(sublayerId, 'visibility', nextVisible ? 'visible' : 'none');
          }
        });
        return { ...prev, [id]: nextVisible };
      });
    },
    [mapRef]
  );

  return { visibility, toggleLayer, isLoading, error };
}
