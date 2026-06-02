import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import http from '../services/http';

export default function BackendStatusBanner() {
    const [hasBackendError, setHasBackendError] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check backend health
        const checkHealth = async () => {
            try {
                const response = await http.get('/api/health', { signal: AbortSignal.timeout(2000) });
                setHasBackendError(response.status !== 200 && response.status !== 201);
            } catch (error) {
                setHasBackendError(true);
            }
        };

        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, []);

    if (!hasBackendError || dismissed) return null;

    return (
        <div className="fixed top-20 left-0 right-0 z-40 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-lg shadow-lg backdrop-blur-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                Modo Offline
                            </p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                El backend no está disponible. Algunas funciones están limitadas, pero puedes seguir navegando.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setDismissed(true)}
                        className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 transition-colors"
                        aria-label="Cerrar aviso"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
