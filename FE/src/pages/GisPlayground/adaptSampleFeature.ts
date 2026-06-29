import type { ProjectFeatureProperties } from '../../components/map/MapRenderer/types';

interface SampleProperties {
  InfraType?: string;
  ScopeOfWork?: string;
  ProgramName?: string;
  DetailedScope?: string;
  PhysicalTarget?: number;
  TargetUnit?: string;
  StartStationLimit?: string;
  EndStationLimit?: string;
  [key: string]: unknown;
}

// Maps the GIS service's sample property names onto the fields MapRenderer's
// layer matching (work_scope) and popup (buildPopupHtml) already know how to render,
// while keeping every original sample field around for the playground's CRUD panel.
export function adaptSampleFeature(feature: GeoJSON.Feature): GeoJSON.Feature {
  const sample = (feature.properties ?? {}) as SampleProperties;

  const properties: ProjectFeatureProperties = {
    ...sample,
    work_scope: sample.InfraType,
    dsow: sample.ScopeOfWork,
    name: sample.DetailedScope?.trim() || sample.ProgramName,
    target_amount: sample.PhysicalTarget,
    target_unit: sample.TargetUnit,
    start_station_limit: sample.StartStationLimit?.trim() || undefined,
    end_station_limit: sample.EndStationLimit?.trim() || undefined,
  };

  return { ...feature, properties };
}
