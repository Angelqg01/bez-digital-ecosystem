import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import {
    Users,
    Shield,
    Code,
    Eye,
    Ban,
    CheckCircle,
    AlertCircle,
    Search,
    Filter,
    ChevronDown,
    UserCog,
    Database,
    Brain,
    Crown,
    UserPlus,
    Store,
    X,
    Mail,
    Wallet,
    CreditCard,
    Coins
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'ethers';
// import { BEZHAS_TOKEN_ADDRESS, BEZHAS_TOKEN_ABI } from '../../../config/contracts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Role configurations with colors and icons
const ROLE_CONFIG = {
    USER: {
        label: 'Usuario',
        icon: Users,
        color: 'gray',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        textColor: 'text-gray-700 dark:text-gray-300',
        borderColor: 'border-gray-300 dark:border-gray-600',
        description: 'Usuario estándar con permisos básicos'
    },
    CERTIFIED_USER: {
        label: 'Usuario Certificado',
        icon: CheckCircle,
        color: 'blue',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-700 dark:text-blue-300',
        borderColor: 'border-blue-300 dark:border-blue-600',
        description: 'Usuario verificado con permisos extendidos'
    },
    EDITOR: {
        label: 'Editor',
        icon: Eye,
        color: 'green',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-300',
        borderColor: 'border-green-300 dark:border-green-600',
        description: 'Puede moderar y editar contenido'
    },
    MODERATOR: {
        label: 'Moderador',
        icon: Shield,
        color: 'purple',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        textColor: 'text-purple-700 dark:text-purple-300',
        borderColor: 'border-purple-300 dark:border-purple-600',
        description: 'Gestión de usuarios y contenido'
    },
    DEVELOPER: {
        label: 'Desarrollador',
        icon: Code,
        color: 'cyan',
        bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
        textColor: 'text-cyan-700 dark:text-cyan-300',
        borderColor: 'border-cyan-300 dark:border-cyan-600',
        description: 'Acceso al Panel Admin y herramientas técnicas'
    },
    ADMIN: {
        label: 'Super Admin',
        icon: Crown,
        color: 'red',
        bgColor: 'bg-gradient-to-r from-red-500 to-pink-500',
        textColor: 'text-white',
        borderColor: 'border-red-500',
        description: 'Control total del sistema'
    }
};

const SUBSCRIPTION_CONFIG = {
    FREE: {
        label: 'Free',
        color: 'gray'
    },
    PREMIUM: {
        label: 'Premium',
        color: 'gold'
    },
    VIP: {
        label: 'VIP',
        color: 'purple'
    }
};

const TokenBalanceCell = ({ address }) => {
    const { data: balanceData } = useReadContract({
        address: '0x53Eb00e6205eE1ecA78F2da22510BCfDED8CD56E',
        abi: [{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}],
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
            // don't refetch too often on a big list
            staleTime: 60000 
        }
    });

    const displayBalance = balanceData !== undefined ? Number(formatUnits(balanceData, 18)).toFixed(2) : '0.00';

    return (
        <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 font-semibold font-mono">
            <Coins className="w-4 h-4" />
            {displayBalance}
        </div>
    );
};

const UsersManagement = () => {
    const { address } = useAccount();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUserData, setNewUserData] = useState({
        username: '',
        email: '',
        walletAddress: '',
        role: 'USER',
        subscription: 'FREE',
        isVendor: false
    });

    // Fetch users
    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${API_URL}/admin/users/all`, {
                headers: {
                    'x-wallet-address': address
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }

            const data = await response.json();

            if (data.success) {
                setUsers(data.users);
            } else {
                throw new Error(data.error || 'Failed to fetch users');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setError(error.message || 'Error al cargar usuarios');
            toast.error('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (address) {
            fetchUsers();
        }
    }, [address]);

    // Update user role
    const handleUpdateRole = async (userId, newRole) => {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': address
                },
                body: JSON.stringify({ role: newRole })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update role');
            }

            if (data.success) {
                const roleLabel = ROLE_CONFIG[newRole]?.label || newRole;
                toast.success(`Rol actualizado a ${roleLabel}`);
                fetchUsers(); // Refresh list
                setShowRoleModal(false);
                setSelectedUser(null);
            }
        } catch (error) {
            console.error('Error updating role:', error);
            toast.error(error.message);
        }
    };

    // Update user subscription
    const handleUpdateSubscription = async (userId, newSubscription) => {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/subscription`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': address
                },
                body: JSON.stringify({ subscription: newSubscription })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update subscription');
            }

            if (data.success) {
                toast.success(`Suscripción actualizada a ${SUBSCRIPTION_CONFIG[newSubscription]?.label}`);
                setShowSubscriptionModal(false);
                setSelectedUser(null);
                fetchUsers();
            }
        } catch (error) {
            console.error('Error updating subscription:', error);
            toast.error(error.message);
        }
    };

    // Ban/Unban user
    const handleToggleBan = async (userId, currentBanStatus) => {
        try {
            const newBanStatus = !currentBanStatus;

            const response = await fetch(`${API_URL}/admin/users/${userId}/ban`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': address
                },
                body: JSON.stringify({ banned: newBanStatus })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update ban status');
            }

            if (data.success) {
                toast.success(newBanStatus ? 'Usuario baneado' : 'Usuario desbaneado');
                fetchUsers();
            }
        } catch (error) {
            console.error('Error toggling ban:', error);
            toast.error(error.message);
        }
    };

    // Create new user
    const handleCreateUser = async (e) => {
        e.preventDefault();

        if (!newUserData.walletAddress) {
            toast.error('Wallet address es requerido');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/admin/users/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-address': address
                },
                body: JSON.stringify(newUserData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create user');
            }

            if (data.success) {
                toast.success(`Usuario ${newUserData.isVendor ? 'y Vendor' : ''} creado exitosamente`);
                setShowCreateModal(false);
                setNewUserData({
                    username: '',
                    email: '',
                    walletAddress: '',
                    role: 'USER',
                    subscription: 'FREE',
                    isVendor: false
                });
                fetchUsers();
            }
        } catch (error) {
            console.error('Error creating user:', error);
            toast.error(error.message);
        }
    };

    // Filter users (with validation for invalid roles)
    const filteredUsers = users.filter(user => {
        // Normalize role to handle undefined or invalid values
        const userRole = user.role && ROLE_CONFIG[user.role] ? user.role : 'USER';

        const matchesSearch =
            user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.walletAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesRole = roleFilter === 'ALL' || userRole === roleFilter;

        return matchesSearch && matchesRole;
    });

    // Get role stats (normalize roles)
    const roleStats = Object.keys(ROLE_CONFIG).reduce((acc, role) => {
        acc[role] = users.filter(u => {
            const userRole = u.role && ROLE_CONFIG[u.role] ? u.role : 'USER';
            return userRole === role;
        }).length;
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                <button
                    onClick={fetchUsers}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                    <Shield className="w-4 h-4" />
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Gestión de Usuarios
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Total de usuarios: {users.length}
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                    <UserPlus className="w-5 h-5" />
                    Crear Usuario
                </button>
            </div>

            {/* Role Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(ROLE_CONFIG).map(([role, config]) => {
                    const Icon = config.icon;
                    return (
                        <div
                            key={role}
                            className={`${config.bgColor} border ${config.borderColor} p-4 rounded-xl transition-all hover:scale-105 cursor-pointer`}
                            onClick={() => setRoleFilter(roleFilter === role ? 'ALL' : role)}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Icon className={`w-5 h-5 ${config.textColor}`} />
                                <span className={`text-2xl font-bold ${config.textColor}`}>
                                    {roleStats[role] || 0}
                                </span>
                            </div>
                            <div className={`text-xs font-medium ${config.textColor}`}>
                                {config.label}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, wallet o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-white"
                    />
                </div>
                <div className="relative min-w-[200px]">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-white appearance-none cursor-pointer"
                    >
                        <option value="ALL">Todos los roles</option>
                        {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                            <option key={role} value={role}>
                                {config.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                    Usuario
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                    Wallet
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                    Rol
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                    Balance (BEZ)
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                    Subscripción
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                    Estado
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredUsers.map((user) => {
                                // Default to USER role if role is undefined or not in config
                                const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.USER;
                                const RoleIcon = roleConfig?.icon || Users;

                                return (
                                    <tr
                                        key={user.id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                                                    {user.username?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div className="ml-3">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {user.username || 'Sin nombre'}
                                                    </div>
                                                    {user.email && (
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {user.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                                {user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${roleConfig.bgColor} ${roleConfig.textColor} border ${roleConfig.borderColor}`}>
                                                <RoleIcon className="w-4 h-4" />
                                                <span className="text-xs font-semibold">
                                                    {roleConfig.label}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.walletAddress ? (
                                                <TokenBalanceCell address={user.walletAddress} />
                                            ) : (
                                                <span className="text-gray-400 text-xs">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${user.subscription === 'VIP'
                                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                                : user.subscription === 'PREMIUM'
                                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                                }`}>
                                                {SUBSCRIPTION_CONFIG[user.subscription]?.label || user.subscription}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {user.isVerified && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Verificado
                                                    </span>
                                                )}
                                                {user.isBanned && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                                        <Ban className="w-3 h-3" />
                                                        Baneado
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setShowRoleModal(true);
                                                    }}
                                                    className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                                                    title="Cambiar rol"
                                                >
                                                    <UserCog className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setShowSubscriptionModal(true);
                                                    }}
                                                    className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
                                                    title="Cambiar suscripción"
                                                >
                                                    <CreditCard className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleBan(user.id, user.isBanned)}
                                                    className={`p-2 rounded-lg transition-colors ${user.isBanned
                                                        ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30'
                                                        : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
                                                        }`}
                                                    title={user.isBanned ? 'Desbanear' : 'Banear'}
                                                >
                                                    {user.isBanned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">
                            No se encontraron usuarios
                        </p>
                    </div>
                )}
            </div>

            {/* Role Change Modal */}
            {showRoleModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Cambiar Rol de Usuario
                        </h3>

                        <div className="mb-6">
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                Usuario seleccionado:
                            </div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                {selectedUser.username} ({selectedUser.walletAddress?.slice(0, 10)}...)
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Rol actual: <span className="font-semibold">{ROLE_CONFIG[selectedUser.role]?.label || selectedUser.role}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                            {Object.entries(ROLE_CONFIG).map(([role, config]) => {
                                const Icon = config.icon;
                                const isCurrentRole = selectedUser.role === role;

                                return (
                                    <button
                                        key={role}
                                        onClick={() => !isCurrentRole && handleUpdateRole(selectedUser.id, role)}
                                        disabled={isCurrentRole}
                                        className={`
                      p-4 rounded-xl border-2 text-left transition-all
                      ${isCurrentRole
                                                ? `${config.bgColor} ${config.borderColor} opacity-50 cursor-not-allowed`
                                                : `${config.bgColor} ${config.borderColor} hover:scale-105 cursor-pointer`
                                            }
                    `}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <Icon className={`w-6 h-6 ${config.textColor}`} />
                                            <span className={`font-bold ${config.textColor}`}>
                                                {config.label}
                                            </span>
                                        </div>
                                        <p className={`text-xs ${config.textColor} opacity-80`}>
                                            {config.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowRoleModal(false);
                                    setSelectedUser(null);
                                }}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Subscription Modal */}
            {showSubscriptionModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Cambiar Suscripción
                        </h3>

                        <div className="mb-6">
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                Usuario seleccionado:
                            </div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                {selectedUser.username} ({selectedUser.walletAddress?.slice(0, 10)}...)
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Suscripción actual: <span className="font-semibold">{SUBSCRIPTION_CONFIG[selectedUser.subscription]?.label || selectedUser.subscription}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 mb-6">
                            {Object.entries(SUBSCRIPTION_CONFIG).map(([tier, config]) => {
                                const isCurrentTier = selectedUser.subscription === tier;

                                return (
                                    <button
                                        key={tier}
                                        onClick={() => !isCurrentTier && handleUpdateSubscription(selectedUser.id, tier)}
                                        disabled={isCurrentTier}
                                        className={`
                                            p-4 rounded-xl border-2 text-left transition-all
                                            ${isCurrentTier
                                                ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed'
                                                : tier === 'VIP'
                                                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 hover:scale-105 cursor-pointer'
                                                    : tier === 'PREMIUM'
                                                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 hover:scale-105 cursor-pointer'
                                                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 hover:scale-105 cursor-pointer'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className={`font-bold text-lg mb-1 ${tier === 'VIP' ? 'text-purple-700 dark:text-purple-300' :
                                                    tier === 'PREMIUM' ? 'text-yellow-700 dark:text-yellow-300' :
                                                        'text-gray-700 dark:text-gray-300'
                                                    }`}>
                                                    {config.label}
                                                </div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                                    {tier === 'VIP' ? 'Acceso completo a todas las características' :
                                                        tier === 'PREMIUM' ? 'Características avanzadas y beneficios exclusivos' :
                                                            'Acceso básico a la plataforma'}
                                                </div>
                                            </div>
                                            {isCurrentTier && (
                                                <CheckCircle className="w-6 h-6 text-green-600" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                Crear Nuevo Usuario
                            </h3>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewUserData({
                                        username: '',
                                        email: '',
                                        walletAddress: '',
                                        role: 'USER',
                                        subscription: 'FREE',
                                        isVendor: false
                                    });
                                }}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            {/* Username */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        Nombre de Usuario
                                    </div>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newUserData.username}
                                    onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                                    placeholder="johndoe"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        Email
                                    </div>
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={newUserData.email}
                                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                                    placeholder="john@example.com"
                                />
                            </div>

                            {/* Wallet Address */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    <div className="flex items-center gap-2">
                                        <Wallet className="w-4 h-4" />
                                        Dirección de Wallet
                                    </div>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newUserData.walletAddress}
                                    onChange={(e) => setNewUserData({ ...newUserData, walletAddress: e.target.value.toLowerCase() })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white font-mono text-sm"
                                    placeholder="0x..."
                                />
                            </div>

                            {/* Role Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Rol
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {Object.entries(ROLE_CONFIG).map(([role, config]) => {
                                        const Icon = config.icon;
                                        const isSelected = newUserData.role === role;

                                        return (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => setNewUserData({ ...newUserData, role })}
                                                className={`
                                                    p-3 rounded-lg border-2 text-left transition-all
                                                    ${isSelected
                                                        ? `${config.bgColor} ${config.borderColor} ring-2 ring-purple-500`
                                                        : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-purple-400'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Icon className={`w-5 h-5 ${isSelected ? config.textColor : 'text-gray-500'}`} />
                                                    <span className={`font-semibold text-sm ${isSelected ? config.textColor : 'text-gray-700 dark:text-gray-300'}`}>
                                                        {config.label}
                                                    </span>
                                                </div>
                                                <p className={`text-xs mt-1 ${isSelected ? config.textColor : 'text-gray-500'} opacity-80`}>
                                                    {config.description}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Subscription */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Suscripción
                                </label>
                                <select
                                    value={newUserData.subscription}
                                    onChange={(e) => setNewUserData({ ...newUserData, subscription: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                                >
                                    <option value="FREE">Free - Acceso básico</option>
                                    <option value="PREMIUM">Premium - Características avanzadas</option>
                                    <option value="VIP">VIP - Acceso completo</option>
                                </select>
                            </div>

                            {/* Vendor Toggle */}
                            <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="isVendor"
                                    checked={newUserData.isVendor}
                                    onChange={(e) => setNewUserData({ ...newUserData, isVendor: e.target.checked })}
                                    className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                />
                                <label htmlFor="isVendor" className="flex items-center gap-2 cursor-pointer flex-1">
                                    <Store className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            Crear como Vendor
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                            El usuario podrá vender en el marketplace
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewUserData({
                                            username: '',
                                            email: '',
                                            walletAddress: '',
                                            role: 'USER',
                                            subscription: 'FREE',
                                            isVendor: false
                                        });
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Crear Usuario
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersManagement;
