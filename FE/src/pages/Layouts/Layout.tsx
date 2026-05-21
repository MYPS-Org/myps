import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Heading } from '../../components/tailwindui/heading';
import { Text } from '../../components/tailwindui/text';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="flex flex-col bg-gray-100">
        <div className="flex w-full max-w-6xl">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-md rounded-lg p-6 mr-8 flex flex-col h-full">
                <Heading level={2} className="mb-6">Menu</Heading>
                <nav className="flex flex-col gap-4">
                    {/* <Button variant="ghost" className="justify-start">Dashboard</Button> */}
                    {/* <Button variant="ghost" className="justify-start">Profile</Button> */}
                    {/* <Button variant="ghost" className="justify-start">Settings</Button> */}
                    {/* <Button variant="ghost" className="justify-start" onClick={handleLogout}>Logout</Button> */}
                </nav>
            </aside>
            {/* Main Content */}
            <main className="flex-1 bg-white rounded-lg shadow-md p-8">
                <Heading level={1} className="mb-4">Welcome, {user?.Name || 'User'}!</Heading>
                <Text className="text-gray-600">This is your dashboard. Select an option frsom the sidebar.</Text>
            </main>
        </div>
    </div>
  );
};

export default Dashboard;
