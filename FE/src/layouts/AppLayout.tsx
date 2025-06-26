import React from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppNavbar from './AppNavbar';

const DashboardLayout: React.FC = () => (
  <div className="min-h-screen xl:flex">
    <div className='bg-gray-100'>
        <AppSidebar/>
    </div>
    <div className='w-full'>
        <div className='bg-gray-100'>
        <AppNavbar/>
        </div>
        <main>
            <Outlet/>
        </main>
    </div>
  </div>
);

export default DashboardLayout;
