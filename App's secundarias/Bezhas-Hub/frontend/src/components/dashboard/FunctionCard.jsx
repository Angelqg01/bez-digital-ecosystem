import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, ExternalLink } from 'lucide-react';
import { getIconComponent } from '../../data/businessFunctionsData';
import FunctionModal from './FunctionModal';

/**
 * 🎴 Tarjeta de Función Empresarial
 * Componente reutilizable para mostrar cada funcionalidad de BeZhas
 */
const FunctionCard = ({
    id,
    title,
    metricSummary,
    fullDescription,
    linkPath,
    icon,
    gradient = 'from-blue-500 to-cyan-500',
    stats
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();
    const IconComponent = getIconComponent(icon);

    const handleNavigate = (e) => {
        e.stopPropagation();
        navigate(linkPath);
    };

    const handleOpenModal = (e) => {
        e.stopPropagation();
        setIsModalOpen(true);
    };

    return (
        <>
            <div
                className="group relative bg-[#1A1D29] rounded-2xl p-6 hover:bg-[#1F2330] transition-all duration-300 cursor-pointer border border-gray-800 hover:border-gray-700 shadow-lg hover:shadow-xl"
                onClick={() => navigate(linkPath)}
            >
                {/* Header con Icono y Botones */}
                <div className="flex items-start justify-between mb-4">
                    {/* Icono con Gradiente */}
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
                        <IconComponent size={24} className="text-white" />
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex gap-2">
                        {/* Botón Info */}
                        <button
                            onClick={handleOpenModal}
                            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100"
                            title="Más información"
                        >
                            <Info size={16} />
                        </button>

                        {/* Botón Navegar */}
                        <button
                            onClick={handleNavigate}
                            className="p-2 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                            title="Ir a la página"
                        >
                            <ExternalLink size={16} />
                        </button>
                    </div>
                </div>

                {/* Título */}
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 transition-all duration-300">
                    {title}
                </h3>

                {/* Resumen de Métricas */}
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                    {metricSummary}
                </p>

                {/* Stats Bar */}
                {stats && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                        <div className="text-xs">
                            <span className="text-gray-500">Principal:</span>
                            <span className="ml-2 text-white font-semibold">{stats.primary}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-gray-500">Estado:</span>
                            <span className="ml-2 text-green-400 font-semibold">{stats.secondary}</span>
                        </div>
                    </div>
                )}

                {/* Indicador Hover */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
            </div>

            {/* Modal de Información */}
            <FunctionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={title}
                description={fullDescription}
                icon={icon}
                gradient={gradient}
                linkPath={linkPath}
            />
        </>
    );
};

export default FunctionCard;
