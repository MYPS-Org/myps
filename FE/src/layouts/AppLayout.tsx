import React from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppNavbar from './AppNavbar';

const DashboardLayout: React.FC = () => (
  <div className="min-h-screen xl:flex bg-gray-50 transition-colors duration-200">
    <div className='bg-gray-50 shadow-xl transition-colors duration-200'>
      <AppSidebar/>
    </div>
    <div className='w-full overflow-x-auto'>
        <div className='bg-gray-50 shadow-md transition-colors duration-200'>
        <AppNavbar/>
        </div>
        <main className="transition-colors duration-200">
            <Outlet/>
        </main>
    </div>
  </div>
);

export default DashboardLayout;
