import type { MapLayerDefinition } from '../../components/map/MapRenderer/types';

const hasWorkScope = (value: string) => (properties: { work_scope?: string }) =>
  (properties.work_scope ?? '').toLowerCase() === value;

export const PLAYGROUND_MAP_LAYERS: MapLayerDefinition[] = [
  {
    id: 'bridges',
    label: 'Bridges',
    color: '#9333EA',
    matches: hasWorkScope('bridges'),
  },
  {
    id: 'roads',
    label: 'Roads',
    color: '#0D9488',
    matches: hasWorkScope('roads'),
  },
  {
    id: 'other',
    label: 'Other',
    color: '#FF0000',
    matches: () => true,
  },
];
