import React from 'react';

interface ScheduleProjectionTabProps {
  // Add props as needed
}

const ScheduleProjectionTab: React.FC<ScheduleProjectionTabProps> = () => {
  return (
    <div className="p-6">
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Schedule Analysis</h3>
        <p className="text-gray-500">
          Compare multi-year schedule projections with annual project timelines.
        </p>
        <p className="text-sm text-gray-400 mt-4">
          This feature will be available soon.
        </p>
      </div>
    </div>
  );
};

export default ScheduleProjectionTab;