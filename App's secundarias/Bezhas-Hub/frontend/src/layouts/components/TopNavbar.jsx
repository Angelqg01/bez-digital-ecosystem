import React, { useState } from 'react';
import { Bell, MessageSquare, Search, HelpCircle } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import PageGuide from '../../components/ui/PageGuide';
import { guideContent, getGuideByPath } from '../../data/guideContent';

export default function TopNavbar() {
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const location = useLocation();

    // Obtener el contenido de guía según la ruta actual
    const currentGuide = getGuideByPath(location.pathname);
    return (
        <header className="fixed top-0 inset-x-0 z-50 h-20 bg-dark-surface dark:bg-light-surface border-b border-black/10 dark:border-white/10">
            <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between">
                {/* Left: Logo + Search */}
                <div className="flex items-center gap-4">
                    <NavLink to="/" className="text-xl font-bold">
                        BeZhas
                    </NavLink>
                    <div className="hidden md:flex items-center bg-dark-background dark:bg-light-background rounded-full px-4 py-2 w-72">
                        <Search size={18} className="text-dark-text-muted dark:text-light-text-muted" />
                        <input
                            type="text"
                            placeholder="Buscar en BeZhas..."
                            className="bg-transparent focus:outline-none ml-3 text-dark-text dark:text-light-text placeholder-dark-text-muted dark:placeholder-light-text-muted w-full"
                        />
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                    <button className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" aria-label="Mensajes">
                        <MessageSquare size={22} />
                    </button>
                    <button className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" aria-label="Notificaciones">
                        <Bell size={22} />
                    </button>

                    {/* Botón de Ayuda Contextual */}
                    <button
                        onClick={() => setIsGuideOpen(true)}
                        className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 group"
                        aria-label="Ayuda y Guías"
                        title="¿Necesitas ayuda? Haz clic aquí"
                    >
                        <span className="text-white font-bold text-xl">?</span>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse border-2 border-white"></span>
                    </button>

                    <NavLink to="/profile" className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" aria-label="Perfil" />
                </div>
            </div>

            {/* Panel de Ayuda Contextual */}
            <PageGuide
                content={currentGuide}
                isOpen={isGuideOpen}
                onToggle={setIsGuideOpen}
            />
        </header>
    );
}
