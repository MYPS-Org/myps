import React from 'react';

interface TargetsProjectionTabProps {
  // Add props as needed
}

const TargetsProjectionTab: React.FC<TargetsProjectionTabProps> = () => {
  return (
    <div className="p-6">
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Targets Analysis</h3>
        <p className="text-gray-500">
          Compare multi-year target projections with annual project achievements.
        </p>
        <p className="text-sm text-gray-400 mt-4">
          This feature will be available soon.
        </p>
      </div>
    </div>
  );
};

export default TargetsProjectionTab;