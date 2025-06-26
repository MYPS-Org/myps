import React from 'react';
import { Outlet } from 'react-router-dom';
import AppNavbar from './AppNavbar';
import AppSidebar from './AppSidebar';

const DashboardLayout: React.FC = () => (
  <div className="flex min-h-screen">
    <AppSidebar />
    <div className="flex flex-col flex-1">
      <AppNavbar />
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  </div>
);

export default DashboardLayout;
