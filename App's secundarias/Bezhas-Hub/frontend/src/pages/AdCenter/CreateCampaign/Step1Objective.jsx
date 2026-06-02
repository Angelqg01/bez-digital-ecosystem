import { motion } from 'framer-motion';
import { FaBullseye, FaMousePointer, FaEye, FaChartLine } from 'react-icons/fa';

const Step1Objective = ({ formData, setFormData, onNext }) => {
    const objectives = [
        {
            value: 'clicks',
            label: 'Obtener Clics / Tráfico',
            description: 'Dirige usuarios a tu sitio web. Pagas por cada clic (CPC).',
            icon: FaMousePointer,
            color: 'from-blue-600 to-cyan-600',
            metrics: ['CPC', 'Clics', 'CTR']
        },
        {
            value: 'impressions',
            label: 'Aumentar Visibilidad / Impresiones',
            description: 'Maximiza el alcance de tu marca. Pagas por cada 1000 impresiones (CPM).',
            icon: FaEye,
            color: 'from-purple-600 to-pink-600',
            metrics: ['CPM', 'Impresiones', 'Alcance']
        },
        {
            value: 'conversions',
            label: 'Generar Conversiones',
            description: 'Optimiza para acciones específicas como compras o registros.',
            icon: FaChartLine,
            color: 'from-green-600 to-emerald-600',
            metrics: ['CPA', 'Conversiones', 'ROI']
        }
    ];

    const handleSelect = (objective) => {
        setFormData({ ...formData, objective });
    };

    const canProceed = formData.objective !== '';

    return (
        <div>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-purple-600 bg-opacity-20 rounded-lg">
                        <FaBullseye className="text-2xl text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            ¿Cuál es tu objetivo principal?
                        </h2>
                        <p className="text-gray-400">
                            Selecciona el objetivo que mejor se adapte a tus necesidades
                        </p>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {objectives.map((obj) => (
                    <motion.button
                        key={obj.value}
                        onClick={() => handleSelect(obj.value)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-6 rounded-xl text-left transition-all ${formData.objective === obj.value
                                ? `bg-gradient-to-r ${obj.color} ring-4 ring-purple-400 ring-opacity-50`
                                : 'bg-gray-800 hover:bg-gray-750 border-2 border-gray-700'
                            }`}
                    >
                        <div className={`inline-flex p-4 rounded-xl mb-4 ${formData.objective === obj.value
                                ? 'bg-white bg-opacity-20'
                                : `bg-gradient-to-r ${obj.color} bg-opacity-20`
                            }`}>
                            <obj.icon className="text-3xl text-white" />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">
                            {obj.label}
                        </h3>

                        <p className="text-sm text-gray-300 mb-4">
                            {obj.description}
                        </p>

                        <div className="flex flex-wrap gap-2">
                            {obj.metrics.map((metric) => (
                                <span
                                    key={metric}
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${formData.objective === obj.value
                                            ? 'bg-white bg-opacity-20 text-white'
                                            : 'bg-gray-700 text-gray-300'
                                        }`}
                                >
                                    {metric}
                                </span>
                            ))}
                        </div>
                    </motion.button>
                ))}
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">
                    💡 Recomendaciones
                </h3>
                <ul className="space-y-2 text-sm text-gray-300">
                    <li>• <strong>Clics/Tráfico:</strong> Ideal para lanzamientos de productos o servicios nuevos</li>
                    <li>• <strong>Impresiones:</strong> Perfecto para construir reconocimiento de marca</li>
                    <li>• <strong>Conversiones:</strong> Mejor para campañas con objetivos claros y medibles</li>
                </ul>
            </div>

            <div className="flex justify-end mt-8">
                <button
                    onClick={onNext}
                    disabled={!canProceed}
                    className={`px-8 py-3 rounded-lg font-medium transition-all ${canProceed
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    Siguiente: Configurar Anuncio →
                </button>
            </div>
        </div>
    );
};

export default Step1Objective;
