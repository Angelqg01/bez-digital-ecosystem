import { motion, AnimatePresence } from 'framer-motion';
import { useBezCoin } from '../context/BezCoinContext';

/**
 * Indicador visual de transacciones pendientes
 * Se muestra en la esquina inferior derecha cuando hay una tx en proceso
 */
const PendingTransactionIndicator = () => {
    const { pendingTx, networkError } = useBezCoin();

    return (
        <AnimatePresence>
            {(pendingTx || networkError) && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.8 }}
                    className="fixed bottom-6 right-6 z-50"
                >
                    <div className={`
                        bg-gradient-to-br ${networkError ? 'from-red-500 to-red-600' : 'from-purple-500 to-indigo-600'}
                        text-white px-6 py-4 rounded-2xl shadow-2xl
                        border border-white/20 backdrop-blur-sm
                        flex items-center gap-4 min-w-[320px]
                    `}>
                        {/* Spinner o icono de error */}
                        {networkError ? (
                            <div className="flex-shrink-0">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        ) : (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                className="flex-shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </motion.div>
                        )}

                        {/* Mensaje */}
                        <div className="flex-1">
                            <p className="font-semibold text-sm">
                                {networkError ? 'Error de Red' : 'Transacción en Proceso'}
                            </p>
                            <p className="text-xs text-white/80 mt-1">
                                {networkError || pendingTx}
                            </p>
                        </div>

                        {/* Indicador de pulso */}
                        {!networkError && (
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    opacity: [0.5, 1, 0.5]
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: 'easeInOut'
                                }}
                                className="w-3 h-3 bg-white rounded-full"
                            />
                        )}
                    </div>

                    {/* Mensaje adicional para transacciones */}
                    {!networkError && pendingTx && (
                        <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-center text-xs text-gray-600 mt-2"
                        >
                            Por favor no cierres esta ventana
                        </motion.p>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PendingTransactionIndicator;
