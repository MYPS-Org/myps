import type { MapLayerDefinition } from './types';

const hasWorkScope = (substring: string) => (properties: { work_scope?: string }) =>
  (properties.work_scope ?? '').toLowerCase().includes(substring);

export const DEFAULT_MAP_LAYERS: MapLayerDefinition[] = [
  {
    id: 'ndp',
    label: 'Network Development',
    color: '#FF8C00',
    matches: hasWorkScope('ndp'),
  },
  {
    id: 'app',
    label: 'Asset Presevation',
    color: '#0096FF',
    matches: hasWorkScope('app'),
  },
  {
    id: 'construction',
    label: 'Construction',
    color: '#00C800',
    matches: hasWorkScope('construction'),
  },
  {
    id: 'other',
    label: 'Other',
    color: '#FF0000',
    matches: () => true,
  },
];
