import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, TrendingUp, Users, UserPlus, Activity } from 'lucide-react';
import { useRightSidebar } from '../../context/RightSidebarContext';
import TrendingWidget from '../../components/widgets/TrendingWidget';
import ActiveUsersWidget from '../../components/widgets/ActiveUsersWidget';
import RecommendedUsersWidget from '../../components/widgets/RecommendedUsersWidget';
import RecentActivityWidget from '../../components/widgets/RecentActivityWidget';

export default function RightSidebar() {
    const {
        isOpen,
        isMobile,
        closeSidebar,
        sidebarWidth,
        isCollapsed,
        MIN_WIDTH,
        MAX_WIDTH,
        updateSidebarWidth,
        toggleCollapse
    } = useRightSidebar();

    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef(null);

    // Prevenir scroll cuando está abierto en móvil
    useEffect(() => {
        if (isOpen && isMobile) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, isMobile]);

    // Handle resize
    const startResizing = (e) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing || !sidebarRef.current) return;

            const containerRight = sidebarRef.current.getBoundingClientRect().right;
            const newWidth = containerRight - e.clientX;
            updateSidebarWidth(newWidth);
        };

        const handleTouchMove = (e) => {
            if (!isResizing || !sidebarRef.current) return;

            const touch = e.touches[0];
            const containerRight = sidebarRef.current.getBoundingClientRect().right;
            const newWidth = containerRight - touch.clientX;
            updateSidebarWidth(newWidth);
        };

        const stopResizing = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('mouseup', stopResizing);
            document.addEventListener('touchend', stopResizing);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('mouseup', stopResizing);
            document.removeEventListener('touchend', stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, updateSidebarWidth]);

    // Iconos para modo colapsado
    const CollapsedIcons = () => (
        <div className="flex flex-col items-center gap-6 py-6">
            <button
                onClick={toggleCollapse}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
                title="Expandir sidebar"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" title="Trending" />
            <Users className="w-5 h-5 text-green-600 dark:text-green-400" title="Usuarios Activos" />
            <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" title="Sugeridos" />
            <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" title="Actividad" />
        </div>
    );

    // Contenido completo de la sidebar
    const SidebarContent = () => (
        <div className="h-full flex">
            {/* Resize Handle */}
            {!isMobile && (
                <div
                    onMouseDown={startResizing}
                    onTouchStart={startResizing}
                    className="w-1 hover:w-2 bg-transparent hover:bg-purple-600/40 dark:hover:bg-purple-400/40 cursor-ew-resize transition-all flex-shrink-0 relative group"
                >
                    <div className="absolute inset-0 -left-2 -right-2" />
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-16 bg-purple-600/20 dark:bg-purple-400/20 rounded-r opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            )}

            {/* Contenido principal */}
            <div className="flex-1 overflow-hidden flex flex-col bg-light-bg dark:bg-dark-background border-l border-light-border dark:border-gray-700">
                {/* Header */}
                {isMobile ? (
                    <div className="sticky top-0 z-10 bg-light-bg dark:bg-dark-background border-b border-light-border dark:border-gray-700 p-4 flex items-center justify-between backdrop-blur-sm bg-white/95 dark:bg-gray-900/95">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Actividades</h2>
                        <button
                            onClick={closeSidebar}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-white"
                            aria-label="Cerrar sidebar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                ) : !isCollapsed && (
                    <div className="sticky top-0 z-10 bg-light-bg dark:bg-dark-background border-b border-light-border dark:border-gray-700 p-4 flex items-center justify-between backdrop-blur-sm bg-white/95 dark:bg-gray-900/95">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Actividades</h2>
                        <button
                            onClick={toggleCollapse}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-white"
                            title="Colapsar sidebar"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Contenido widgets o iconos */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    {isCollapsed ? (
                        <CollapsedIcons />
                    ) : (
                        <div className="p-4 space-y-4">
                            <TrendingWidget />
                            <ActiveUsersWidget />
                            <RecommendedUsersWidget />
                            <RecentActivityWidget />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // Renderizado condicional según modo
    if (isMobile) {
        return (
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/50 z-40"
                            onClick={closeSidebar}
                        />

                        {/* Sidebar móvil */}
                        <motion.aside
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-light-bg dark:bg-dark-background z-50 shadow-2xl"
                        >
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        );
    }

    // Desktop - sidebar redimensionable que se colapsa hacia la derecha
    return (
        <motion.div
            ref={sidebarRef}
            animate={{
                width: sidebarWidth,
                x: 0
            }}
            transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 0.8
            }}
            className="h-full relative"
        >
            <SidebarContent />
        </motion.div>
    );
}
