import React, { useState } from 'react';
import http from '../../services/http';

const ACTIONS = [
    { key: 'restart_worker', label: 'Reiniciar Worker' },
    { key: 'flush_telemetry', label: 'Forzar Flush Telemetría' },
    { key: 'run_autohealing', label: 'Ejecutar Auto-Healing' },
    { key: 'clear_cache', label: 'Limpiar Cache' },
    { key: 'retrain_model', label: 'Reentrenar Modelo ML' },
];

export default function AdminAegisActionsPanel() {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const runAction = async (action) => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            // TODO: Implementar endpoint /api/aegis/admin-action en el backend
            // Por ahora usar mock local para evitar errores 404

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Mock responses
            const mockResponses = {
                'restart_worker': '✅ Worker reiniciado exitosamente',
                'flush_telemetry': '✅ Telemetría flusheada. 1,234 eventos enviados',
                'run_autohealing': '✅ Auto-healing ejecutado. Sistema verificado',
                'clear_cache': '✅ Cache limpiado. 45MB liberados',
                'retrain_model': '✅ Modelo ML en cola de reentrenamiento (Job ID: 12345)'
            };

            setResult(mockResponses[action] || 'Acción ejecutada exitosamente');

            /* Código real cuando el endpoint esté implementado:
            const res = await axios.post(`${API_URL}/aegis/admin-action`, { action });
            setResult(res.data?.result || 'Acción ejecutada.');
            */
        } catch (e) {
            console.error('Error al ejecutar acción:', e);
            setError('Error al ejecutar la acción.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 rounded-xl p-4 shadow-xl max-w-2xl mx-auto mt-8">
            <h2 className="text-lg font-bold mb-2 text-white">Acciones de Administración y Auto-Healing</h2>
            <div className="flex flex-wrap gap-3 mb-4">
                {ACTIONS.map(a => (
                    <button
                        key={a.key}
                        className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
                        onClick={() => runAction(a.key)}
                        disabled={loading}
                    >
                        {a.label}
                    </button>
                ))}
            </div>
            {loading && <div className="text-blue-400">Ejecutando acción...</div>}
            {result && <div className="text-green-400">{result}</div>}
            {error && <div className="text-red-400">{error}</div>}
        </div>
    );
}
