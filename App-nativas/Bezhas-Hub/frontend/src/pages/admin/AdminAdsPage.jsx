import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaCheck, FaTimes, FaEye, FaPause, FaPlay, FaBan } from 'react-icons/fa';
import { adminAdsService } from '../../services/adCenter.service';
import toast from 'react-hot-toast';

const AdminAdsPage = () => {
    const [activeTab, setActiveTab] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [campaigns, setCampaigns] = useState([]);
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);

    useEffect(() => {
        loadCampaigns();
    }, [activeTab]);

    const loadCampaigns = async () => {
        setLoading(true);
        try {
            let response;
            if (activeTab === 'pending') {
                response = await adminAdsService.getPendingQueue();
            } else {
                response = await adminAdsService.getAllCampaigns({ status: activeTab === 'all' ? undefined : activeTab });
            }

            if (response.success) {
                setCampaigns(response.data);
            }
        } catch (error) {
            console.error('Error loading campaigns:', error);
            toast.error('Error al cargar campañas');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm('¿Estás seguro de aprobar esta campaña?')) return;

        try {
            const response = await adminAdsService.approveCampaign(id);
            if (response.success) {
                toast.success('Campaña aprobada exitosamente');
                loadCampaigns();
                setSelectedCampaign(null);
            }
        } catch (error) {
            toast.error('Error al aprobar campaña');
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error('Debes proporcionar una razón');
            return;
        }

        try {
            const response = await adminAdsService.rejectCampaign(selectedCampaign._id, rejectReason);
            if (response.success) {
                toast.success('Campaña rechazada');
                setShowRejectModal(false);
                setRejectReason('');
                loadCampaigns();
                setSelectedCampaign(null);
            }
        } catch (error) {
            toast.error('Error al rechazar campaña');
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        const action = currentStatus === 'active' ? 'pause' : 'resume';
        try {
            const response = await adminAdsService.toggleCampaign(id, action);
            if (response.success) {
                toast.success(`Campaña ${action === 'pause' ? 'pausada' : 'reanudada'}`);
                loadCampaigns();
            }
        } catch (error) {
            toast.error('Error al cambiar estado');
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-8">Administración de Anuncios</h1>

            {/* Tabs */}
            <div className="flex space-x-4 mb-6 border-b border-gray-700 pb-2">
                {['pending', 'active', 'paused', 'rejected', 'all'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg capitalize transition-colors ${activeTab === tab
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        {tab === 'pending' ? 'Pendientes' : tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-12 text-gray-400">Cargando campañas...</div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-800/30 rounded-xl border border-gray-700">
                    No hay campañas en esta sección.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {campaigns.map((campaign) => (
                        <motion.div
                            key={campaign._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col md:flex-row gap-6"
                        >
                            {/* Creative Preview */}
                            <div className="w-full md:w-64 flex-shrink-0">
                                <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-700 relative">
                                    {campaign.creative?.imageUrl ? (
                                        <img
                                            src={campaign.creative.imageUrl}
                                            alt={campaign.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-600">
                                            Sin imagen
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white capitalize">
                                        {campaign.status}
                                    </div>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-xl font-bold text-white">{campaign.name}</h3>
                                    <span className="text-sm text-gray-400">ID: {campaign._id}</span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                                    <div>
                                        <span className="block text-gray-500">Objetivo</span>
                                        <span className="text-white capitalize">{campaign.objective}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500">Presupuesto Total</span>
                                        <span className="text-white">€{campaign.budget?.totalBudget}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500">Anunciante</span>
                                        <span className="text-blue-400 cursor-pointer hover:underline">
                                            {campaign.advertiser?.substring(0, 10)}...
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500">Fechas</span>
                                        <span className="text-white">
                                            {new Date(campaign.schedule?.startDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/50 p-3 rounded-lg mb-4">
                                    <p className="text-gray-300 text-sm">
                                        <strong>Título:</strong> {campaign.creative?.title}
                                    </p>
                                    <p className="text-gray-400 text-sm mt-1">
                                        {campaign.creative?.description}
                                    </p>
                                    <a
                                        href={campaign.creative?.destinationUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 text-xs mt-2 inline-block hover:underline"
                                    >
                                        {campaign.creative?.destinationUrl}
                                    </a>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    {activeTab === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => handleApprove(campaign._id)}
                                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                            >
                                                <FaCheck /> Aprobar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedCampaign(campaign);
                                                    setShowRejectModal(true);
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                            >
                                                <FaTimes /> Rechazar
                                            </button>
                                        </>
                                    )}

                                    {(activeTab === 'active' || activeTab === 'paused') && (
                                        <button
                                            onClick={() => handleToggleStatus(campaign._id, campaign.status)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${campaign.status === 'active'
                                                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                                : 'bg-green-600 hover:bg-green-700 text-white'
                                                }`}
                                        >
                                            {campaign.status === 'active' ? <><FaPause /> Pausar</> : <><FaPlay /> Reanudar</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-4">Rechazar Campaña</h3>
                        <p className="text-gray-400 mb-4">
                            Por favor indica la razón por la cual estás rechazando esta campaña.
                            Esta información será enviada al anunciante.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white mb-4 focus:ring-2 focus:ring-red-500 outline-none"
                            rows="4"
                            placeholder="Razón del rechazo..."
                        ></textarea>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="px-4 py-2 text-gray-300 hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReject}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                            >
                                Confirmar Rechazo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAdsPage;
