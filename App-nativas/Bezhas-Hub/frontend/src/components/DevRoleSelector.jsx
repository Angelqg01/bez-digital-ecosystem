import React, { useState } from 'react';
import useUserStore from '../stores/userStore';
import { toast } from 'react-hot-toast';

const DevRoleSelector = () => {
    const { userProfile, setUserRole } = useUserStore();
    const [isOpen, setIsOpen] = useState(false);

    // Solo mostrar en modo desarrollo
    if (import.meta.env.PROD) return null;

    const roles = [
        { id: 'user', label: 'Usuario', icon: '👤', color: 'blue' },
        { id: 'admin', label: 'Administrador', icon: '👑', color: 'red' },
        { id: 'professor', label: 'Catedrático', icon: '👨‍🏫', color: 'green' },
        { id: 'company', label: 'Empresa', icon: '🏢', color: 'purple' },
        { id: 'institution', label: 'Institución', icon: '🏛️', color: 'indigo' },
    ];

    const currentRole = userProfile?.role || 'user';

    const handleRoleChange = (roleId) => {
        setUserRole(roleId);
        toast.success(`Rol cambiado a: ${roles.find(r => r.id === roleId)?.label}`);
        setIsOpen(false);
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {/* Botón flotante */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                title="Herramientas de Desarrollo"
            >
                <span className="text-2xl">🔧</span>
                <span className="font-semibold">DEV</span>
            </button>

            {/* Panel de selección de rol */}
            {isOpen && (
                <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-2xl p-4 w-64 border-2 border-purple-200">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-gray-800">🔧 Cambiar Rol</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="text-xs text-gray-500 mb-3 bg-yellow-50 p-2 rounded border border-yellow-200">
                        ⚠️ Solo en desarrollo
                    </div>

                    <div className="space-y-2">
                        {roles.map((role) => (
                            <button
                                key={role.id}
                                onClick={() => handleRoleChange(role.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${currentRole === role.id
                                        ? `bg-${role.color}-100 border-2 border-${role.color}-500`
                                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                                    }`}
                            >
                                <span className="text-2xl">{role.icon}</span>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold text-gray-800">{role.label}</div>
                                    {currentRole === role.id && (
                                        <div className="text-xs text-green-600">✓ Activo</div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-600">
                            <strong>Rol actual:</strong> {roles.find(r => r.id === currentRole)?.label}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevRoleSelector;
