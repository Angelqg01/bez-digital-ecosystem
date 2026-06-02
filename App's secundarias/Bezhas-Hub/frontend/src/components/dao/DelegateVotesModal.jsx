import React, { useState } from 'react';
import { X, Users, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useDAO } from '../../context/DAOContext';
import { useBezCoin } from '../../context/BezCoinContext';
import toast from 'react-hot-toast';

const DelegateVotesModal = ({ isOpen, onClose }) => {
    const { delegates, delegateVotes, userState, loading } = useDAO();
    const { balance, setShowBuyModal } = useBezCoin();
    const [selectedDelegate, setSelectedDelegate] = useState(null);
    const [customAddress, setCustomAddress] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDelegate = async () => {
        const delegateAddress = customAddress || selectedDelegate?.address;

        if (!delegateAddress) {
            toast.error('Selecciona un delegado o ingresa una dirección');
            return;
        }

        // Validar formato de dirección Ethereum
        if (!/^0x[a-fA-F0-9]{40}$/.test(delegateAddress)) {
            toast.error('Dirección inválida');
            return;
        }

        // Verificar balance mínimo para delegar (algunos DAOs lo requieren)
        const minDelegateBalance = 100; // Mínimo 100 BEZ para delegar
        const currentBalance = parseFloat(balance || '0');

        if (currentBalance < minDelegateBalance) {
            const deficit = minDelegateBalance - currentBalance;
            toast.error(`Balance insuficiente. Necesitas ${deficit.toFixed(2)} BEZ más para delegar votos.`, {
                duration: 5000,
                icon: '⚠️'
            });

            // Cerrar este modal y abrir modal de compra
            onClose();
            setShowBuyModal(true);
            return;
        }

        setIsSubmitting(true);
        const success = await delegateVotes(delegateAddress);
        setIsSubmitting(false);

        if (success) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-500/30 shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm p-6 border-b border-blue-500/30 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Users className="w-6 h-6 text-blue-400" />
                            Delegar Votos
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Tu poder de voto: {userState.votingPower?.toLocaleString() || 0} BEZ
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Delegación actual */}
                    {userState.delegatedTo && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-5 h-5 text-blue-400" />
                                <h3 className="text-sm font-semibold text-blue-400">Delegación Actual</h3>
                            </div>
                            <p className="text-xs text-gray-400">
                                Actualmente delegando a: <span className="text-white font-mono">{userState.delegatedTo}</span>
                            </p>
                        </div>
                    )}

                    {/* Advertencia */}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-yellow-400 mb-1">Importante</h3>
                                <ul className="text-xs text-gray-400 space-y-1">
                                    <li>• El delegado podrá votar con tu poder de voto en todas las propuestas</li>
                                    <li>• Puedes revocar la delegación en cualquier momento</li>
                                    <li>• Tu delegación anterior será reemplazada automáticamente</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Top Delegados */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                            Delegados Populares
                        </h3>
                        <div className="space-y-2">
                            {delegates.slice(0, 5).map((delegate) => (
                                <button
                                    key={delegate.address}
                                    onClick={() => {
                                        setSelectedDelegate(delegate);
                                        setCustomAddress('');
                                    }}
                                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${selectedDelegate?.address === delegate.address
                                        ? 'bg-blue-500/20 border-blue-500'
                                        : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold">
                                                {delegate.username?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div className="text-white font-medium">
                                                    {delegate.username || 'Unknown'}
                                                </div>
                                                <div className="text-xs text-gray-400 font-mono">
                                                    {delegate.address.slice(0, 6)}...{delegate.address.slice(-4)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-purple-400 font-semibold">
                                                {delegate.totalVotingPower?.toLocaleString() || 0} BEZ
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {delegate.delegators?.length || 0} delegadores
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-xs text-gray-400">
                                        <span>📊 {delegate.votesCount || 0} votos</span>
                                        <span>✅ {delegate.participationRate || 0}% participación</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dirección personalizada */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-300 mb-2">O Delegar a Dirección Personalizada</h3>
                        <input
                            type="text"
                            value={customAddress}
                            onChange={(e) => {
                                setCustomAddress(e.target.value);
                                setSelectedDelegate(null);
                            }}
                            placeholder="0x..."
                            className="w-full bg-gray-800/50 border border-blue-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
                        />
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
                            onClick={handleDelegate}
                            disabled={isSubmitting || (!selectedDelegate && !customAddress)}
                            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Delegando...' : 'Delegar Votos'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DelegateVotesModal;
