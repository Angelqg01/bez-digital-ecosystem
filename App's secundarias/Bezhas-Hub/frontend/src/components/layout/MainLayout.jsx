
import React, { useState } from 'react';
import SidebarDrawer from '../SidebarDrawer';
import Header from './Header';
import HealthStatus from '../HealthStatus';
// import RightSidebar from '../../layouts/components/RightSidebar'; // DISABLED: Pantalla completa
// import RightSidebarToggle from '../RightSidebarToggle'; // DISABLED: Pantalla completa
// import { RightSidebarProvider, useRightSidebar } from '../../context/RightSidebarContext'; // DISABLED: Pantalla completa
import MobileMenu from '../social-feed/MobileMenu';

// Componente simplificado - Pantalla completa
const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // TODO: Integrar con sistema de notificaciones real
  // Ejemplo: const { unreadCount } = useNotifications();
  const notificationsCount = 0; // Contador dinámico de notificaciones

  return (
    <div className="flex h-screen overflow-hidden bg-light-bg dark:bg-dark-background" style={{ color: 'var(--text-primary)' }}>
      {/* Left Sidebar - Fixed */}
      <SidebarDrawer open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* Main Content Area - PANTALLA COMPLETA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Sticky */}
        <Header />

        {/* Content Container */}
        <div className="flex flex-1 overflow-hidden h-full">
          {/* Main Content - Scrollable - PANTALLA COMPLETA */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <HealthStatus />
            <div className="w-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Menu - Visible en todas las páginas en modo móvil */}
      <MobileMenu notificationsCount={notificationsCount} />
    </div>
  );
};

export default MainLayout;
