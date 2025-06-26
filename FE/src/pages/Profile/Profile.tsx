import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Heading } from '../../components/tailwindui/heading';

const Profile: React.FC = () => {
  const { user } = useAuth();

  return (
    <div>
      <Heading level={1} className="mb-6">Profile</Heading>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">User Information</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <p className="mt-1">{user?.FirstName} {user?.LastName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <p className="mt-1">{user?.UserName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
            <p className="mt-1">{user?.PhoneNumber}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <p className="mt-1">{user?.UserRole}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;