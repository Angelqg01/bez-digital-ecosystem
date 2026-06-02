import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Activity } from 'lucide-react';
import { useRightSidebar } from '../context/RightSidebarContext';

/**
 * Botón flotante para abrir la sidebar derecha en modo móvil
 * Solo visible cuando la sidebar está cerrada y en pantallas < xl
 */
export default function RightSidebarToggle() {
    const { isOpen, isMobile, openSidebar } = useRightSidebar();

    // No mostrar si no es móvil o si ya está abierto
    if (!isMobile || isOpen) {
        return null;
    }

    return (
        <motion.button
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            whileHover={{ scale: 1.05, x: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={openSidebar}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-30 
                       bg-gradient-to-l from-purple-600 to-purple-700 
                       dark:from-purple-500 dark:to-purple-600
                       text-white
                       floating-sidebar-button
                       rounded-l-2xl
                       flex flex-col items-center justify-center
                       py-4 px-3
                       hover:px-4
                       transition-all duration-300
                       border-l-4 border-purple-400 dark:border-purple-300"
            aria-label="Abrir panel de actividades"
        >
            {/* Icono principal */}
            <Activity className="w-5 h-5 mb-2" />

            {/* Texto vertical */}
            <div className="writing-mode-vertical text-xs font-semibold tracking-wider">
                ACTIVIDAD
            </div>

            {/* Indicador de flecha */}
            <ChevronLeft className="w-4 h-4 mt-2 animate-pulse" />

            {/* Badge de notificaciones (opcional) */}
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
                className="absolute -top-1 -left-1 w-6 h-6 bg-red-500 rounded-full 
                            flex items-center justify-center text-xs font-bold
                            border-2 border-white dark:border-gray-900
                            shadow-lg"
            >
                3
            </motion.div>
        </motion.button>
    );
}
