import { useState } from "react";
import type { Activity } from '../Model.d';


interface ActivitySectionProps {
  initialData?: Activity[];
}

const ActivitySection: React.FC<ActivitySectionProps> = ({ initialData }) => {
  const [activities, setActivities] = useState<Activity[]>(initialData || []);

  const handleAddActivity = () => {
    const newActivity: Activity = {
      Id: activities.length + 1,
      Description: '',
      Date: new Date().toISOString().split('T')[0],
      Status: 'Pending',
    };
    setActivities([...activities, newActivity]);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activities</h2>
        
        <div className="space-y-4">
          {activities.map(activity => (
            <div key={activity.Id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-600">T</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-800">{activity.Description}</p>
                <p className="text-xs text-gray-500 mt-1">{activity.Date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
  );
};

export default ActivitySection;