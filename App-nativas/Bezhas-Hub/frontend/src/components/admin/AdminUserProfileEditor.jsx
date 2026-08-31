import React, { useState } from 'react';
import { Search, Save, User, Shield, Briefcase, Mail, Key, Coins } from 'lucide-react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'ethers';
import http from '../../services/http';
import toast from 'react-hot-toast';

export default function AdminUserProfileEditor() {
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Editable state
    const [formData, setFormData] = useState(null);
    const [newPassword, setNewPassword] = useState('');

    // Fetch token balance
    const { data: balanceData } = useReadContract({
        address: '0x53Eb00e6205eE1ecA78F2da22510BCfDED8CD56E', // Fallback to provided address if not in config
        abi: [{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}],
        functionName: 'balanceOf',
        args: user?.walletAddress ? [user.walletAddress] : undefined,
        query: {
            enabled: !!user?.walletAddress,
            refetchInterval: 30000 // Refresh every 30s
        }
    });

    const displayBalance = balanceData !== undefined ? formatUnits(balanceData, 18) : '0';

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        
        setLoading(true);
        try {
            // Usually we'd have a specific search endpoint or query the users endpoint
            // For this implementation, let's assume /api/admin/v1/users works with ?search= or ?email=
            const res = await http.get(`/api/admin/v1/users?search=${encodeURIComponent(searchQuery)}`, {
                headers: { 'x-wallet-address': localStorage.getItem('adminWalletAddress') || '' }
            });
            const users = res.data.users || [];
            if (users.length === 0) {
                toast.error('No se encontraron usuarios');
                setUser(null);
                setFormData(null);
            } else {
                const foundUser = users[0];
                setUser(foundUser);
                setFormData({
                    username: foundUser.username || '',
                    email: foundUser.email || '',
                    bio: foundUser.bio || '',
                    companyName: foundUser.companyName || '',
                    isVIP: foundUser.isVIP || false,
                    vipTier: foundUser.vipTier || '',
                    roles: foundUser.roles || ['USER'],
                    is2FAEnabled: foundUser.is2FAEnabled || false,
                });
                toast.success('Usuario cargado');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error buscando usuario');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !formData) return;
        setSaving(true);
        try {
            await http.put(`/api/admin/v1/users/${user._id || user.id}/profile`, formData, {
                headers: { 'x-wallet-address': localStorage.getItem('adminWalletAddress') || '' }
            });
            toast.success('Perfil actualizado correctamente');
            setUser({ ...user, ...formData });
        } catch (error) {
            console.error(error);
            toast.error('Error actualizando perfil');
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        if (!user || !newPassword) return;
        if (newPassword.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        setSaving(true);
        try {
            await http.post(`/api/admin/users/${user._id || user.id}/password`, { password: newPassword }, {
                headers: { 'x-wallet-address': localStorage.getItem('adminWalletAddress') || '' }
            });
            toast.success('Contraseña actualizada correctamente');
            setNewPassword('');
        } catch (error) {
            console.error(error);
            toast.error('Error cambiando contraseña');
        } finally {
            setSaving(false);
        }
    };

    const handleRoleToggle = (role) => {
        setFormData(prev => {
            const roles = prev.roles || [];
            if (roles.includes(role)) {
                return { ...prev, roles: roles.filter(r => r !== role) };
            } else {
                return { ...prev, roles: [...roles, role] };
            }
        });
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Configuración Avanzada de Usuarios</h2>
            
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-6">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar usuario por Email, Username o Wallet..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>
            </div>

            {user && formData && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Basic Info */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                            <div className="flex items-center gap-2 mb-4">
                                <User className="text-blue-400" />
                                <h3 className="text-lg font-bold text-white">Información Básica</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Username</label>
                                    <input 
                                        type="text" 
                                        value={formData.username}
                                        onChange={e => setFormData({...formData, username: e.target.value})}
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                                    <input 
                                        type="email" 
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm text-gray-400 mb-1">Biografía</label>
                                    <textarea 
                                        value={formData.bio}
                                        onChange={e => setFormData({...formData, bio: e.target.value})}
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white h-24"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Commercial/Business */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                            <div className="flex items-center gap-2 mb-4">
                                <Briefcase className="text-green-400" />
                                <h3 className="text-lg font-bold text-white">Perfil Comercial</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Nombre Empresa</label>
                                    <input 
                                        type="text" 
                                        value={formData.companyName}
                                        onChange={e => setFormData({...formData, companyName: e.target.value})}
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                    />
                                </div>
                                {/* More commercial fields could go here based on profile setup */}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Roles & Security */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="text-red-400" />
                                <h3 className="text-lg font-bold text-white">Seguridad y Roles</h3>
                            </div>
                            
                            <div className="mb-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.is2FAEnabled}
                                        onChange={e => setFormData({...formData, is2FAEnabled: e.target.checked})}
                                        className="w-4 h-4 rounded border-gray-600 focus:ring-red-500"
                                    />
                                    <span className="text-white">Requires 2FA (Forzar App de Autenticación)</span>
                                </label>
                            </div>

                            {/* BEZ-Coin Balance Display */}
                            <div className="mb-4 p-4 bg-gray-900 border border-gray-700 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                                        <Coins className="text-yellow-500 w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-400">Balance BEZ-Coin</div>
                                        <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200">
                                            {displayBalance} BEZ
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 font-mono">
                                            Wallet: {user?.walletAddress || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-2">Roles del Usuario</label>
                                <div className="space-y-2">
                                    {['USER', 'VERIFIED_BUSINESS', 'ADMIN', 'SUPER_ADMIN', 'DEVELOPER', 'HUMAN_RESOURCES'].map(role => (
                                        <label key={role} className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={(formData.roles || []).includes(role)}
                                                onChange={() => handleRoleToggle(role)}
                                                className="w-4 h-4 rounded border-gray-600 text-blue-500"
                                            />
                                            <span className="text-sm text-gray-200">{role}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <hr className="border-gray-700 my-4" />

                            <div className="mb-2">
                                <label className="block text-sm text-gray-400 mb-2">Forzar Cambio de Contraseña</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="password" 
                                        placeholder="Nueva contraseña (mín 6 carácteres)..."
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-white placeholder-gray-500"
                                    />
                                    <button 
                                        onClick={handlePasswordChange}
                                        disabled={saving || !newPassword}
                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-50"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Subscription / VIP */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                            <div className="flex items-center gap-2 mb-4">
                                <Key className="text-yellow-400" />
                                <h3 className="text-lg font-bold text-white">Suscripción VIP</h3>
                            </div>
                            
                            <div className="mb-4">
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.isVIP}
                                        onChange={e => setFormData({...formData, isVIP: e.target.checked})}
                                        className="w-4 h-4 rounded border-gray-600 text-yellow-500"
                                    />
                                    <span className="text-white font-bold">Estado VIP Activo</span>
                                </label>
                                
                                {formData.isVIP && (
                                    <select 
                                        value={formData.vipTier}
                                        onChange={e => setFormData({...formData, vipTier: e.target.value})}
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white mt-2"
                                    >
                                        <option value="bronze">Bronze</option>
                                        <option value="silver">Silver</option>
                                        <option value="gold">Gold</option>
                                        <option value="platinum">Platinum</option>
                                    </select>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-3 rounded-lg font-bold transition-all disabled:opacity-50"
                            >
                                <Save size={20} />
                                {saving ? 'Guardando...' : 'Guardar Cambios del Usuario'}
                            </button>
                            <button 
                                className="w-full p-3 bg-red-600/20 text-red-500 hover:bg-red-600/30 rounded-lg transition-colors font-medium border border-red-500/20"
                            >
                                Suspender Cuenta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
