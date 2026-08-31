import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaPlay, FaPause, FaEdit, FaTrash, FaChartLine, FaFilter, FaSearch, FaPlus } from 'react-icons/fa';
import { campaignsService } from '../../services/adCenter.service';
import toast from 'react-hot-toast';

const CampaignsList = () => {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

    useEffect(() => {
        loadCampaigns();
    }, [pagination.page, filterStatus, searchTerm]);

    const loadCampaigns = async () => {
        setLoading(true);
        try {
            const params = {
                page: pagination.page,
                limit: pagination.limit
            };

            if (filterStatus !== 'all') {
                params.status = filterStatus;
            }

            if (searchTerm) {
                params.search = searchTerm;
            }

            const response = await campaignsService.getCampaigns(params);
            if (response.success) {
                setCampaigns(response.data.campaigns);
                setPagination(prev => ({
                    ...prev,
                    total: response.data.pagination.totalPages
                }));
            }
        } catch (error) {
            console.error('Error loading campaigns:', error);
            toast.error('Error al cargar campañas');
        } finally {
            setLoading(false);
        }
    };

    const handlePauseCampaign = async (id) => {
        try {
            const response = await campaignsService.pauseCampaign(id);
            if (response.success) {
                toast.success('Campaña pausada');
                loadCampaigns();
            }
        } catch (error) {
            console.error('Error pausing campaign:', error);
            toast.error(error.response?.data?.message || 'Error al pausar campaña');
        }
    };

    const handleResumeCampaign = async (id) => {
        try {
            const response = await campaignsService.resumeCampaign(id);
            if (response.success) {
                toast.success('Campaña reanudada');
                loadCampaigns();
            }
        } catch (error) {
            console.error('Error resuming campaign:', error);
            toast.error(error.response?.data?.message || 'Error al reanudar campaña');
        }
    };

    const handleDeleteCampaign = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta campaña?')) {
            return;
        }

        try {
            const response = await campaignsService.deleteCampaign(id);
            if (response.success) {
                toast.success('Campaña eliminada');
                loadCampaigns();
            }
        } catch (error) {
            console.error('Error deleting campaign:', error);
            toast.error(error.response?.data?.message || 'Error al eliminar campaña');
        }
    };

    const statusLabels = {
        draft: 'Borrador',
        pending_approval: 'Pendiente Aprobación',
        approved: 'Aprobado',
        active: 'Activo',
        paused: 'Pausado',
        completed: 'Completado',
        rejected: 'Rechazado',
        suspended: 'Suspendido'
    };

    const statusColors = {
        draft: 'bg-gray-600 text-gray-200',
        pending_approval: 'bg-yellow-600 text-yellow-100',
        approved: 'bg-blue-600 text-blue-100',
        active: 'bg-green-600 text-green-100',
        paused: 'bg-orange-600 text-orange-100',
        completed: 'bg-purple-600 text-purple-100',
        rejected: 'bg-red-600 text-red-100',
        suspended: 'bg-red-700 text-red-100'
    };

    const objectiveLabels = {
        clicks: 'Clics',
        impressions: 'Impresiones',
        conversions: 'Conversiones'
    };

    if (loading && campaigns.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Cargando campañas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                Mis Campañas
                            </h1>
                            <p className="text-gray-400">
                                Gestiona tus campañas publicitarias
                            </p>
                        </div>

                        <button
                            onClick={() => navigate('/ad-center/create-campaign/1')}
                            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
                        >
                            <FaPlus />
                            <span>Nueva Campaña</span>
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                placeholder="Buscar campañas..."
                                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center space-x-2">
                            <FaFilter className="text-gray-400" />
                            <select
                                value={filterStatus}
                                onChange={(e) => {
                                    setFilterStatus(e.target.value);
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                                <option value="all">Todos los Estados</option>
                                <option value="draft">Borradores</option>
                                <option value="pending_approval">Pendientes</option>
                                <option value="active">Activas</option>
                                <option value="paused">Pausadas</option>
                                <option value="completed">Completadas</option>
                                <option value="rejected">Rechazadas</option>
                            </select>
                        </div>
                    </div>
                </motion.div>

                {/* Campaigns Table */}
                {campaigns.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center"
                    >
                        <FaChartLine className="text-6xl text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">
                            No se encontraron campañas
                        </h3>
                        <p className="text-gray-400 mb-6">
                            {searchTerm || filterStatus !== 'all'
                                ? 'Intenta ajustar los filtros de búsqueda'
                                : 'Crea tu primera campaña para comenzar'}
                        </p>
                        <button
                            onClick={() => navigate('/ad-center/create-campaign/1')}
                            className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-all"
                        >
                            <FaPlus />
                            <span>Crear Campaña</span>
                        </button>
                    </motion.div>
                ) : (
                    <>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-900 bg-opacity-50">
                                        <tr>
                                            <th className="text-left py-4 px-4 text-gray-400 font-medium text-sm">Campaña</th>
                                            <th className="text-left py-4 px-4 text-gray-400 font-medium text-sm">Estado</th>
                                            <th className="text-left py-4 px-4 text-gray-400 font-medium text-sm">Objetivo</th>
                                            <th className="text-right py-4 px-4 text-gray-400 font-medium text-sm">Impresiones</th>
                                            <th className="text-right py-4 px-4 text-gray-400 font-medium text-sm">Clics</th>
                                            <th className="text-right py-4 px-4 text-gray-400 font-medium text-sm">Gastado</th>
                                            <th className="text-right py-4 px-4 text-gray-400 font-medium text-sm">CTR</th>
                                            <th className="text-center py-4 px-4 text-gray-400 font-medium text-sm">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {campaigns.map((campaign) => (
                                            <tr key={campaign._id} className="border-t border-gray-700 hover:bg-gray-700 hover:bg-opacity-30 transition-colors">
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center space-x-3">
                                                        {campaign.creative?.imageUrl && (
                                                            <img
                                                                src={campaign.creative.imageUrl}
                                                                alt={campaign.name}
                                                                className="w-12 h-12 rounded object-cover"
                                                            />
                                                        )}
                                                        <div>
                                                            <p className="text-white font-medium">{campaign.name}</p>
                                                            <p className="text-xs text-gray-400">
                                                                {new Date(campaign.createdAt).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}>
                                                        {statusLabels[campaign.status]}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 text-gray-300 text-sm">
                                                    {objectiveLabels[campaign.objective]}
                                                </td>
                                                <td className="py-4 px-4 text-right text-white font-medium">
                                                    {campaign.metrics?.impressions?.toLocaleString() || 0}
                                                </td>
                                                <td className="py-4 px-4 text-right text-white font-medium">
                                                    {campaign.metrics?.clicks?.toLocaleString() || 0}
                                                </td>
                                                <td className="py-4 px-4 text-right text-white font-medium">
                                                    €{campaign.metrics?.spent?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <span className={`font-medium ${(campaign.performance?.ctr || 0) > 2
                                                            ? 'text-green-400'
                                                            : (campaign.performance?.ctr || 0) > 1
                                                                ? 'text-yellow-400'
                                                                : 'text-gray-400'
                                                        }`}>
                                                        {campaign.performance?.ctr?.toFixed(2) || '0.00'}%
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        {/* View Analytics */}
                                                        <button
                                                            onClick={() => navigate(`/ad-center/campaigns/${campaign._id}`)}
                                                            className="p-2 text-blue-400 hover:bg-blue-400 hover:bg-opacity-10 rounded-lg transition-all"
                                                            title="Ver Analytics"
                                                        >
                                                            <FaChartLine />
                                                        </button>

                                                        {/* Pause/Resume */}
                                                        {campaign.status === 'active' && (
                                                            <button
                                                                onClick={() => handlePauseCampaign(campaign._id)}
                                                                className="p-2 text-orange-400 hover:bg-orange-400 hover:bg-opacity-10 rounded-lg transition-all"
                                                                title="Pausar"
                                                            >
                                                                <FaPause />
                                                            </button>
                                                        )}
                                                        {campaign.status === 'paused' && (
                                                            <button
                                                                onClick={() => handleResumeCampaign(campaign._id)}
                                                                className="p-2 text-green-400 hover:bg-green-400 hover:bg-opacity-10 rounded-lg transition-all"
                                                                title="Reanudar"
                                                            >
                                                                <FaPlay />
                                                            </button>
                                                        )}

                                                        {/* Edit (only drafts/pending) */}
                                                        {(campaign.status === 'draft' || campaign.status === 'pending_approval') && (
                                                            <button
                                                                onClick={() => navigate(`/ad-center/edit-campaign/${campaign._id}`)}
                                                                className="p-2 text-purple-400 hover:bg-purple-400 hover:bg-opacity-10 rounded-lg transition-all"
                                                                title="Editar"
                                                            >
                                                                <FaEdit />
                                                            </button>
                                                        )}

                                                        {/* Delete (only drafts) */}
                                                        {campaign.status === 'draft' && (
                                                            <button
                                                                onClick={() => handleDeleteCampaign(campaign._id)}
                                                                className="p-2 text-red-400 hover:bg-red-400 hover:bg-opacity-10 rounded-lg transition-all"
                                                                title="Eliminar"
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>

                        {/* Pagination */}
                        {pagination.total > 1 && (
                            <div className="flex items-center justify-center space-x-2 mt-6">
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                                    disabled={pagination.page === 1}
                                    className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-all"
                                >
                                    ← Anterior
                                </button>

                                <span className="text-gray-400">
                                    Página {pagination.page} de {pagination.total}
                                </span>

                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.total, prev.page + 1) }))}
                                    disabled={pagination.page === pagination.total}
                                    className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-all"
                                >
                                    Siguiente →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default CampaignsList;
