
import React from 'react';
import SidebarDrawer from '../SidebarDrawer';
import Header from './Header';
import HealthStatus from '../HealthStatus';
import GuidedTour from '../GuidedTour';
// import RightSidebar from '../../layouts/components/RightSidebar'; // DISABLED: Pantalla completa
// import RightSidebarToggle from '../RightSidebarToggle'; // DISABLED: Pantalla completa
// import { RightSidebarProvider, useRightSidebar } from '../../context/RightSidebarContext'; // DISABLED: Pantalla completa
import MobileMenu from '../social-feed/MobileMenu';
import { useLocation } from 'react-router-dom';
import { classifyPath, SHOW_CLASSIFICATION_STAMPS } from '../../config/pageClassification';
import ClassificationStamp from '../ClassificationStamp';

// Componente simplificado - Pantalla completa
const MainLayout = ({ children }) => {
  const { pathname } = useLocation();
  const sello = classifyPath(pathname);
  // TODO: Integrar con sistema de notificaciones real
  // Ejemplo: const { unreadCount } = useNotifications();
  const notificationsCount = 0; // Contador dinámico de notificaciones

  return (
    <div className="flex h-screen overflow-hidden bg-light-bg dark:bg-dark-background" style={{ color: 'var(--text-primary)' }}>
      {/* Left Sidebar - Fixed */}
      <SidebarDrawer />

      {/* Main Content Area - PANTALLA COMPLETA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Sticky */}
        <Header />

        {/* Content Container */}
        <div className="flex flex-1 overflow-hidden h-full">
          {/* Main Content - Scrollable - PANTALLA COMPLETA */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <HealthStatus />
            {/* Sello de clasificación de la página (borrador, no bloquea el acceso) */}
            {SHOW_CLASSIFICATION_STAMPS && sello && (
              <div className="flex items-center gap-2 px-4 py-1 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <span>Sello de esta página:</span>
                <ClassificationStamp level={sello.level} />
                {sello.nota && <span className="truncate">· {sello.nota}</span>}
              </div>
            )}
            <div className="w-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Menu - Visible en todas las páginas en modo móvil */}
      <MobileMenu notificationsCount={notificationsCount} />

      {/* Recorrido animado "Cómo usar" — fuera del gate de auth de las páginas */}
      <GuidedTour />
    </div>
  );
};

export default MainLayout;
