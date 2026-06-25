import React from 'react';

export const MapLoadingOverlay: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(255, 255, 255, 0.9)',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      zIndex: 1000,
    }}
  >
    <p style={{ margin: 0, fontSize: '14px' }}>Loading map data...</p>
  </div>
);

export const MapErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      position: 'absolute',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(239, 68, 68, 0.95)',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      zIndex: 1000,
      fontSize: '14px',
    }}
  >
    {message}
  </div>
);

export const MapEmptyState: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(255, 255, 255, 0.9)',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      zIndex: 1,
      textAlign: 'center',
    }}
  >
    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>No map data available</p>
  </div>
);
