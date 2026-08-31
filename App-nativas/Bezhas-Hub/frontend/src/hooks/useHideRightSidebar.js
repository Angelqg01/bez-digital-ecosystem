import { useEffect } from 'react';
import { useRightSidebar } from '../context/RightSidebarContext';

/**
 * Hook para ocultar automáticamente el RightSidebar en páginas específicas
 * que necesitan más espacio (como perfil, edición, configuración, etc.)
 * 
 * Uso:
 * ```jsx
 * import { useHideRightSidebar } from '../hooks/useHideRightSidebar';
 * 
 * const MyPage = () => {
 *   useHideRightSidebar();
 *   // resto del componente
 * };
 * ```
 */
export const useHideRightSidebar = () => {
    const { hideSidebar, showSidebar } = useRightSidebar();

    useEffect(() => {
        hideSidebar();

        return () => {
            showSidebar();
        };
    }, [hideSidebar, showSidebar]);
};
