import React from 'react';
import { Checkbox } from '../../tailwindui/checkbox';
import type { LayerVisibilityState, MapLayerDefinition } from './types';

interface LayerControlWidgetProps {
  layers: MapLayerDefinition[];
  visibility: LayerVisibilityState;
  onToggle: (id: string) => void;
}

const LayerControlWidget: React.FC<LayerControlWidgetProps> = ({ layers, visibility, onToggle }) => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '10px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '12px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: 999,
        fontSize: '12px',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Layers</div>
      {layers.map((layer) => (
        <label
          key={layer.id}
          style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', cursor: 'pointer' }}
        >
          <Checkbox
            checked={visibility[layer.id] ?? true}
            onChange={() => onToggle(layer.id)}
            className="mr-2"
          />
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              background: layer.color,
              marginRight: '8px',
              flexShrink: 0,
            }}
          />
          <span>{layer.label}</span>
        </label>
      ))}
    </div>
  );
};

export default LayerControlWidget;
