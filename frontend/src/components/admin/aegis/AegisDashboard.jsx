import React from 'react';
import AdminAegisActionsPanel from '../AdminAegisActionsPanel';
import AdminAegisChatPanel from '../AdminAegisChatPanel';

export default function AegisDashboard() {
    return (
        <div className="p-6 text-white min-h-screen">
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-2">AEGIS Dashboard</h1>
                    <p className="text-gray-400">Panel de control de Inteligencia Artificial y Auto-Healing del sistema BeZhas.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <AdminAegisActionsPanel />
                    <AdminAegisChatPanel />
                </div>
            </div>
        </div>
    );
}
