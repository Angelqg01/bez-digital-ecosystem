import React, { useEffect, useRef, useState } from 'react';

/**
 * Widget de Google Translate integrado
 * Permite traducir toda la interfaz a múltiples idiomas
 * Optimizado para UX y diseño consistente con Bezhas
 */

const GoogleTranslateWidget = ({ position = 'top-right' }) => {
    const containerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        let intervalId = null;

        const checkAndInit = () => {
            // Verificar si Google Translate está disponible
            if (window.google && window.google.translate && containerRef.current && !containerRef.current.innerHTML) {
                try {
                    new window.google.translate.TranslateElement(
                        {
                            pageLanguage: 'es', // Idioma por defecto del sitio
                            includedLanguages: 'en,fr,de,it,pt,zh-CN,zh-TW,ja,ko,ru,ar,hi,es', // Idiomas disponibles
                            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
                            autoDisplay: false,
                            multilanguagePage: true
                        },
                        'google_translate_element'
                    );
                    setIsLoaded(true);
                    if (intervalId) clearInterval(intervalId);
                } catch (error) {
                    console.error('Error inicializando Google Translate:', error);
                }
            }
        };

        // Cargar script si no existe
        if (!document.querySelector('script[src*="translate.google.com"]')) {
            const script = document.createElement('script');
            script.setAttribute('src', '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit');
            script.async = true;
            document.body.appendChild(script);

            // Definir callback global
            window.googleTranslateElementInit = checkAndInit;
        } else {
            // Script ya cargado
            checkAndInit();
        }

        // Polling como respaldo
        intervalId = setInterval(checkAndInit, 1000);

        // Cleanup
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    // Determinar clases de posición
    const getPositionClasses = () => {
        switch (position) {
            case 'top-left':
                return 'top-4 left-4';
            case 'top-right':
                return 'top-4 right-4';
            case 'bottom-left':
                return 'bottom-4 left-4';
            case 'bottom-right':
                return 'bottom-4 right-4';
            default:
                return 'top-4 right-24'; // Por defecto, evitar el botón de ayuda
        }
    };

    return (
        <>
            <div className={`fixed ${getPositionClasses()} z-30 translate-widget-container`}>
                <div className="flex items-center gap-2">
                    {/* Indicador de idioma */}
                    <div className="bg-gray-900/90 backdrop-blur-md border border-indigo-500/30 rounded-lg px-3 py-2 shadow-xl">
                        <div className="flex items-center gap-2">
                            {/* Icono de globo */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-indigo-400"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>

                            {/* Widget de Google Translate */}
                            <div
                                id="google_translate_element"
                                ref={containerRef}
                                className={`translate-element ${isLoaded ? 'loaded' : 'loading'}`}
                            />

                            {/* Loader mientras carga */}
                            {!isLoaded && (
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                                    <span className="text-xs text-gray-400">Cargando...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tooltip informativo */}
                    <div className="hidden lg:block bg-indigo-600/90 backdrop-blur-md text-white text-xs px-3 py-1 rounded-lg shadow-lg animate-fade-in">
                        🌍 Traduce a tu idioma
                    </div>
                </div>
            </div>

            {/* Estilos personalizados para Google Translate */}
            <style jsx global>{`
        /* Contenedor del widget */
        .translate-widget-container .goog-te-gadget {
          font-family: inherit !important;
        }

        .translate-widget-container .goog-te-gadget-simple {
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          cursor: pointer !important;
        }

        .translate-widget-container .goog-te-gadget-simple span {
          color: white !important;
          font-size: 14px !important;
        }

        .translate-widget-container .goog-te-gadget-simple:hover span {
          color: #818cf8 !important;
        }

        /* Ocultar el icono de flecha de Google */
        .translate-widget-container .goog-te-gadget-simple .goog-te-menu-value span:last-child {
          display: none !important;
        }

        /* Ocultar "Powered by" */
        .translate-widget-container .goog-te-gadget-simple .goog-te-gadget-icon {
          display: none !important;
        }

        /* Menú desplegable */
        .goog-te-menu-frame {
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
          border: 1px solid rgba(79, 70, 229, 0.3) !important;
          border-radius: 12px !important;
          overflow: hidden !important;
        }

        /* Fijar el body cuando Google Translate lo mueve */
        body {
          top: 0 !important;
          position: relative !important;
        }

        /* Ocultar el banner de Google Translate */
        .goog-te-banner-frame {
          display: none !important;
        }

        /* Cuando está en modo traducido */
        body.translated-ltr {
          margin-top: 0 !important;
        }

        /* Elementos traducidos - mantener estilos */
        font[style*="color: rgb(255, 255, 255)"] {
          color: inherit !important;
        }

        /* Estilos del iframe del selector */
        .goog-te-menu2 {
          max-width: 100% !important;
          overflow-x: hidden !important;
          background: #1f2937 !important;
          border: 1px solid rgba(79, 70, 229, 0.3) !important;
        }

        /* Items del menú */
        .goog-te-menu2-item div,
        .goog-te-menu2-item:link div,
        .goog-te-menu2-item:visited div,
        .goog-te-menu2-item:active div {
          color: #fff !important;
          background-color: #1f2937 !important;
        }

        .goog-te-menu2-item:hover div {
          background-color: #374151 !important;
          color: #818cf8 !important;
        }

        /* Item seleccionado */
        .goog-te-menu2-item-selected div {
          background-color: #4f46e5 !important;
          color: white !important;
        }

        /* Animación de fade-in */
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .translate-widget-container {
            top: 60px !important;
            right: 10px !important;
          }
        }

        /* Estado de carga */
        .translate-element.loading {
          min-width: 100px;
          min-height: 20px;
        }

        .translate-element.loaded {
          display: inline-flex;
          align-items: center;
        }

        /* Mejorar compatibilidad con modo oscuro */
        .goog-te-menu-value span {
          font-weight: 500 !important;
        }

        /* Tooltip arrow (opcional) */
        .translate-widget-container .tooltip-arrow {
          position: absolute;
          left: -8px;
          top: 50%;
          transform: translateY(-50%);
          width: 0;
          height: 0;
          border-top: 8px solid transparent;
          border-bottom: 8px solid transparent;
          border-right: 8px solid rgba(79, 70, 229, 0.9);
        }
      `}</style>
        </>
    );
};

export default GoogleTranslateWidget;
