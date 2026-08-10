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
