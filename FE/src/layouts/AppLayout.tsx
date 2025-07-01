import React from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppNavbar from './AppNavbar';

const DashboardLayout: React.FC = () => (
  <div className="min-h-screen xl:flex bg-gray-50 transition-colors duration-200">
    <div className='theme-secondary-bg transition-colors duration-200'>
        <AppSidebar/>
    </div>
    <div className='w-full'>
        <div className='theme-primary-bg transition-colors duration-200'>
        <AppNavbar/>
        </div>
        <main className="bg-white transition-colors duration-200">
            <Outlet/>
        </main>
    </div>
  </div>
);

export default DashboardLayout;
