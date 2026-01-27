import React from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppNavbar from './AppNavbar';

const DashboardLayout: React.FC = () => (
  <div className="min-h-screen xl:flex bg-gray-50 transition-colors duration-200">
    <div className='bg-gray-50 shadow-xl transition-colors duration-200'>
      <AppSidebar/>
    </div>
    <div className='max-h-screen w-full overflow-x-auto'>
        <div className='sticky top-0 z-10 bg-gray-50 shadow-md transition-colors duration-200'>
        <AppNavbar/>
        </div>
        <main className="overflow-auto transition-colors duration-200">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px]">
              <Outlet/>
            </div>
        </main>
    </div>
  </div>
);

export default DashboardLayout;
