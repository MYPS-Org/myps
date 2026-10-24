import { useEffect, useRef, useState, type RefObject } from 'react';
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import type { RegionConfig } from './types';
import { computeBoundsAndCentroid } from './geoJsonUtils';
import { LINE_REPRESENTATIVE_POINT_MAX_ZOOM } from './useProjectMapLayers';

const emptyFeatureCollection = (): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: [],
});

/**
 * Derives the MapLibre IDs (source + layers) for a given region slug.
 * Double-dash separator prevents collision with slugs that contain single dashes.
 *
 * layerUnclusteredPoint vs layerUnclusteredRepPoint: both are "this one feature, not part of a
 * cluster" circles, split by WHETHER that feature is a genuine Point (e.g. a project's CW1) or a
 * LineString's representative-point stand-in (e.g. its ROW line, folded into this region's
 * cluster by MapRenderer.tsx's clusteredPointData so it can count towards the SAME bubble as
 * real points -- see that file's own comment). A genuine point has no "real geometry" to hand
 * off to once zoomed in, so it stays visible at every zoom; a representative point is only ever
 * a stand-in for a real line, so -- same as every other LineString, clustered or not -- it needs
 * to disappear once zoomed in past LINE_REPRESENTATIVE_POINT_MAX_ZOOM and let the real line take
 * over. MapLibre filters can't reference zoom (only paint/layout properties can), so that split
 * has to be two separate layers with different maxzoom, not one layer with a zoom-aware filter.
 */
function regionIds(slug: string) {
  return {
    sourceId: `region-cluster-source--${slug}`,
    layerClusters: `region-cluster-clusters--${slug}`,
    layerClusterCount: `region-cluster-cluster-count--${slug}`,
    layerUnclusteredPoint: `region-cluster-unclustered-point--${slug}`,
    layerUnclusteredRepPoint: `region-cluster-unclustered-rep-point--${slug}`,
  };
}

/**
 * The layer IDs for each region's individual (non-cluster) point circles, so
 * MapRenderer.tsx can feed them into useProjectMapLayers' own click handler --
 * see that hook's `extraInteractiveLayerIds` param for why: a Point and a
 * LineString that overlap at the same spot (e.g. a project's CW1 point and its
 * ROW line) need to surface in ONE combined "N items overlap" popup, same as
 * the Project-level map already does, instead of two separate click systems
 * each only ever showing their own one feature.
 */
export function getUnclusteredPointLayerIds(regionConfig: RegionConfig[]): string[] {
  return regionConfig.flatMap((r) => {
    const { layerUnclusteredPoint, layerUnclusteredRepPoint } = regionIds(r.slug);
    return [layerUnclusteredPoint, layerUnclusteredRepPoint];
  });
}

export interface UseClusteredPointLayerResult {
  isLoading: boolean;
  error: string | null;
}

/**
 * Adds one independent clustered GeoJSON source + 3 layers per region in
 * `regionConfig` to the map, feeds them per-region filtered point data, and
 * toggles layer visibility based on `selectedRegions`.
 *
 * Three-effect pattern:
 *   1. Skeleton effect   (deps: isMapReady, styleGeneration, regionConfig)
 *      Registers sources/layers/handlers per region. Re-runs on every basemap
 *      switch (styleGeneration bump) because style reloads wipe all user-added
 *      sources and layers. Idempotent via getSource/getLayer guards.
 *   2. Data effect       (deps: isMapReady, styleGeneration, pointData, regionConfig)
 *      Filters pointData by Region label per region, calls setData() on each
 *      source. One-time fitBounds over the FULL unfiltered data (camera isn't
 *      reset on subsequent style reloads).
 *   3. Visibility effect (deps: isMapReady, styleGeneration, selectedRegions, regionConfig)
 *      Shows/hides each region's three layers based on selectedRegions.
 *
 * If `regionConfig` is empty all three effects no-op cleanly — callers that
 * don't pass region config are entirely unaffected.
 *
 * `pointData` must already be plain Point geometry (see MapRenderer.tsx's own
 * MultiPoint-exploding step before this hook sees it) -- MapLibre's clustering
 * (Supercluster under the hood) only indexes Point features; feeding it
 * MultiPoint silently fails to index them rather than throwing, so the whole
 * clustered source renders nothing.
 */
export function useClusteredPointLayer(
  mapRef: RefObject<maplibregl.Map | null>,
  isMapReady: boolean,
  styleGeneration: number,
  pointData: GeoJSON.FeatureCollection | null,
  regionConfig: RegionConfig[],
  selectedRegions: Set<string>,
  // Off by default. When a caller handles its own fitBounds over the FULL (unsplit) dataset --
  // see MapRenderer.tsx's regionConfig branch -- this hook must not also fit bounds over just
  // the points subset it was handed, or the two calls fight over the camera and whichever
  // fires last wins, framing the view to only half the data instead of everything.
  skipFitBounds = false
): UseClusteredPointLayerResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Skeleton effect -------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || regionConfig.length === 0) return;

    // Collect cleanup thunks so we un-register every handler added in this run.
    const cleanups: Array<() => void> = [];

    for (const region of regionConfig) {
      const { sourceId, layerClusters, layerClusterCount, layerUnclusteredPoint, layerUnclusteredRepPoint } =
        regionIds(region.slug);

      // --- Source ---
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          cluster: true,
          clusterMaxZoom: 14, // max zoom at which clusters are formed
          clusterRadius: 50,  // px radius for clustering
          data: emptyFeatureCollection(),
        });
      }

      // --- Cluster circles (step-expression sizing/coloring) ---
      if (!map.getLayer(layerClusters)) {
        map.addLayer({
          id: layerClusters,
          type: 'circle',
          source: sourceId,
          filter: ['has', 'point_count'],
          paint: {
            // Radius is BOTH count-stepped and zoom-interpolated. Count-stepping alone (a fixed
            // pixel size regardless of zoom) looks fine for any one region zoomed in, but at a
            // whole-country zoom every region's points collapse into a single mega-cluster (one
            // circle = that region's entire total), and since the Philippines is a narrow,
            // elongated landmass, same-size circles for adjacent regions pile on top of each
            // other on screen even though their true coordinates are hundreds of km apart. Scaling
            // down at low zoom keeps bubbles legible nationwide; it grows back to the original
            // sizes once zoomed in far enough that regions aren't crowding the same screen space.
            // (Smaller than the first pass at this -- several regions, e.g. the Visayas/Mindanao
            // cluster, are geographically close enough that even scaled-down circles still
            // compete for the same screen space; shrinking further buys more breathing room.)
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              4, ['step', ['get', 'point_count'], 6, 10, 9, 50, 12],
              7, ['step', ['get', 'point_count'], 11, 10, 16, 50, 21],
              10, ['step', ['get', 'point_count'], 20, 10, 30, 50, 40],
            ],
            // region.color, same as the unclustered-point layer below -- NOT a density-based
            // teal/yellow/pink scale (the earlier approach). A fixed scale looked fine in
            // isolation, but every region's cluster bubbles rendered the exact same color
            // regardless of which region they belonged to, so the Regions legend's colors only
            // ever matched once you zoomed in far enough for clusters to break apart into
            // individual (region-colored) points -- a cluster bubble is still this region's own
            // data, so it should look like it. Density is still visible via circle-radius/the
            // count label; color now stays consistent with the legend at every zoom level.
            'circle-color': region.color,
            // Slightly translucent so two overlapping bubbles blend into a visibly layered color
            // instead of the top one fully hiding the one behind it -- can't eliminate overlap
            // entirely (several regions are genuinely this close together on a national view),
            // but this keeps a covered bubble at least perceptible instead of invisible.
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
      }

      // --- Cluster count label ---
      if (!map.getLayer(layerClusterCount)) {
        map.addLayer({
          id: layerClusterCount,
          type: 'symbol',
          source: sourceId,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            // Matches the circle-radius zoom interpolation above so the label doesn't overflow
            // the shrunk low-zoom bubbles.
            'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 7, 10, 10, 12],
          },
          paint: { 'text-color': '#ffffff' },
        });
      }

      // --- Individual unclustered points — tinted by region.color ---
      // Genuine Point/MultiPoint features: no real geometry to hand off to, so always visible
      // regardless of zoom (same as every other Point feature on this map).
      if (!map.getLayer(layerUnclusteredPoint)) {
        map.addLayer({
          id: layerUnclusteredPoint,
          type: 'circle',
          source: sourceId,
          filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', '__representativePoint'], true]],
          paint: {
            'circle-radius': 8,
            'circle-color': region.color,  // each region has a visually distinct dot color
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
      }
      // LineStrings' representative-point stand-ins: capped at LINE_REPRESENTATIVE_POINT_MAX_ZOOM
      // so, same as every other LineString, the real line takes over once zoomed in instead of
      // leaving a redundant dot sitting on top of it forever.
      if (!map.getLayer(layerUnclusteredRepPoint)) {
        map.addLayer({
          id: layerUnclusteredRepPoint,
          type: 'circle',
          source: sourceId,
          maxzoom: LINE_REPRESENTATIVE_POINT_MAX_ZOOM,
          filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', '__representativePoint'], true]],
          paint: {
            'circle-radius': 8,
            'circle-color': region.color,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
      }

      // --- Event handlers — closures capture sourceId so each region's click
      //     handler expands the correct cluster source. ---

      // Clicking a cluster zooms to its expansion zoom level.
      const handleClusterClick = (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id as number;
        const source = map.getSource(sourceId) as GeoJSONSource;
        source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            map.easeTo({
              center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
              zoom,
            });
          })
          .catch((err: unknown) => {
            console.error('[useClusteredPointLayer] getClusterExpansionZoom error:', err);
          });
      };

      // Clicking an unclustered point does NOT open its own popup here -- that's handled by
      // useProjectMapLayers' unified click handler instead (see getUnclusteredPointLayerIds'
      // doc comment above), which can merge it with an overlapping line/other point into one
      // combined popup. This hook only keeps the hover cursor as a "this is clickable" signal.
      const handleMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
      const handleMouseLeave = () => { map.getCanvas().style.cursor = ''; };

      map.on('click', layerClusters, handleClusterClick);
      map.on('mouseenter', layerClusters, handleMouseEnter);
      map.on('mouseleave', layerClusters, handleMouseLeave);
      map.on('mouseenter', layerUnclusteredPoint, handleMouseEnter);
      map.on('mouseleave', layerUnclusteredPoint, handleMouseLeave);
      map.on('mouseenter', layerUnclusteredRepPoint, handleMouseEnter);
      map.on('mouseleave', layerUnclusteredRepPoint, handleMouseLeave);

      // Register cleanup thunks for this region's handlers.
      cleanups.push(
        () => map.off('click', layerClusters, handleClusterClick),
        () => map.off('mouseenter', layerClusters, handleMouseEnter),
        () => map.off('mouseleave', layerClusters, handleMouseLeave),
        () => map.off('mouseenter', layerUnclusteredPoint, handleMouseEnter),
        () => map.off('mouseleave', layerUnclusteredPoint, handleMouseLeave),
        () => map.off('mouseenter', layerUnclusteredRepPoint, handleMouseEnter),
        () => map.off('mouseleave', layerUnclusteredRepPoint, handleMouseLeave),
      );
    }

    return () => {
      // Remove only the listeners registered in this run; don't touch sources/layers —
      // MapLibre owns those and wipes them on the next style reload anyway.
      for (const cleanup of cleanups) cleanup();
    };
  }, [mapRef, isMapReady, styleGeneration, regionConfig]);

  // ---- Data effect -----------------------------------------------------------
  // Filters pointData by Region label for each region and feeds it to that
  // region's GeoJSON source. fitBounds runs once per new pointData reference
  // (not on each basemap switch) and covers the full unfiltered collection so
  // the initial camera covers everything regardless of which regions are selected.
  const lastFitDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (!pointData) {
      setError(null);
      setIsLoading(false);
      return;
    }

    if (regionConfig.length === 0) return;

    try {
      setIsLoading(true);
      setError(null);

      // Tracks each region's feature count alongside feeding its source, so it can be
      // reordered by size right after (see below) -- two separate loops would mean filtering
      // pointData by region twice for no reason.
      const featureCountByRegion = new Map<string, number>();
      for (const region of regionConfig) {
        const { sourceId } = regionIds(region.slug);
        const regionFeatures = pointData.features.filter(
          (f) => f.properties?.Region === region.label
        );
        featureCountByRegion.set(region.slug, regionFeatures.length);
        const source = map.getSource(sourceId) as GeoJSONSource | undefined;
        source?.setData({ type: 'FeatureCollection', features: regionFeatures });
      }

      // Paint order (layer z-index) is normally just addLayer call order from the skeleton
      // effect, fixed at creation and unrelated to how much data a region turns out to have.
      // With several regions' cluster bubbles genuinely overlapping on a national view (see the
      // circle-radius comment above), a larger region's circle can otherwise permanently bury a
      // smaller one directly behind it. moveLayer (no second arg = move to the very top)
      // reorders the EXISTING layers without recreating them; processing largest-first and
      // moving each to top in turn leaves the smallest-count region on top last, so a small
      // region is never the one left invisible behind a big one.
      const bySizeDescending = [...regionConfig].sort(
        (a, b) => (featureCountByRegion.get(b.slug) ?? 0) - (featureCountByRegion.get(a.slug) ?? 0)
      );
      for (const region of bySizeDescending) {
        const { layerClusters, layerClusterCount, layerUnclusteredPoint, layerUnclusteredRepPoint } =
          regionIds(region.slug);
        if (map.getLayer(layerClusters)) map.moveLayer(layerClusters);
        if (map.getLayer(layerClusterCount)) map.moveLayer(layerClusterCount);
        if (map.getLayer(layerUnclusteredPoint)) map.moveLayer(layerUnclusteredPoint);
        if (map.getLayer(layerUnclusteredRepPoint)) map.moveLayer(layerUnclusteredRepPoint);
      }

      // One-time fitBounds over the full (unfiltered) pointData. Basemap switches
      // (styleGeneration bumps) do NOT reset the camera because pointData reference
      // hasn't changed — same behaviour as useProjectMapLayers.
      if (!skipFitBounds && lastFitDataRef.current !== pointData) {
        lastFitDataRef.current = pointData;
        const { bounds, centroid } = computeBoundsAndCentroid(pointData);
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1000 });
        } else {
          map.setCenter(centroid);
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('[useClusteredPointLayer] Error setting clustered data:', err);
      setError('Failed to render region-clustered data');
      setIsLoading(false);
    }
  }, [mapRef, isMapReady, styleGeneration, pointData, regionConfig, skipFitBounds]);

  // ---- Visibility effect -----------------------------------------------------
  // Toggles each region's three layers visible/none based on selectedRegions.
  // Uses getLayer() guards because layers may not exist yet if the skeleton
  // effect hasn't run (e.g., map not ready when selectedRegions first changes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || regionConfig.length === 0) return;

    for (const region of regionConfig) {
      const { layerClusters, layerClusterCount, layerUnclusteredPoint, layerUnclusteredRepPoint } =
        regionIds(region.slug);
      const visibility = selectedRegions.has(region.slug) ? 'visible' : 'none';

      if (map.getLayer(layerClusters)) {
        map.setLayoutProperty(layerClusters, 'visibility', visibility);
      }
      if (map.getLayer(layerClusterCount)) {
        map.setLayoutProperty(layerClusterCount, 'visibility', visibility);
      }
      if (map.getLayer(layerUnclusteredPoint)) {
        map.setLayoutProperty(layerUnclusteredPoint, 'visibility', visibility);
      }
      if (map.getLayer(layerUnclusteredRepPoint)) {
        map.setLayoutProperty(layerUnclusteredRepPoint, 'visibility', visibility);
      }
    }
  }, [mapRef, isMapReady, styleGeneration, selectedRegions, regionConfig]);

  return { isLoading, error };
}
