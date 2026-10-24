export interface ProjectFeatureProperties {
  name?: string;
  dsow?: string;
  work_scope?: string;
  length?: number;
  target_amount?: number;
  target_unit?: string;
  cost_x?: number;
  start_station_limit?: string;
  end_station_limit?: string;
  [key: string]: unknown;
}

export interface MapLayerDefinition {
  id: string;
  label: string;
  color: string;
  matches: (properties: ProjectFeatureProperties) => boolean;
}

export type LayerVisibilityState = Record<string, boolean>;

// Lets each MapRenderer consumer (Project, GIS Playground, ...) declare which raw
// feature properties to show as labeled rows at the top of the popup, since callers
// pass their own property shapes straight through rather than a MapRenderer-owned
// canonical one.
export interface PopupFieldConfig {
  /** Row label, e.g. 'Component Id'. */
  label: string;
  /** Feature property key to read the value from, e.g. 'ComponentId'. Row is omitted when blank/missing. */
  key: string;
}

export interface RegionConfig {
  slug: string;
  label: string;
  color: string;
}

export type RegionFilterMode = 'dropdown' | 'checkbox';

/**
 * Props for RegionFilterWidget.
 *
 * Sentinel value: in dropdown mode, `onSelect` is called with `'__all__'` when
 * the user picks the "All Regions" option. MapRenderer interprets this as
 * "select every region slug".
 */
export interface RegionFilterWidgetProps {
  regions: RegionConfig[];
  /** The set of currently-visible region slugs. */
  selectedRegions: Set<string>;
  mode: RegionFilterMode;
  /**
   * Checkbox mode only: toggle a single region on/off.
   * Receives the region's `slug`.
   */
  onToggle: (slug: string) => void;
  /**
   * Dropdown mode only: select one region or all regions.
   * Receives a region `slug`, or the sentinel `'__all__'` to select all regions
   * (corresponds to the "All Regions" option rendered at the top of the dropdown).
   */
  onSelect: (slug: string) => void;
  /**
   * Checkbox mode only: fly the map camera to this region's extent. Receives
   * the region's `slug`. Triggered by clicking the region's label text (not
   * its checkbox or color swatch, which still only toggle visibility).
   */
  onFlyTo: (slug: string) => void;
  /** Checkbox mode only: check every region at once. */
  onSelectAll: () => void;
  /** Checkbox mode only: uncheck every region at once. */
  onClearAll: () => void;
}
