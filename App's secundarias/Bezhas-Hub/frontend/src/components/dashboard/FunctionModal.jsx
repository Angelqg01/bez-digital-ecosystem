import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import { getIconComponent } from '../../data/businessFunctionsData';

/**
 * 🪟 Modal de Información de Función
 * Modal accesible con detalles completos de cada funcionalidad
 */
const FunctionModal = ({
    isOpen,
    onClose,
    title,
    description,
    icon,
    gradient,
    linkPath
}) => {
    const navigate = useNavigate();
    const IconComponent = getIconComponent(icon);

    // Bloquear scroll del body cuando el modal está abierto
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Cerrar con tecla Escape
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEscape);
        }
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleNavigate = () => {
        onClose();
        navigate(linkPath);
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-fadeIn"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>

            {/* Modal Content */}
            <div
                className="relative bg-[#1A1D29] rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-800 animate-slideUp"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header con Gradiente */}
                <div className={`relative p-6 rounded-t-2xl bg-gradient-to-br ${gradient} overflow-hidden`}>
                    {/* Patrón de fondo decorativo */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}></div>
                    </div>

                    {/* Contenido del Header */}
                    <div className="relative flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                                <IconComponent size={32} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
                                <p className="text-white/80 text-sm">Función Empresarial BeZhas</p>
                            </div>
                        </div>

                        {/* Botón Cerrar */}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
                            aria-label="Cerrar modal"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Descripción Completa */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                            <span className="text-2xl">📋</span>
                            Descripción Detallada
                        </h3>
                        <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                            {description}
                        </p>
                    </div>

                    {/* Características Destacadas */}
                    <div className="mb-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <span className="text-xl">✨</span>
                            Características Clave
                        </h3>
                        <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-sm text-gray-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Integración completa con blockchain
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                Interfaz intuitiva y fácil de usar
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                Seguridad de nivel empresarial
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                                Soporte técnico 24/7
                            </li>
                        </ul>
                    </div>

                    {/* Footer con Botones */}
                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-800">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-all duration-200"
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={handleNavigate}
                            className={`flex-1 px-4 py-3 rounded-lg bg-gradient-to-br ${gradient} hover:shadow-lg text-white font-semibold transition-all duration-200 flex items-center justify-center gap-2 group`}
                        >
                            <span>Ir a la Función</span>
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FunctionModal;
