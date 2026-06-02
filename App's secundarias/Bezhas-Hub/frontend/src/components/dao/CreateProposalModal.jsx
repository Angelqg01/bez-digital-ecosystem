import React, { useState } from 'react';
import { X, FileText, DollarSign, Settings, MessageSquare, Code, TrendingUp, Wallet } from 'lucide-react';
import { useDAO } from '../../context/DAOContext';
import { useBezCoin } from '../../context/BezCoinContext';
import { useConnect } from 'wagmi';
import toast from 'react-hot-toast';

const categories = [
    { id: 'treasury', label: 'Tesorería', icon: DollarSign, color: 'text-green-400' },
    { id: 'governance', label: 'Gobernanza', icon: Settings, color: 'text-blue-400' },
    { id: 'protocol', label: 'Protocolo', icon: Code, color: 'text-purple-400' },
    { id: 'marketing', label: 'Marketing', icon: TrendingUp, color: 'text-pink-400' },
    { id: 'development', label: 'Desarrollo', icon: Code, color: 'text-cyan-400' },
    { id: 'general', label: 'General', icon: MessageSquare, color: 'text-gray-400' },
];

const CreateProposalModal = ({ isOpen, onClose }) => {
    const { createProposal, daoState } = useDAO();
    const { balance, setShowBuyModal } = useBezCoin();
    const { connect, connectors } = useConnect();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'general',
        actions: [],
    });

    const [actionForm, setActionForm] = useState({
        type: 'transfer',
        target: '',
        value: '',
        data: '',
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const addAction = () => {
        if (!actionForm.target || !actionForm.value) {
            toast.error('Completa todos los campos de la acción');
            return;
        }

        setFormData({
            ...formData,
            actions: [...formData.actions, { ...actionForm }],
        });

        setActionForm({
            type: 'transfer',
            target: '',
            value: '',
            data: '',
        });
    };

    const removeAction = (index) => {
        setFormData({
            ...formData,
            actions: formData.actions.filter((_, i) => i !== index),
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title || !formData.description) {
            toast.error('Completa todos los campos requeridos');
            return;
        }

        // Verificar balance BEZ
        const threshold = daoState?.settings?.proposalThreshold || 100000;
        const currentBalance = parseFloat(balance || '0');

        if (currentBalance < threshold) {
            const deficit = threshold - currentBalance;
            toast.error(`Balance insuficiente. Necesitas ${deficit.toLocaleString()} BEZ más.`, {
                duration: 5000,
                icon: '⚠️'
            });

            // Cerrar este modal y abrir modal de compra
            onClose();
            setShowBuyModal(true);
            return;
        }

        setLoading(true);

        const success = await createProposal(formData);

        setLoading(false);

        if (success) {
            setFormData({
                title: '',
                description: '',
                category: 'general',
                actions: [],
            });
            onClose();
        }
    };

    if (!isOpen) return null;

    const threshold = daoState?.settings?.proposalThreshold || 100000;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-purple-500/30 shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm p-6 border-b border-purple-500/30 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <FileText className="w-6 h-6 text-purple-400" />
                            Nueva Propuesta
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Requiere mínimo {threshold.toLocaleString()} BEZ tokens
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Título */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Título *
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="Ej: Aumentar el presupuesto de marketing en Q1 2025"
                            className="w-full bg-gray-800/50 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                            maxLength={120}
                        />
                        <div className="text-xs text-gray-500 mt-1 text-right">
                            {formData.title.length}/120
                        </div>
                    </div>

                    {/* Categoría */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                            Categoría *
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {categories.map((cat) => {
                                const Icon = cat.icon;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, category: cat.id })}
                                        className={`p-4 rounded-lg border-2 transition-all ${formData.category === cat.id
                                            ? 'bg-purple-500/20 border-purple-500'
                                            : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <Icon className={`w-5 h-5 ${cat.color} mx-auto mb-2`} />
                                        <div className="text-xs text-white font-medium">{cat.label}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Descripción */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Descripción *
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Describe detalladamente tu propuesta, objetivos, razones y plan de implementación..."
                            rows={6}
                            className="w-full bg-gray-800/50 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                            maxLength={2000}
                        />
                        <div className="text-xs text-gray-500 mt-1 text-right">
                            {formData.description.length}/2000
                        </div>
                    </div>

                    {/* Acciones (opcional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Acciones a Ejecutar (Opcional)
                        </label>
                        <div className="bg-gray-800/30 rounded-lg p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <select
                                    value={actionForm.type}
                                    onChange={(e) => setActionForm({ ...actionForm, type: e.target.value })}
                                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                                >
                                    <option value="transfer">Transferencia</option>
                                    <option value="updateSettings">Actualizar Config</option>
                                    <option value="addRole">Añadir Rol</option>
                                    <option value="custom">Personalizado</option>
                                </select>
                                <input
                                    type="text"
                                    value={actionForm.target}
                                    onChange={(e) => setActionForm({ ...actionForm, target: e.target.value })}
                                    placeholder="Dirección destino"
                                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    value={actionForm.value}
                                    onChange={(e) => setActionForm({ ...actionForm, value: e.target.value })}
                                    placeholder="Valor (ej: 10000)"
                                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                />
                                <button
                                    type="button"
                                    onClick={addAction}
                                    className="bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Añadir Acción
                                </button>
                            </div>

                            {/* Lista de acciones */}
                            {formData.actions.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {formData.actions.map((action, index) => (
                                        <div
                                            key={index}
                                            className="bg-gray-900/50 rounded-lg p-3 flex justify-between items-center"
                                        >
                                            <div className="text-sm">
                                                <span className="text-purple-400 font-medium">{action.type}</span>
                                                <span className="text-gray-500 mx-2">→</span>
                                                <span className="text-gray-300">{action.target}</span>
                                                <span className="text-gray-500 mx-2">|</span>
                                                <span className="text-green-400">{action.value}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeAction(index)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Información de Votación */}
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-purple-400 mb-2">Información de Votación</h3>
                        <ul className="text-xs text-gray-400 space-y-1">
                            <li>• Período de votación: {daoState?.settings?.votingPeriodDays || 7} días</li>
                            <li>• Quorum requerido: {daoState?.settings?.quorumPercentage || 10}% de tokens</li>
                            <li>• La propuesta se ejecutará automáticamente si es aprobada</li>
                        </ul>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creando...' : 'Crear Propuesta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProposalModal;
