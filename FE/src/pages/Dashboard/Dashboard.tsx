import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Heading } from '../../components/tailwindui/heading';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div>
      <Heading level={1} className="mb-6">Dashboard</Heading>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900">User Info</h3>
          <p className="text-blue-700">Username: {user?.UserName}</p>
          <p className="text-blue-700">Role: {user?.UserRole}</p>
          <p className="text-blue-700">Phone: {user?.PhoneNumber}</p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-900">Account Status</h3>
          <p className="text-green-700">Status: Active</p>
          <p className="text-green-700">Credit: ${user?.Credit}</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-900">Quick Actions</h3>
          <p className="text-purple-700">All systems operational</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;