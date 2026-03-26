export type UnitType = 'LENGTH' | 'AREA' | 'VOLUME' | 'COUNT';

export const unitTypeMap: Record<string, UnitType> = {
  // =========================
  // LENGTH
  // =========================
  'km': 'LENGTH',
  'lane km': 'LENGTH',
  'lineal meters': 'LENGTH',
  'meters': 'LENGTH',

  // =========================
  // AREA
  // =========================
  'square meters': 'AREA',

  // =========================
  // VOLUME
  // =========================
  'cubic meters': 'VOLUME',

  // =========================
  // COUNT
  // =========================
  'number of 1-storey classrooms': 'COUNT',
  'number of 2-storey classrooms': 'COUNT',
  'number of 3-storey classrooms': 'COUNT',
  'number of 4-storey classrooms': 'COUNT',
  'number of bridges': 'COUNT',
  'number of buildings': 'COUNT',
  'number of classrooms': 'COUNT',
  'number of facilities': 'COUNT',
  'number of hospitals': 'COUNT',
  'number of intersections': 'COUNT',
  'number of laybys': 'COUNT',
  'number of loading and unloading bays': 'COUNT',
  'number of loading bays': 'COUNT',
  'number of pedestrian overpass': 'COUNT',
  'number of projects': 'COUNT',
  'number of school buildings': 'COUNT',
  'number of septage/sewerage plants': 'COUNT',
  'number of signs': 'COUNT',
  'number of traffic signals': 'COUNT',
  'number of turnouts': 'COUNT',
  'number of units': 'COUNT',
  'number of water supply systems': 'COUNT',
};
