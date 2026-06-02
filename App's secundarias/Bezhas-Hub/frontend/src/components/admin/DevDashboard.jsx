import React from 'react';
import { Terminal, Database, Code, Activity } from 'lucide-react';

export default function DevDashboard() {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Portal de Desarrolladores</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <Activity className="text-purple-500" />
                        <h3 className="text-lg font-semibold text-white">API Status</h3>
                    </div>
                    <p className="text-xl text-green-400 font-bold">99.9% Uptime</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <Code className="text-purple-500" />
                        <h3 className="text-lg font-semibold text-white">Deployments</h3>
                    </div>
                    <p className="text-xl text-white font-bold">v2.4.1 (Stable)</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <Database className="text-purple-500" />
                        <h3 className="text-lg font-semibold text-white">Database</h3>
                    </div>
                    <p className="text-xl text-white font-bold">Healthy (34ms)</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <Terminal className="text-purple-500" />
                        <h3 className="text-lg font-semibold text-white">Error Rate</h3>
                    </div>
                    <p className="text-xl text-white font-bold">0.02%</p>
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Herramientas de Desarrollo</h3>
                <div className="grid grid-cols-2 gap-4">
                    <button className="p-4 bg-gray-900 border border-gray-700 rounded-lg text-left hover:border-purple-500 transition-colors">
                        <h4 className="text-white font-bold">Consola de Logs</h4>
                        <p className="text-sm text-gray-400">Ver logs del servidor en tiempo real</p>
                    </button>
                    <button className="p-4 bg-gray-900 border border-gray-700 rounded-lg text-left hover:border-purple-500 transition-colors">
                        <h4 className="text-white font-bold">Webhooks</h4>
                        <p className="text-sm text-gray-400">Gestionar webhooks y endpoints (MCP)</p>
                    </button>
                    <button className="p-4 bg-gray-900 border border-gray-700 rounded-lg text-left hover:border-purple-500 transition-colors">
                        <h4 className="text-white font-bold">Gestión de Cache</h4>
                        <p className="text-sm text-gray-400">Limpiar caché de Redis</p>
                    </button>
                    <button className="p-4 bg-gray-900 border border-gray-700 rounded-lg text-left hover:border-purple-500 transition-colors">
                        <h4 className="text-white font-bold">Test Suites</h4>
                        <p className="text-sm text-gray-400">Ejecutar pruebas E2E desde el panel</p>
                    </button>
                </div>
            </div>
        </div>
    );
}
