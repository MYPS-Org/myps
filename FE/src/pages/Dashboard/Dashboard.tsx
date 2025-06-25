import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/tailwindui/button';
import { Heading } from '../../components/tailwindui/heading';
import { Text } from '../../components/tailwindui/text';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <Heading level={1}>Welcome to Dashboard</Heading>
              <Text className="mt-2">
                Hello, {user?.FirstName} {user?.LastName}!
              </Text>
            </div>
            <Button onClick={handleLogout} color="red">
              Sign Out
            </Button>
          </div>

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
      </div>
    </div>
  );
};

export default Dashboard;
