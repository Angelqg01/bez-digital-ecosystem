import React from 'react';
import { Outlet } from 'react-router-dom';
import TopNavbar from '../layouts/components/TopNavbar';
import LeftSidebar from '../layouts/components/LeftSidebar';
import RightSidebar from '../layouts/components/RightSidebar';
import RightSidebarToggle from '../components/RightSidebarToggle';
import { RightSidebarProvider, useRightSidebar } from '../context/RightSidebarContext';
import GoogleTranslateWidget from '../components/ui/GoogleTranslateWidget';
import BackendStatusBanner from '../components/BackendStatusBanner';

// Componente interno que usa el contexto
function AppLayoutContent() {
    const { isOpen, isMobile } = useRightSidebar();

    return (
        <div className="min-h-screen bg-dark-background dark:bg-light-background text-dark-text dark:text-light-text">
            {/* Top navigation bar */}
            <TopNavbar />

            {/* Backend Status Banner */}
            <BackendStatusBanner />

            {/* Google Translate Widget - Global en todas las páginas */}
            <GoogleTranslateWidget position="top-right" />

            <div className={`flex pt-24 max-w-7xl mx-auto transition-all duration-300 ${isOpen && isMobile ? 'overflow-hidden h-screen' : ''
                }`}>
                {/* Left Sidebar - se contrae cuando RightSidebar está abierta en móvil */}
                <aside className={`hidden lg:block pr-4 transition-all duration-300 ${isOpen && isMobile ? 'lg:hidden' : 'w-64'
                    }`}>
                    <LeftSidebar />
                </aside>

                {/* Main Content - se ajusta cuando RightSidebar está abierta */}
                <main className={`flex-1 px-4 transition-all duration-300 ${isOpen && isMobile ? 'hidden' : ''
                    }`}>
                    <Outlet />
                </main>

                {/* Right Sidebar - responsive */}
                <aside className="hidden xl:block w-80 pl-4">
                    <RightSidebar />
                </aside>

                {/* Toggle button para móvil - solo visible en < xl */}
                <RightSidebarToggle />

                {/* Right Sidebar móvil - renderizado por RightSidebar component */}
            </div>
        </div>
    );
}

// Componente principal que provee el contexto
export default function AppLayout() {
    return (
        <RightSidebarProvider>
            <AppLayoutContent />
        </RightSidebarProvider>
    );
}
