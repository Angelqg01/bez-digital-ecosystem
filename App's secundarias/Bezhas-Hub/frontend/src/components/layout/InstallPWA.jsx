import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

const InstallPWA = () => {
    const [supportsPWA, setSupportsPWA] = useState(false);
    const [promptInstall, setPromptInstall] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Detectar si ya está instalada
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            setIsInstalled(true);
            return;
        }

        // Verificar si ya fue dismissed en esta sesión
        const wasDismissed = sessionStorage.getItem('pwa-install-dismissed');
        if (wasDismissed) {
            setDismissed(true);
            return;
        }

        const handler = (e) => {
            e.preventDefault();
            setSupportsPWA(true);
            setPromptInstall(e);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const onClick = (evt) => {
        evt.preventDefault();
        if (!promptInstall) {
            return;
        }

        promptInstall.prompt();
        promptInstall.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                setSupportsPWA(false);
            }
            setPromptInstall(null);
        });
    };

    const onDismiss = () => {
        setDismissed(true);
        setSupportsPWA(false);
        sessionStorage.setItem('pwa-install-dismissed', 'true');
    };

    if (!supportsPWA || isInstalled || dismissed) {
        return null;
    }

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-4 md:left-auto md:right-4 md:max-w-md animate-fade-in-up">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-xl shadow-2xl border border-white/10 flex items-center justify-between gap-4 backdrop-blur-md">
                <div className="flex items-center gap-3 flex-1">
                    <div className="bg-white/20 p-2.5 rounded-lg flex-shrink-0">
                        <Download className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-sm">Instalar BeZhas App</h3>
                        <p className="text-blue-100 text-xs">Acceso rápido y mejor rendimiento</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={onDismiss}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 text-white/70" />
                    </button>
                    <button
                        className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors shadow-md whitespace-nowrap"
                        id="setup_button"
                        aria-label="Instalar aplicación"
                        title="Instalar App"
                        onClick={onClick}
                    >
                        Instalar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPWA;
