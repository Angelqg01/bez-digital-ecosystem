import { useState } from 'react';
import { Users, Shield, TrendingUp, Activity } from 'lucide-react';
import AdminUserTable from '../../components/admin/AdminUserTable';

export default function AdminUsersPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl shadow-lg p-8 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Gestión de Usuarios</h1>
                            <p className="text-purple-100">
                                Administra roles, permisos y estados de los usuarios de la plataforma
                            </p>
                        </div>
                        <Users size={64} className="opacity-20" />
                    </div>
                </div>

                {/* User Management Table */}
                <AdminUserTable />
            </div>
        </div>
    );
}
