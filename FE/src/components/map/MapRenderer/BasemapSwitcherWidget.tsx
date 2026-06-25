import React from 'react';
import { BASEMAPS, type BasemapId } from './mapStyle';

interface BasemapSwitcherWidgetProps {
  current: BasemapId;
  onChange: (id: BasemapId) => void;
}

const BasemapSwitcherWidget: React.FC<BasemapSwitcherWidgetProps> = ({ current, onChange }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '6px 8px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: 1,
        fontSize: '12px',
      }}
    >
      <select
        value={current}
        onChange={(e) => onChange(e.target.value as BasemapId)}
        style={{ border: 'none', background: 'transparent', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
      >
        {Object.values(BASEMAPS).map((basemap) => (
          <option key={basemap.id} value={basemap.id}>
            {basemap.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default BasemapSwitcherWidget;
