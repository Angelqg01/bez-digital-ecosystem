import React, { useState, useEffect } from 'react';
import {
    Key,
    Plus,
    Edit,
    Trash2,
    RefreshCw,
    Copy,
    TrendingUp,
    Eye,
    EyeOff,
    AlertCircle,
    CheckCircle,
    Shield,
    Activity
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const BridgeApiKeysManager = () => {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openStatsDialog, setOpenStatsDialog] = useState(false);
    const [selectedKey, setSelectedKey] = useState(null);
    const [keyStats, setKeyStats] = useState(null);
    const [showKeyValue, setShowKeyValue] = useState({});
    const [newKeyData, setNewKeyData] = useState({
        userId: '',
        name: '',
        description: '',
        platform: 'other',
        permissions: {
            inventory: false,
            logistics: false,
            payments: false,
            orders: false
        },
        rateLimit: {
            requestsPerMinute: 100,
            requestsPerDay: 10000
        },
        expiresAt: '',
        ipWhitelist: []
    });
    const [createdKey, setCreatedKey] = useState(null);

    useEffect(() => {
        loadKeys();
    }, []);

    const loadKeys = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${API_BASE}/api/v1/bridge/admin/keys`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setKeys(response.data.data.keys);
        } catch (err) {
            console.error('Error loading API keys:', err);
            setError(err.response?.data?.message || 'Failed to load API keys');
            toast.error('Error loading API keys');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateKey = async () => {
        try {
            setError(null);
            const token = localStorage.getItem('adminToken');
            const response = await axios.post(
                `${API_BASE}/api/v1/bridge/admin/keys`,
                newKeyData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setCreatedKey(response.data.data);
            await loadKeys();
            toast.success('API Key created successfully');

            // Reset form
            setNewKeyData({
                userId: '',
                name: '',
                description: '',
                platform: 'other',
                permissions: {
                    inventory: false,
                    logistics: false,
                    payments: false,
                    orders: false
                },
                rateLimit: {
                    requestsPerMinute: 100,
                    requestsPerDay: 10000
                },
                expiresAt: '',
                ipWhitelist: []
            });
        } catch (err) {
            console.error('Error creating API key:', err);
            setError(err.response?.data?.message || 'Failed to create API key');
            toast.error('Failed to create API key');
        }
    };

    const handleUpdateKey = async () => {
        try {
            setError(null);
            const token = localStorage.getItem('adminToken');
            await axios.patch(
                `${API_BASE}/api/v1/bridge/admin/keys/${selectedKey._id}`,
                selectedKey,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setOpenEditDialog(false);
            setSelectedKey(null);
            await loadKeys();
            toast.success('API Key updated successfully');
        } catch (err) {
            console.error('Error updating API key:', err);
            setError(err.response?.data?.message || 'Failed to update API key');
            toast.error('Failed to update API key');
        }
    };

    const handleDeleteKey = async (keyId) => {
        if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
            return;
        }

        try {
            setError(null);
            const token = localStorage.getItem('adminToken');
            await axios.delete(`${API_BASE}/api/v1/bridge/admin/keys/${keyId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await loadKeys();
            toast.success('API Key deleted successfully');
        } catch (err) {
            console.error('Error deleting API key:', err);
            setError(err.response?.data?.message || 'Failed to delete API key');
            toast.error('Failed to delete API key');
        }
    };

    const handleRegenerateKey = async (keyId) => {
        if (!confirm('Are you sure you want to regenerate this key? The old key will stop working immediately.')) {
            return;
        }

        try {
            setError(null);
            const token = localStorage.getItem('adminToken');
            const response = await axios.post(
                `${API_BASE}/api/v1/bridge/admin/keys/${keyId}/regenerate`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setCreatedKey(response.data.data);
            setOpenCreateDialog(true);
            await loadKeys();
            toast.success('API Key regenerated successfully');
        } catch (err) {
            console.error('Error regenerating API key:', err);
            setError(err.response?.data?.message || 'Failed to regenerate API key');
            toast.error('Failed to regenerate API key');
        }
    };

    const handleViewStats = async (keyId) => {
        try {
            setError(null);
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${API_BASE}/api/v1/bridge/admin/keys/${keyId}/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setKeyStats(response.data.data);
            setOpenStatsDialog(true);
        } catch (err) {
            console.error('Error loading stats:', err);
            setError(err.response?.data?.message || 'Failed to load stats');
            toast.error('Failed to load stats');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    const getPlatformColor = (platform) => {
        const colors = {
            vinted: 'bg-blue-100 text-blue-800',
            amazon: 'bg-yellow-100 text-yellow-800',
            ebay: 'bg-red-100 text-red-800',
            maersk: 'bg-indigo-100 text-indigo-800',
            fedex: 'bg-purple-100 text-purple-800',
            dhl: 'bg-green-100 text-green-800',
            stripe: 'bg-blue-100 text-blue-800',
            paypal: 'bg-indigo-100 text-indigo-800',
            other: 'bg-gray-100 text-gray-800'
        };
        return colors[platform] || 'bg-gray-100 text-gray-800';
    };

    const toggleKeyVisibility = (keyId) => {
        setShowKeyValue(prev => ({ ...prev, [keyId]: !prev[keyId] }));
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Key className="w-8 h-8 text-purple-500" />
                        Bridge API Keys Manager
                    </h1>
                    <p className="text-gray-600 mt-1">Manage API keys for platform integrations</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadKeys}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button
                        onClick={() => setOpenCreateDialog(true)}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Create New Key
                    </button>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-red-800">Error</h3>
                        <p className="text-red-600">{error}</p>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm">Total Keys</p>
                            <p className="text-2xl font-bold text-gray-900">{keys.length}</p>
                        </div>
                        <Key className="w-8 h-8 text-purple-500" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm">Active Keys</p>
                            <p className="text-2xl font-bold text-green-600">
                                {keys.filter(k => k.status === 'active').length}
                            </p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm">Inactive Keys</p>
                            <p className="text-2xl font-bold text-gray-600">
                                {keys.filter(k => k.status !== 'active').length}
                            </p>
                        </div>
                        <Shield className="w-8 h-8 text-gray-400" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm">Total Requests</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {keys.reduce((sum, k) => sum + (k.usage?.totalRequests || 0), 0)}
                            </p>
                        </div>
                        <Activity className="w-8 h-8 text-blue-500" />
                    </div>
                </div>
            </div>

            {/* Keys Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Platform
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Key
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Requests
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Created
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {keys.map((key) => (
                                <tr key={key._id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="font-medium text-gray-900">{key.name}</div>
                                            <div className="text-sm text-gray-500">{key.description}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(key.platform)}`}>
                                            {key.platform}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                {showKeyValue[key._id] ? key.key : `${key.key?.substring(0, 8)}...`}
                                            </code>
                                            <button
                                                onClick={() => toggleKeyVisibility(key._id)}
                                                className="text-gray-400 hover:text-gray-600 transition"
                                            >
                                                {showKeyValue[key._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(key.key)}
                                                className="text-gray-400 hover:text-gray-600 transition"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${key.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {key.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {key.usage?.totalRequests || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(key.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleViewStats(key._id)}
                                                className="text-blue-600 hover:text-blue-900 transition"
                                                title="View Stats"
                                            >
                                                <TrendingUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedKey(key);
                                                    setOpenEditDialog(true);
                                                }}
                                                className="text-purple-600 hover:text-purple-900 transition"
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleRegenerateKey(key._id)}
                                                className="text-orange-600 hover:text-orange-900 transition"
                                                title="Regenerate"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteKey(key._id)}
                                                className="text-red-600 hover:text-red-900 transition"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {keys.length === 0 && (
                        <div className="text-center py-12">
                            <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No API keys found. Create your first key to get started.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Dialog */}
            {openCreateDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {createdKey ? 'API Key Created Successfully!' : 'Create New API Key'}
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            {createdKey ? (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="w-6 h-6 text-green-500 mt-0.5" />
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-green-800 mb-2">Save this key securely!</h3>
                                            <p className="text-green-700 text-sm mb-4">
                                                You won't be able to see it again.
                                            </p>
                                            <div className="bg-white p-3 rounded border border-green-300">
                                                <code className="text-sm break-all">{createdKey.key}</code>
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(createdKey.key)}
                                                className="mt-3 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2"
                                            >
                                                <Copy className="w-4 h-4" />
                                                Copy to Clipboard
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                                        <input
                                            type="text"
                                            value={newKeyData.name}
                                            onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            placeholder="My API Key"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                        <textarea
                                            value={newKeyData.description}
                                            onChange={(e) => setNewKeyData({ ...newKeyData, description: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            rows="3"
                                            placeholder="Description of this API key"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                                        <select
                                            value={newKeyData.platform}
                                            onChange={(e) => setNewKeyData({ ...newKeyData, platform: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        >
                                            <option value="other">Other</option>
                                            <option value="vinted">Vinted</option>
                                            <option value="amazon">Amazon</option>
                                            <option value="ebay">eBay</option>
                                            <option value="maersk">Maersk</option>
                                            <option value="fedex">FedEx</option>
                                            <option value="dhl">DHL</option>
                                            <option value="stripe">Stripe</option>
                                            <option value="paypal">PayPal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                                        <div className="space-y-2">
                                            {Object.keys(newKeyData.permissions).map((perm) => (
                                                <label key={perm} className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={newKeyData.permissions[perm]}
                                                        onChange={(e) => setNewKeyData({
                                                            ...newKeyData,
                                                            permissions: { ...newKeyData.permissions, [perm]: e.target.checked }
                                                        })}
                                                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                                    />
                                                    <span className="text-sm text-gray-700 capitalize">{perm}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Requests Per Minute
                                            </label>
                                            <input
                                                type="number"
                                                value={newKeyData.rateLimit.requestsPerMinute}
                                                onChange={(e) => setNewKeyData({
                                                    ...newKeyData,
                                                    rateLimit: { ...newKeyData.rateLimit, requestsPerMinute: parseInt(e.target.value) }
                                                })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Requests Per Day
                                            </label>
                                            <input
                                                type="number"
                                                value={newKeyData.rateLimit.requestsPerDay}
                                                onChange={(e) => setNewKeyData({
                                                    ...newKeyData,
                                                    rateLimit: { ...newKeyData.rateLimit, requestsPerDay: parseInt(e.target.value) }
                                                })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setOpenCreateDialog(false);
                                    setCreatedKey(null);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                {createdKey ? 'Close' : 'Cancel'}
                            </button>
                            {!createdKey && (
                                <button
                                    onClick={handleCreateKey}
                                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
                                >
                                    Create Key
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Dialog */}
            {openEditDialog && selectedKey && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-2xl font-bold text-gray-900">Edit API Key</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                <input
                                    type="text"
                                    value={selectedKey.name}
                                    onChange={(e) => setSelectedKey({ ...selectedKey, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                <select
                                    value={selectedKey.status}
                                    onChange={(e) => setSelectedKey({ ...selectedKey, status: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setOpenEditDialog(false);
                                    setSelectedKey(null);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateKey}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Dialog */}
            {openStatsDialog && keyStats && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <TrendingUp className="w-6 h-6 text-purple-500" />
                                API Key Statistics
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <p className="text-gray-600 text-sm mb-1">Total Requests</p>
                                    <p className="text-2xl font-bold text-gray-900">{keyStats.totalRequests || 0}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <p className="text-green-600 text-sm mb-1">Successful</p>
                                    <p className="text-2xl font-bold text-green-700">{keyStats.successfulRequests || 0}</p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg">
                                    <p className="text-red-600 text-sm mb-1">Failed</p>
                                    <p className="text-2xl font-bold text-red-700">{keyStats.failedRequests || 0}</p>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-blue-600 text-sm mb-1">Last Used</p>
                                    <p className="text-sm font-medium text-blue-700">
                                        {keyStats.lastUsed ? new Date(keyStats.lastUsed).toLocaleDateString() : 'Never'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => {
                                    setOpenStatsDialog(false);
                                    setKeyStats(null);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BridgeApiKeysManager;
