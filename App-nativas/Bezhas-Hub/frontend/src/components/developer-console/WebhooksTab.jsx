import React, { useState, useEffect } from 'react';
import { Plus as PlusIcon, Webhook as WebhookIcon, Trash2 as Trash2Icon } from 'lucide-react';
import http from '../../services/http';
import { toast } from 'react-hot-toast';

// Helper function to get stored auth token
const getAuthToken = () => {
    // First try AuthContext token from localStorage
    const authData = localStorage.getItem('auth');
    if (authData) {
        try {
            const parsed = JSON.parse(authData);
            if (parsed.token) return parsed.token;
        } catch (e) { /* ignore */ }
    }
    // Fallback to direct token (for backward compatibility)
    return localStorage.getItem('bezhas-jwt') || localStorage.getItem('token');
};

// Modal para Agregar Webhook
const AddWebhookModal = ({ onClose, onAdd }) => {
    const [formData, setFormData] = useState({
        url: '',
        events: [],
        secret: ''
    });

    const availableEvents = [
        'shipment.created',
        'shipment.updated',
        'payment.completed',
        'escrow.released',
        'kyc.verified',
        'property.tokenized',
        'marketplace.sale',
        'nft.minted',
        'token.transferred'
    ];

    const toggleEvent = (event) => {
        setFormData(prev => ({
            ...prev,
            events: prev.events.includes(event)
                ? prev.events.filter(e => e !== event)
                : [...prev.events, event]
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.url) {
            toast.error('La URL es requerida');
            return;
        }
        if (formData.events.length === 0) {
            toast.error('Selecciona al menos un evento');
            return;
        }

        // Validar URL
        try {
            new URL(formData.url);
        } catch (e) {
            toast.error('URL inválida');
            return;
        }

        onAdd(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Agregar Webhook
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            URL del Webhook *
                        </label>
                        <input
                            type="url"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                            placeholder="https://tu-sitio.com/webhook"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Secret (opcional)
                        </label>
                        <input
                            type="text"
                            value={formData.secret}
                            onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                            placeholder="Dejar vacío para auto-generar"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Selecciona los Eventos *
                        </label>
                        <div className="space-y-2">
                            {availableEvents.map(event => (
                                <label key={event} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.events.includes(event)}
                                        onChange={() => toggleEvent(event)}
                                        className="rounded text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{event}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                        >
                            Agregar Webhook
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Tab 2: Webhooks
const WebhooksTab = ({ apiKeys }) => {
    const [webhooks, setWebhooks] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedApiKey, setSelectedApiKey] = useState(apiKeys[0]?._id || '');
    const [loading, setLoading] = useState(false);

    // Cargar webhooks cuando se selecciona una API Key
    useEffect(() => {
        if (selectedApiKey) {
            fetchWebhooks();
        }
    }, [selectedApiKey]);

    const fetchWebhooks = async () => {
        if (!selectedApiKey) return;

        try {
            setLoading(true);
            const token = getAuthToken();
            const response = await http.get(`/api/developer/keys/${selectedApiKey}/webhooks`);
            setWebhooks(response.data.data || []);
        } catch (error) {
            console.error('Error al cargar webhooks:', error);
            if (error.response?.status !== 404) {
                toast.error('Error al cargar webhooks');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAddWebhook = async (webhookData) => {
        if (!selectedApiKey) {
            toast.error('Selecciona una API Key primero');
            return;
        }

        try {
            const token = getAuthToken();
            await http.post(`/api/developer/keys/${selectedApiKey}/webhooks`, webhookData);
            toast.success('Webhook agregado exitosamente');
            setShowAddModal(false);
            fetchWebhooks();
        } catch (error) {
            console.error('Error al agregar webhook:', error);
            toast.error(error.response?.data?.error || 'Error al agregar webhook');
        }
    };

    const handleDeleteWebhook = async (webhookId) => {
        if (!window.confirm('¿Eliminar este webhook?')) return;

        try {
            const token = getAuthToken();
            await http.delete(`/api/developer/keys/${selectedApiKey}/webhooks/${webhookId}`);
            toast.success('Webhook eliminado');
            fetchWebhooks();
        } catch (error) {
            console.error('Error al eliminar webhook:', error);
            toast.error('Error al eliminar webhook');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Webhooks</h2>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Recibe notificaciones en tiempo real de eventos en tu aplicación
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        disabled={!selectedApiKey}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        title={selectedApiKey ? 'Agregar un nuevo webhook a tu API Key' : 'Selecciona una API Key primero'}
                    >
                        <PlusIcon className="w-5 h-5" />
                        Añadir Webhook
                    </button>
                </div>

                {/* API Key Selector */}
                {apiKeys.length > 0 && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Selecciona tu API Key
                        </label>
                        <select
                            value={selectedApiKey}
                            onChange={(e) => setSelectedApiKey(e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                            {apiKeys.map(key => (
                                <option key={key._id} value={key._id}>{key.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mx-auto"></div>
                    </div>
                ) : webhooks.length === 0 ? (
                    <div className="text-center py-12">
                        <WebhookIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">No tienes webhooks configurados</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            disabled={!selectedApiKey}
                            className="mt-4 text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                        >
                            Crear tu primer webhook
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {webhooks.map(webhook => (
                            <div key={webhook._id || webhook.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 dark:text-white">{webhook.url}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Eventos: {webhook.events.join(', ')}
                                        </p>
                                        {webhook.secret && (
                                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-mono">
                                                Secret: {webhook.secret.substring(0, 20)}...
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteWebhook(webhook._id || webhook.id)}
                                        className="text-red-600 hover:text-red-700 ml-4"
                                    >
                                        <Trash2Icon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Events Documentation */}
                <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-3">Eventos Disponibles</h3>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <li>• <code className="text-purple-600">shipment.created</code> - Nuevo envío creado</li>
                        <li>• <code className="text-purple-600">shipment.updated</code> - Estado de envío actualizado</li>
                        <li>• <code className="text-purple-600">payment.completed</code> - Pago completado</li>
                        <li>• <code className="text-purple-600">escrow.released</code> - Fondos de escrow liberados</li>
                        <li>• <code className="text-purple-600">kyc.verified</code> - KYC verificado</li>
                        <li>• <code className="text-purple-600">property.tokenized</code> - Propiedad tokenizada</li>
                    </ul>
                </div>
            </div>

            {/* Modal para agregar webhook */}
            {showAddModal && (
                <AddWebhookModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddWebhook}
                />
            )}
        </div>
    );
};

export default WebhooksTab;
