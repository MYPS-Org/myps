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
