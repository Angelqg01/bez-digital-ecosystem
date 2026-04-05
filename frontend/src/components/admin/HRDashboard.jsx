import React from 'react';
import { Users, Briefcase, FileText, CheckCircle } from 'lucide-react';

export default function HRDashboard() {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Recursos Humanos</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="text-pink-500" />
                        <h3 className="text-lg font-semibold text-white">Empleados</h3>
                    </div>
                    <p className="text-3xl text-white font-bold">24</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <Briefcase className="text-pink-500" />
                        <h3 className="text-lg font-semibold text-white">Contrataciones</h3>
                    </div>
                    <p className="text-3xl text-white font-bold">3</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <CheckCircle className="text-pink-500" />
                        <h3 className="text-lg font-semibold text-white">Evaluaciones</h3>
                    </div>
                    <p className="text-3xl text-white font-bold">12</p>
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Gestión de Personal</h3>
                <p className="text-gray-400">
                    Panel de administración para dar de alta, gestionar permisos y controlar la nómina del equipo BeZhas.
                </p>
                {/* Future implementation of users list specifically for staff */}
            </div>
        </div>
    );
}
