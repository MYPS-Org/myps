import React from "react";
import type { Activity } from '../Model.d';

interface ActivitySectionProps {
  activities: Activity[];
}

const ActivitySection: React.FC<ActivitySectionProps> = ({ activities }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Activities</h2>
      
      <div className="space-y-4">
        {activities.map(activity => (
          <div key={activity.Id} className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-gray-900">{activity.Description}</p>
                <p className="text-xs text-gray-500 mt-1">{activity.Date}</p>
              </div>
            </div>
          </div>
        ))}
        
        {activities.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No activities recorded yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivitySection;