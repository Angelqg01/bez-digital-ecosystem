import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import {
    MoreHorizontal,
    Shield,
    CheckCircle,
    Ban,
    Search,
    Filter,
    Crown,
    Star,
    Eye,
    UserX
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const ROLES = {
    USER: 'USER',
    CERTIFIED_USER: 'CERTIFIED_USER',
    EDITOR: 'EDITOR',
    MODERATOR: 'MODERATOR',
    DEVELOPER: 'DEVELOPER',
    ADMIN: 'ADMIN'
};

const SUBSCRIPTIONS = {
    FREE: 'FREE',
    PREMIUM: 'PREMIUM',
    VIP: 'VIP'
};

// Super Admin Wallets (must match backend)
const SUPER_ADMIN_WALLETS = [
    '0x52df82920cbae522880dd7657e43d1a754ed044e'
].map(addr => addr.toLowerCase());

const isSuperAdmin = (walletAddress) => {
    if (!walletAddress) return false;
    return SUPER_ADMIN_WALLETS.includes(walletAddress.toLowerCase());
};

const getRoleBadgeColor = (role) => {
    const colors = {
        USER: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        CERTIFIED_USER: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
        EDITOR: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
        MODERATOR: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
        DEVELOPER: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
        ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    };
    return colors[role] || colors.USER;
};

const getSubscriptionBadge = (subscription) => {
    const badges = {
        FREE: { icon: '🆓', color: 'bg-gray-100 text-gray-600' },
        PREMIUM: { icon: '⭐', color: 'bg-yellow-100 text-yellow-600' },
        VIP: { icon: '👑', color: 'bg-purple-100 text-purple-600' }
    };
    return badges[subscription] || badges.FREE;
};

export default function AdminUserTable() {
    const { address } = useAccount();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [subscriptionFilter, setSubscriptionFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [openDropdown, setOpenDropdown] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, [roleFilter, subscriptionFilter, statusFilter]);

    const fetchUsers = async () => {
        try {
            const params = new URLSearchParams();
            if (roleFilter) params.append('role', roleFilter);
            if (subscriptionFilter) params.append('subscription', subscriptionFilter);
            if (statusFilter) params.append('isBanned', statusFilter);
            if (searchTerm) params.append('search', searchTerm);

            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/admin/users?${params}`,
                {
                    headers: {
                        'x-wallet-address': address
                    }
                }
            );

            const data = await response.json();

            if (data.success) {
                setUsers(data.users);
            } else {
                toast.error(data.error || 'Error al cargar usuarios');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/admin/users/${userId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-wallet-address': address
                    },
                    body: JSON.stringify({ role: newRole })
                }
            );

            const data = await response.json();

            if (data.success) {
                toast.success(`Rol actualizado a ${newRole}`);
                fetchUsers();
                setOpenDropdown(null);
            } else {
                toast.error(data.error || 'Error al actualizar rol');
            }
        } catch (error) {
            console.error('Error updating role:', error);
            toast.error('Error al actualizar rol');
        }
    };

    const handleStatusChange = async (userId, isBanned) => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/admin/users/${userId}/ban`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-wallet-address': address
                    },
                    body: JSON.stringify({ ban: isBanned })
                }
            );

            const data = await response.json();

            if (data.success) {
                toast.success(isBanned ? 'Usuario baneado' : 'Usuario reactivado');
                fetchUsers();
                setOpenDropdown(null);
            } else {
                toast.error(data.error || 'Error al cambiar estado');
            }
        } catch (error) {
            console.error('Error changing status:', error);
            toast.error('Error al cambiar estado');
        }
    };

    const handleVerify = async (userId, verify) => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/admin/users/${userId}/verify`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-wallet-address': address
                    },
                    body: JSON.stringify({ verify })
                }
            );

            const data = await response.json();

            if (data.success) {
                toast.success(verify ? 'Usuario verificado' : 'Verificación removida');
                fetchUsers();
                setOpenDropdown(null);
            } else {
                toast.error(data.error || 'Error al verificar usuario');
            }
        } catch (error) {
            console.error('Error verifying user:', error);
            toast.error('Error al verificar usuario');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header and Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && fetchUsers()}
                            placeholder="Buscar por nombre, email o wallet..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>

                    {/* Role Filter */}
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="">Todos los roles</option>
                        {Object.values(ROLES).map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>

                    {/* Subscription Filter */}
                    <select
                        value={subscriptionFilter}
                        onChange={(e) => setSubscriptionFilter(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="">Todas las suscripciones</option>
                        {Object.values(SUBSCRIPTIONS).map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="">Todos los estados</option>
                        <option value="false">Activos</option>
                        <option value="true">Baneados</option>
                    </select>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Usuarios</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{users.filter(u => !u.isBanned).length}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Activos</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{users.filter(u => u.isVerified).length}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Verificados</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{users.filter(u => u.isBanned).length}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Baneados</div>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Usuario
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Wallet
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Rol
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Suscripción
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Estado
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {users.map((user) => (
                                <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                                                {user.avatarUrl ? (
                                                    <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                        👤
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="font-medium text-gray-900 dark:text-white">
                                                        {user.username || 'Sin nombre'}
                                                    </div>
                                                    {user.isVerified && (
                                                        <CheckCircle size={14} className="text-blue-500" />
                                                    )}
                                                    {isSuperAdmin(user.walletAddress) && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                                                            <Crown size={12} />
                                                            OWNER
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {user.email || 'Sin email'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-mono text-sm text-gray-600 dark:text-gray-400">
                                            {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${getSubscriptionBadge(user.subscription).color}`}>
                                            <span>{getSubscriptionBadge(user.subscription).icon}</span>
                                            {user.subscription}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.isBanned ? (
                                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                                                Baneado
                                            </span>
                                        ) : (
                                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                                Activo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        {isSuperAdmin(user.walletAddress) ? (
                                            <div className="inline-flex items-center gap-2 px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
                                                <Shield size={14} className="text-yellow-500" />
                                                Protegido
                                            </div>
                                        ) : (
                                            <div className="relative inline-block">
                                                <button
                                                    onClick={() => setOpenDropdown(openDropdown === user._id ? null : user._id)}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                                >
                                                    <MoreHorizontal size={18} />
                                                </button>

                                                {openDropdown === user._id && (
                                                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-10">
                                                        <div className="py-1">
                                                            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                                                Cambiar Rol
                                                            </div>
                                                            {Object.values(ROLES).map(role => (
                                                                <button
                                                                    key={role}
                                                                    onClick={() => handleRoleChange(user._id, role)}
                                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                                                >
                                                                    <Shield size={16} />
                                                                    {role}
                                                                </button>
                                                            ))}

                                                            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

                                                            <button
                                                                onClick={() => handleVerify(user._id, !user.isVerified)}
                                                                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${user.isVerified
                                                                    ? 'text-gray-700 dark:text-gray-300'
                                                                    : 'text-blue-600 dark:text-blue-400'
                                                                    } hover:bg-gray-100 dark:hover:bg-gray-600`}
                                                            >
                                                                <CheckCircle size={16} />
                                                                {user.isVerified ? 'Quitar Verificación' : 'Verificar Usuario'}
                                                            </button>

                                                            <button
                                                                onClick={() => handleStatusChange(user._id, !user.isBanned)}
                                                                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${user.isBanned
                                                                    ? 'text-green-600 dark:text-green-400'
                                                                    : 'text-red-600 dark:text-red-400'
                                                                    } hover:bg-gray-100 dark:hover:bg-gray-600`}
                                                            >
                                                                {user.isBanned ? <CheckCircle size={16} /> : <Ban size={16} />}
                                                                {user.isBanned ? 'Reactivar Usuario' : 'Banear Usuario'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {users.length === 0 && (
                    <div className="text-center py-12">
                        <UserX size={48} className="mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                            No se encontraron usuarios
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
