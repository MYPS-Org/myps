import React from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppNavbar from './AppNavbar';
import { SidebarLayout } from '../components/tailwindui/sidebar-layout';

const DashboardLayout: React.FC = () => (
  <SidebarLayout
    navbar={<AppNavbar />}
    sidebar={<AppSidebar />}
  >
    <Outlet />
  </SidebarLayout>
);

export default DashboardLayout;
