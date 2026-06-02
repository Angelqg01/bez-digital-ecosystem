import React, { useState, useEffect } from 'react';

/**
 * Componente de Guía Informativa por Página
 * Panel deslizable que explica las funcionalidades de cada sección
 * con soluciones a problemas comunes
 */

// Iconos SVG simples para no depender de librerías externas
const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

const AlertCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

const PageGuide = ({ content, isOpen: controlledIsOpen, onToggle }) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [hasBeenOpened, setHasBeenOpened] = useState(false);

    // Usar estado controlado si se proporciona, sino usar estado interno
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const setIsOpen = onToggle || setInternalIsOpen;

    // Auto-abrir la primera vez que se visita una página (opcional) - DESACTIVADO para navbar
    useEffect(() => {
        // Desactivado cuando se controla externamente
        if (controlledIsOpen !== undefined) return;

        const storageKey = `guide-viewed-${content?.title || 'default'}`;
        const hasViewed = localStorage.getItem(storageKey);

        // Si nunca ha visto esta guía, mostrarla después de 3 segundos
        if (!hasViewed && content && !hasBeenOpened) {
            const timer = setTimeout(() => {
                setInternalIsOpen(true);
                setHasBeenOpened(true);
                localStorage.setItem(storageKey, 'true');
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [content, hasBeenOpened, controlledIsOpen]);

    const handleClose = () => {
        if (onToggle) {
            onToggle(false);
        } else {
            setInternalIsOpen(false);
        }
    };

    const handleOpen = () => {
        if (onToggle) {
            onToggle(true);
        } else {
            setInternalIsOpen(true);
            setHasBeenOpened(true);
        }
    };

    if (!content) return null;

    return (
        <>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
                    onClick={handleClose}
                />
            )}

            {/* Panel Deslizable */}
            <div
                className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-gradient-to-b from-gray-900 via-gray-900 to-black border-l border-indigo-500/30 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#4f46e5 #1f2937'
                }}
            >
                <div className="p-6 pb-24">
                    {/* Header con gradiente */}
                    <div className="flex justify-between items-start mb-6 pb-6 border-b border-indigo-500/30 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 -mx-6 px-6 py-4 sticky top-0 backdrop-blur-lg z-10">
                        <div>
                            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-1">
                                {content.title}
                            </h2>
                            <p className="text-xs text-gray-400">Guía de Ayuda Interactiva</p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                            aria-label="Cerrar"
                        >
                            <CloseIcon />
                        </button>
                    </div>

                    {/* Descripción Principal */}
                    <section className="mb-8">
                        <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 p-4 rounded-xl border border-indigo-500/30 backdrop-blur-sm">
                            <h3 className="text-sm uppercase tracking-wider text-indigo-300 mb-3 font-semibold flex items-center">
                                <CheckCircleIcon />
                                <span className="ml-2">¿Qué es esto?</span>
                            </h3>
                            <p className="text-gray-200 leading-relaxed text-[15px]">
                                {content.description}
                            </p>
                        </div>
                    </section>

                    {/* Funcionalidades Principales */}
                    <section className="mb-8">
                        <h3 className="text-sm uppercase tracking-wider text-indigo-300 mb-4 font-semibold flex items-center">
                            <div className="w-1 h-4 bg-indigo-500 mr-2 rounded-full" />
                            Funcionalidades Principales
                        </h3>
                        <ul className="space-y-3">
                            {content.features?.map((feature, idx) => (
                                <li
                                    key={idx}
                                    className="flex items-start text-gray-200 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 hover:border-indigo-500/50 transition-all hover:bg-gray-800/80"
                                >
                                    <span className="text-indigo-400 mr-3 text-xl font-bold flex-shrink-0">•</span>
                                    <span className="text-[14px]">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Casos de Uso */}
                    <section className="mb-8">
                        <h3 className="text-sm uppercase tracking-wider text-purple-300 mb-4 font-semibold flex items-center">
                            <div className="w-1 h-4 bg-purple-500 mr-2 rounded-full" />
                            Casos de Uso Reales
                        </h3>
                        <div className="space-y-3">
                            {content.useCases?.map((useCase, idx) => (
                                <div
                                    key={idx}
                                    className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 p-4 rounded-lg border-l-4 border-purple-500 hover:border-indigo-400 transition-all hover:shadow-lg hover:shadow-purple-500/20"
                                >
                                    <p className="text-[14px] text-gray-200 leading-relaxed">{useCase}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Problemas Comunes y Soluciones */}
                    {content.commonIssues && content.commonIssues.length > 0 && (
                        <section className="mb-8">
                            <h3 className="text-sm uppercase tracking-wider text-yellow-300 mb-4 font-semibold flex items-center">
                                <AlertCircleIcon />
                                <span className="ml-2">Problemas Comunes & Soluciones</span>
                            </h3>
                            <div className="space-y-4">
                                {content.commonIssues.map((issue, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-gray-800/70 p-4 rounded-lg border border-yellow-500/30 hover:border-yellow-500/60 transition-all"
                                    >
                                        <div className="flex items-start mb-2">
                                            <span className="text-yellow-400 mr-2 text-lg">❓</span>
                                            <p className="text-[14px] font-semibold text-yellow-200">{issue.problem}</p>
                                        </div>
                                        <div className="flex items-start ml-7 mt-2 pt-2 border-t border-gray-700/50">
                                            <span className="text-green-400 mr-2 text-lg">✅</span>
                                            <p className="text-[13px] text-gray-300 leading-relaxed">{issue.solution}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Footer con CTA */}
                    <div className="mt-10 pt-6 border-t border-indigo-500/30 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 -mx-6 px-6 py-4 rounded-t-xl">
                        <div className="text-center mb-4">
                            <p className="text-sm text-gray-300 mb-3">¿Todavía tienes dudas?</p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                                    📚 Ver Tutoriales
                                </button>
                                <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">
                                    💬 Soporte en Vivo
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-4">
                            Bezhas Web3 Platform © 2024 - Ayuda Contextual IA
                        </p>
                    </div>
                </div>
            </div>

            {/* Estilos para scrollbar personalizada */}
            <style jsx>{`
        .overflow-y-auto::-webkit-scrollbar {
          width: 8px;
        }
        .overflow-y-auto::-webkit-scrollbar-track {
          background: #1f2937;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #4f46e5;
          border-radius: 4px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #6366f1;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
        </>
    );
};

export default PageGuide;
