import React, { useState } from 'react';
import LightHeader from './LightHeader';
import LightSidebar from './LightSidebar';

/**
 * MAIN LAYOUT - Light Mode Design
 * Layout principal que integra Header + Sidebar + Content
 * Totalmente responsivo (Mobile-First)
 */
export default function LightLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div className="min-h-screen bg-light-bg dark:bg-dark-background">
            {/* === HEADER === */}
            <LightHeader
                onMenuToggle={toggleSidebar}
                isMenuOpen={sidebarOpen}
            />

            {/* === MAIN CONTAINER === */}
            <div className="flex">

                {/* === SIDEBAR === */}
                <LightSidebar
                    isOpen={sidebarOpen}
                    onClose={closeSidebar}
                />

                {/* === MAIN CONTENT AREA === */}
                <main className="flex-1 min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)]">
                    <div className="container-responsive py-6 lg:py-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
