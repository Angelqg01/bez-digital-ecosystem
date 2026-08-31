
import React, { useEffect, useState } from 'react';
import http from '../services/http';
// import { useHideRightSidebar } from '../hooks/useHideRightSidebar';

const API_PREFIX = '/api';

export default function UserManagementPage() {
    // useHideRightSidebar();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editUser, setEditUser] = useState(null);
    const [editData, setEditData] = useState({});
    const [modalOpen, setModalOpen] = useState(false);

    // Get admin token from localStorage (assume stored as 'adminToken')
    const adminToken = localStorage.getItem('adminToken');

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        setLoading(true);
        setError(null);
        try {
            const res = await http.get(`${API_PREFIX}/admin/v1/users`, {
                headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined
            });
            // Soporta tanto array directo como objeto { users: [...] }
            if (Array.isArray(res.data)) {
                setUsers(res.data);
            } else if (res.data && Array.isArray(res.data.users)) {
                setUsers(res.data.users);
            } else {
                setUsers([]);
            }
        } catch (err) {
            setError('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    }

    function handleEdit(user) {
        setEditUser(user);
        setEditData(user);
        setModalOpen(true);
    }

    async function handleSave() {
        try {
            await http.put(`${API_PREFIX}/admin/v1/users/${editUser._id}`, editData, {
                headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined
            });
            setModalOpen(false);
            setEditUser(null);
            fetchUsers();
        } catch (err) {
            alert('Error al guardar cambios');
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('¿Seguro que deseas eliminar este usuario?')) return;
        try {
            await http.delete(`${API_PREFIX}/admin/v1/users/${id}`, {
                headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined
            });
            fetchUsers();
        } catch (err) {
            alert('Error al eliminar usuario');
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Gestión de Usuarios</h1>
            <div className="bg-dark-surface dark:bg-light-surface p-6 rounded-2xl">
                {loading ? (
                    <p>Cargando usuarios...</p>
                ) : error ? (
                    <p className="text-red-500">{error}</p>
                ) : (
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="py-2 px-4 text-left">ID</th>
                                <th className="py-2 px-4 text-left">Wallet</th>
                                <th className="py-2 px-4 text-left">Roles</th>
                                <th className="py-2 px-4 text-left">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user._id} className="border-b">
                                    <td className="py-2 px-4">{user._id}</td>
                                    <td className="py-2 px-4">{user.walletAddress}</td>
                                    <td className="py-2 px-4">{user.roles ? user.roles.join(', ') : '-'}</td>
                                    <td className="py-2 px-4">
                                        <button className="mr-2 text-blue-600" onClick={() => handleEdit(user)}>Editar</button>
                                        <button className="text-red-600" onClick={() => handleDelete(user._id)}>Eliminar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-dark-surface p-6 rounded-xl w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Editar Usuario</h2>
                        <label className="block mb-2">Wallet Address
                            <input className="w-full p-2 border rounded" value={editData.walletAddress || ''} onChange={e => setEditData({ ...editData, walletAddress: e.target.value })} />
                        </label>
                        <label className="block mb-2">Roles
                            <input className="w-full p-2 border rounded" value={editData.roles ? editData.roles.join(',') : ''} onChange={e => setEditData({ ...editData, roles: e.target.value.split(',').map(r => r.trim()) })} />
                        </label>
                        <div className="flex gap-2 mt-4">
                            <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleSave}>Guardar</button>
                            <button className="bg-gray-300 px-4 py-2 rounded" onClick={() => setModalOpen(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
