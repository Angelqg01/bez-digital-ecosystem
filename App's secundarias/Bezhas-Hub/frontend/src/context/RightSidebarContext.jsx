import React, { createContext, useContext, useState, useEffect } from 'react';

const RightSidebarContext = createContext();

export const useRightSidebar = () => {
    const context = useContext(RightSidebarContext);
    if (!context) {
        throw new Error('useRightSidebar must be used within RightSidebarProvider');
    }
    return context;
};

export const RightSidebarProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isHidden, setIsHidden] = useState(false); // Control manual de visibilidad
    const [sidebarWidth, setSidebarWidth] = useState(320); // Ancho inicial: 320px
    const [isCollapsed, setIsCollapsed] = useState(false); // Colapsado a iconos

    const MIN_WIDTH = 64; // Ancho mínimo (solo iconos)
    const MAX_WIDTH = 480; // Ancho máximo
    const DEFAULT_WIDTH = 320; // Ancho por defecto

    // Detectar tamaño de pantalla
    useEffect(() => {
        const checkScreenSize = () => {
            const mobile = window.innerWidth < 1280; // xl breakpoint
            setIsMobile(mobile);

            // Auto-cerrar en desktop
            if (!mobile) {
                setIsOpen(false);
            }
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);

        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Cargar ancho guardado
    useEffect(() => {
        const savedWidth = localStorage.getItem('rightSidebarWidth');
        if (savedWidth) {
            const width = parseInt(savedWidth);
            setSidebarWidth(width);
            setIsCollapsed(width <= MIN_WIDTH + 20);
        }
    }, []);

    const toggleSidebar = () => {
        setIsOpen(prev => !prev);
    };

    const closeSidebar = () => {
        setIsOpen(false);
    };

    const openSidebar = () => {
        setIsOpen(true);
    };

    const hideSidebar = () => {
        setIsHidden(true);
    };

    const showSidebar = () => {
        setIsHidden(false);
    };

    const updateSidebarWidth = (newWidth) => {
        const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
        setSidebarWidth(clampedWidth);
        setIsCollapsed(clampedWidth <= MIN_WIDTH + 20);
        localStorage.setItem('rightSidebarWidth', clampedWidth.toString());
    };

    const toggleCollapse = () => {
        if (isCollapsed) {
            updateSidebarWidth(DEFAULT_WIDTH);
        } else {
            updateSidebarWidth(MIN_WIDTH);
        }
    };

    return (
        <RightSidebarContext.Provider
            value={{
                isOpen,
                isMobile,
                isHidden,
                sidebarWidth,
                isCollapsed,
                MIN_WIDTH,
                MAX_WIDTH,
                toggleSidebar,
                closeSidebar,
                openSidebar,
                hideSidebar,
                showSidebar,
                updateSidebarWidth,
                toggleCollapse
            }}
        >
            {children}
        </RightSidebarContext.Provider>
    );
};
