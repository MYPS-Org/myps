import React, { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import './mapPopup.css';
import { useMapLibreMap } from './useMapLibreMap';
import { useProjectMapLayers, explodeMultiPoints } from './useProjectMapLayers';
import { useClusteredPointLayer, getUnclusteredPointLayerIds } from './useClusteredPointLayer';
import { computeBoundsAndCentroid, representativePointForLineString, type BoundsAndCentroid } from './geoJsonUtils';
import { DEFAULT_MAP_LAYERS } from './layerConfig';
// Layers widget commented out for now
// import LayerControlWidget from './LayerControlWidget';
import BasemapSwitcherWidget from './BasemapSwitcherWidget';
import ExportPdfWidget from './ExportPdfWidget';
import RegionFilterWidget from './RegionFilterWidget';
import { MapEmptyState, MapErrorBanner, MapLoadingOverlay } from './MapStatusOverlays';
import type { MapLayerDefinition, PopupFieldConfig, RegionConfig, RegionFilterMode } from './types';

/** No regions configured — a module-level constant so the default prop value is
 *  referentially stable (regionConfig is an effect dependency inside useClusteredPointLayer). */
const NO_REGIONS: RegionConfig[] = [];

interface MapRendererProps {
  geoJsonData?: GeoJSON.FeatureCollection | null;
  height?: string;
  projectId?: string;
  programId?: string;
  layers?: MapLayerDefinition[];
  popupFields?: PopupFieldConfig[];
  // Off by default: a single-project map's lines are usually zoomed in on already, and this
  // changes click/hover targets at low zoom, so it's opt-in per page rather than a blanket
  // behavior change for every MapRenderer consumer. The Program map turns it on since it's the
  // one place short road segments can be scattered across the whole country at once.
  representativePointAtLowZoom?: boolean;
  // Off by default, same reasoning: groups nearby points (genuine or representativePointAtLowZoom's
  // synthetic ones) into a count badge instead of rendering every one individually. A dense
  // nationwide program can otherwise render as an unreadable solid mass of overlapping dots.
  // Mutually exclusive with regionConfig in practice -- a caller passing regionConfig should
  // leave this off, since region-clustering already takes over point rendering (see
  // ProgramDetail.tsx, which pre-splits its data into lines-only geoJsonData and
  // points-only input for regionConfig to avoid double-rendering the same points twice).
  clusterPoints?: boolean;
  /**
   * Region configurations for the per-region cluster overlay. When provided, every Point/
   * MultiPoint feature in `geoJsonData` (MultiPoint exploded into individual points first --
   * MapLibre's clustering only indexes plain Point geometry) is grouped into one independent
   * clustered source per region, colored by region instead of by work type, with a
   * RegionFilterWidget to show/hide specific regions. A LineString with a region label ALSO
   * contributes a representative point to that same cluster source (so a region's bubble count
   * reflects everything it owns, not just its Point-shaped features) -- its actual line geometry
   * still renders through the normal per-work-type layers once zoomed in past
   * LINE_REPRESENTATIVE_POINT_MAX_ZOOM, same as always. Both the real line and its clustered
   * representative point are ALSO filtered by the same checkbox selection (by their own
   * `Region` property) so unchecking a region hides everything it owns. Features with no Region
   * label pass through regardless of selection, since no checkbox represents them, and keep
   * their line's representative point standalone (not clustered) via the normal mechanism.
   */
  regionConfig?: RegionConfig[];
  /**
   * Controls the filter widget UI: 'dropdown' for single-select, 'checkbox' (default) for
   * multi-select. The underlying architecture always supports multi-select regardless of mode.
   */
  regionFilterMode?: RegionFilterMode;
  /** Used as the PDF export's header line and filename. Falls back to a generic "map" filename
   *  when omitted. */
  exportTitle?: string;
}

const MapRenderer: React.FC<MapRendererProps> = ({
  geoJsonData,
  height = '400px',
  layers = DEFAULT_MAP_LAYERS,
  popupFields,
  representativePointAtLowZoom = false,
  clusterPoints = false,
  regionConfig = NO_REGIONS,
  regionFilterMode = 'checkbox',
  exportTitle,
}) => {
  const { containerRef, fullscreenContainerRef, mapRef, isMapReady, basemap, setBasemap, styleGeneration } =
    useMapLibreMap();

  // All regions are visible by default. regionConfig starts empty (geoJsonData hasn't
  // loaded yet on first render) and is only populated once the fetch resolves, so a
  // one-time useState initializer would capture that empty set and never update --
  // every checkbox would render unchecked once the real regions arrive. Resync whenever
  // regionConfig's reference changes instead (new program load/dataset refresh), which
  // also naturally resets everything to checked on each fresh dataset.
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(
    () => new Set(regionConfig.map((r) => r.slug))
  );
  useEffect(() => {
    setSelectedRegions(new Set(regionConfig.map((r) => r.slug)));
  }, [regionConfig]);

  // selectedRegions holds slugs (checkbox identity); feature.properties.Region holds the raw
  // label text. Resolve once per selection change instead of re-deriving it inside the filter
  // below on every render.
  const selectedRegionLabels = useMemo(() => {
    const labels = new Set<string>();
    regionConfig.forEach((r) => {
      if (selectedRegions.has(r.slug)) labels.add(r.label);
    });
    return labels;
  }, [regionConfig, selectedRegions]);

  // Region label -> color, fed to useProjectMapLayers so its representative-point sublayer (a
  // LineString's low-zoom stand-in) colors by region instead of defaulting to the flat
  // work-type layer color every other sublayer uses -- without this, those points silently
  // ignored the Regions legend's colors entirely.
  const regionColorMap = useMemo(() => {
    if (regionConfig.length === 0) return undefined;
    return Object.fromEntries(regionConfig.map((r) => [r.label, r.color]));
  }, [regionConfig]);

  // Fed to useProjectMapLayers so ITS click handler also picks up region points when checking
  // for overlapping features -- see extraInteractiveLayerIds' doc comment there for why a
  // region's real Point and an overlapping LineString's representative point need to merge
  // into one popup instead of belonging to two separate, uncoordinated click systems.
  const regionPointLayerIds = useMemo(
    () => getUnclusteredPointLayerIds(regionConfig),
    [regionConfig]
  );

  // When regionConfig is active, points move entirely to the region-clustered system below --
  // the per-work-type layers only get LineStrings/Polygons, so the same point never renders
  // twice. Without regionConfig this is just geoJsonData unchanged (every other caller is
  // unaffected).
  //
  // Lines are ALSO filtered by selectedRegionLabels here (not just points) -- otherwise
  // unchecking a region only hides its clustered points while that region's LineStrings (and,
  // via representativePointAtLowZoom, their own synthetic representative points rendered
  // through this same per-work-type layer) kept showing regardless of the checkbox, which looks
  // exactly like a leftover point that refuses to disappear. Features with no Region label at
  // all (not represented by any checkbox) always pass through rather than vanishing with no way
  // to bring them back.
  const geoJsonDataForWorkTypeLayers = useMemo(() => {
    if (regionConfig.length === 0 || !geoJsonData) return geoJsonData;
    return {
      type: 'FeatureCollection' as const,
      features: geoJsonData.features.filter((f) => {
        if (f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint') return false;
        const region = f.properties?.Region;
        if (typeof region !== 'string' || !region.trim()) return true;
        return selectedRegionLabels.has(region);
      }),
    };
  }, [geoJsonData, regionConfig, selectedRegionLabels]);

  const { isLoading, error } = useProjectMapLayers(
    mapRef,
    isMapReady,
    styleGeneration,
    geoJsonDataForWorkTypeLayers,
    layers,
    popupFields,
    representativePointAtLowZoom,
    clusterPoints,
    // regionConfig splits geoJsonData into a lines-only subset (this hook) and a points-only
    // subset (useClusteredPointLayer below) fed to two otherwise-independent hooks. Each used to
    // run its own fitBounds over just its own subset, fighting over the camera -- whichever
    // fired last won, framing the view to half the data (e.g. a single short road segment)
    // instead of the full picture. The unified fitBounds effect further down handles it instead.
    regionConfig.length > 0,
    regionColorMap,
    regionPointLayerIds,
    // See groupFeaturesByLayer's own doc comment on this param: when true, a LineString WITH a
    // region label does NOT get a representative point from THIS hook, because clusteredPointData
    // below generates one instead and feeds it into that region's cluster source -- so it can
    // actually merge with nearby real points into one shared count, which is the whole point of
    // doing this at all (previously a line's low-zoom stand-in always rendered standalone,
    // completely outside the clustering system, even when a real point sat right next to it).
    regionConfig.length > 0
  );

  // All region labels (regardless of current checkbox selection -- clustering runs on the full
  // dataset; selectedRegions only controls per-region layer VISIBILITY, handled separately
  // inside useClusteredPointLayer). Used below to decide which LineStrings get folded into the
  // clustered system instead of the always-standalone one in useProjectMapLayers.
  const allRegionLabels = useMemo(() => new Set(regionConfig.map((r) => r.label)), [regionConfig]);

  // Point/MultiPoint features (MultiPoint exploded into individual points -- see
  // useClusteredPointLayer's own doc comment for why), PLUS a synthetic representative point for
  // every LineString that has one of our regions -- same "where is this, roughly" marker
  // groupFeaturesByLayer would otherwise generate, but routed into the clustered system instead
  // so it can merge into that region's count alongside real points (a region's cluster bubble
  // should mean "this many things in this region," not "this many POINT-shaped things"). A
  // LineString with no region, or one not in regionConfig, keeps using the original always-
  // standalone representative point from useProjectMapLayers instead (see the matching
  // regionClusteringActive branch there).
  const clusteredPointData = useMemo(() => {
    if (regionConfig.length === 0 || !geoJsonData) return null;
    const pointsOnly: GeoJSON.Feature[] = geoJsonData.features.filter(
      (f) => f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint'
    );
    const regionedLineRepresentativePoints: GeoJSON.Feature[] = geoJsonData.features
      .filter((f) => f.geometry.type === 'LineString' && allRegionLabels.has(f.properties?.Region))
      .map((f) => ({
        type: 'Feature',
        properties: { ...f.properties, __representativePoint: true },
        geometry: {
          type: 'Point',
          coordinates: representativePointForLineString((f.geometry as GeoJSON.LineString).coordinates),
        },
      }));
    return explodeMultiPoints({
      type: 'FeatureCollection',
      features: [...pointsOnly, ...regionedLineRepresentativePoints],
    });
  }, [geoJsonData, regionConfig, allRegionLabels]);

  // Hook must be called unconditionally per React rules.
  // When regionConfig is empty the hook no-ops cleanly — see useClusteredPointLayer.
  useClusteredPointLayer(
    mapRef,
    isMapReady,
    styleGeneration,
    clusteredPointData,
    regionConfig,
    selectedRegions,
    // See the matching comment on the useProjectMapLayers call above.
    regionConfig.length > 0
  );

  // Unified fitBounds over the FULL original geoJsonData (lines + points together), covering
  // the gap left by disabling both sub-hooks' own fitBounds above. Runs once per new geoJsonData
  // reference, same "only on an actual data change" pattern the sub-hooks used individually.
  const lastFitDataRef = useRef<GeoJSON.FeatureCollection | null | undefined>(undefined);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || regionConfig.length === 0 || !geoJsonData) return;
    if (lastFitDataRef.current === geoJsonData) return;
    lastFitDataRef.current = geoJsonData;

    const { bounds, centroid } = computeBoundsAndCentroid(geoJsonData);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1000 });
    } else {
      map.setCenter(centroid);
    }
  }, [mapRef, isMapReady, geoJsonData, regionConfig]);

  // Checkbox mode: toggle a single region's visibility on/off.
  const onRegionToggle = (slug: string) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  // Dropdown mode: select one region, or all when slug === '__all__'.
  const onRegionSelect = (slug: string) => {
    if (slug === '__all__') {
      setSelectedRegions(new Set(regionConfig.map((r) => r.slug)));
    } else {
      setSelectedRegions(new Set([slug]));
    }
  };

  // Checkbox mode: check/uncheck every region at once.
  const onRegionSelectAll = () => {
    setSelectedRegions(new Set(regionConfig.map((r) => r.slug)));
  };
  const onRegionClearAll = () => {
    setSelectedRegions(new Set());
  };

  // Pure bounds lookup for a single region -- computed from the FULL original geoJsonData
  // (every geometry type for that region, not just its clustered points), same source the
  // unified fitBounds effect above uses for the whole-program view. Shared by the click-to-fly
  // handler below (animated, for a user-initiated click) and ExportPdfWidget's per-region pages
  // (instant, run in a loop) so the "what counts as this region's extent" logic only lives once.
  const getRegionBounds = (slug: string): BoundsAndCentroid | null => {
    if (!geoJsonData) return null;
    const region = regionConfig.find((r) => r.slug === slug);
    if (!region) return null;
    const regionFeatures = geoJsonData.features.filter((f) => f.properties?.Region === region.label);
    if (regionFeatures.length === 0) return null;
    return computeBoundsAndCentroid({ type: 'FeatureCollection', features: regionFeatures });
  };

  // Flies the camera to a region's own extent -- scattered regions on a nationwide program are
  // otherwise only reachable by manually panning/zooming to find them.
  const onRegionFlyTo = (slug: string) => {
    const map = mapRef.current;
    if (!map) return;
    const result = getRegionBounds(slug);
    if (!result) return;
    const { bounds, centroid } = result;
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1000 });
    } else {
      map.flyTo({ center: centroid, zoom: 10, duration: 1000 });
    }
  };

  return (
    <div ref={fullscreenContainerRef} style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />

      {isLoading && <MapLoadingOverlay />}
      {error && <MapErrorBanner message={error} />}
      {!geoJsonData && !isLoading && <MapEmptyState />}

      <BasemapSwitcherWidget current={basemap} onChange={setBasemap} />
      {geoJsonData && (
        <ExportPdfWidget
          mapRef={mapRef}
          title={exportTitle}
          regions={regionConfig}
          selectedRegions={selectedRegions}
          setSelectedRegions={setSelectedRegions}
          getRegionBounds={getRegionBounds}
        />
      )}
      {/* Layers widget commented out for now */}
      {/* <LayerControlWidget layers={layers} visibility={visibility} onToggle={toggleLayer} /> */}

      {/* Top-right, own internal positioning. Renders nothing when regionConfig is empty. */}
      {regionConfig.length > 0 && (
        <RegionFilterWidget
          regions={regionConfig}
          selectedRegions={selectedRegions}
          mode={regionFilterMode}
          onToggle={onRegionToggle}
          onSelect={onRegionSelect}
          onFlyTo={onRegionFlyTo}
          onSelectAll={onRegionSelectAll}
          onClearAll={onRegionClearAll}
        />
      )}
    </div>
  );
};

export default MapRenderer;
