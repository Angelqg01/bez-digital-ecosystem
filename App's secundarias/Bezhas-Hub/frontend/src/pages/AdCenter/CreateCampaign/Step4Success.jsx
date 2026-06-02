import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaRocket, FaChartLine } from 'react-icons/fa';

const Step4Success = () => {
    const navigate = useNavigate();

    return (
        <div className="text-center py-12">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="inline-block mb-8"
            >
                <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/50">
                    <FaCheckCircle className="text-5xl text-white" />
                </div>
            </motion.div>

            <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold text-white mb-4"
            >
                ¡Campaña Enviada con Éxito!
            </motion.h2>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-gray-400 text-lg mb-8 max-w-md mx-auto"
            >
                Tu campaña ha sido enviada a revisión. Te notificaremos tan pronto como sea aprobada y comience a mostrarse.
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col sm:flex-row justify-center gap-4"
            >
                <button
                    onClick={() => navigate('/ad-center/dashboard')}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2"
                >
                    <FaRocket />
                    Ir al Dashboard
                </button>

                <button
                    onClick={() => navigate('/ad-center/create-campaign/1')}
                    className="px-8 py-4 bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
                >
                    <FaChartLine />
                    Crear Otra Campaña
                </button>
            </motion.div>
        </div>
    );
};

export default Step4Success;
