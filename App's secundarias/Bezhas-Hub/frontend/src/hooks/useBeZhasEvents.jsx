/**
 * 🎧 useBeZhasEvents - React Hook para Eventos del Blockchain
 * 
 * Hook personalizado que escucha eventos del contrato BeZhasCore
 * y muestra notificaciones/animaciones cuando ocurren cambios.
 * 
 * Eventos soportados:
 * - APYUpdated: Cambios en el APY de staking
 * - HalvingExecuted: Halving ejecutado
 * - EmergencyPause: Pausa de emergencia
 * 
 * @usage
 * import { useBeZhasEvents } from '@/hooks/useBeZhasEvents';
 * 
 * function App() {
 *   useBeZhasEvents(); // Activar listeners
 *   return <YourComponent />;
 * }
 */

import { useEffect, useRef } from 'react';
import { useWeb3 } from './useWeb3';
import { toast } from 'react-hot-toast';
import confetti from 'canvas-confetti';

// ABI simplificado del contrato BeZhasCore
const BEZHAS_CORE_ABI = [
    'event APYUpdated(uint256 oldAPY, uint256 newAPY, uint256 timestamp)',
    'event HalvingExecuted(uint256 newEmissionRate, uint256 timestamp)',
    'event EmergencyPause(address indexed pauser, string reason)'
];

export function useBeZhasEvents() {
    const { provider, isConnected } = useWeb3();
    const listenersRef = useRef(null);

    useEffect(() => {
        if (!provider || !isConnected) return;

        // Dirección del contrato BeZhasCore
        const contractAddress = import.meta.env.VITE_BEZHAS_CORE_ADDRESS;
        if (!contractAddress) {
            console.warn('VITE_BEZHAS_CORE_ADDRESS no configurado');
            return;
        }

        // Crear instancia del contrato
        const { ethers } = require('ethers');
        const contract = new ethers.Contract(
            contractAddress,
            BEZHAS_CORE_ABI,
            provider
        );

        // 📊 LISTENER: APY Updated
        const handleAPYUpdated = (oldAPY, newAPY, timestamp, event) => {
            const oldPercent = Number(oldAPY) / 100;
            const newPercent = Number(newAPY) / 100;

            const isIncrease = newPercent > oldPercent;
            const emoji = isIncrease ? '📈' : '📉';
            const color = isIncrease ? '#10b981' : '#f59e0b';

            toast(
                `${emoji} APY Actualizado: ${oldPercent.toFixed(2)}% → ${newPercent.toFixed(2)}%`,
                {
                    icon: '💰',
                    duration: 5000,
                    style: {
                        background: color,
                        color: '#fff',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }
                }
            );

            // Animación sutil
            if (isIncrease) {
                confetti({
                    particleCount: 50,
                    spread: 60,
                    origin: { y: 0.8 },
                    colors: ['#10b981', '#34d399', '#6ee7b7']
                });
            }

            console.log('🎉 APY Updated Event:', {
                oldAPY: oldPercent,
                newAPY: newPercent,
                timestamp: new Date(Number(timestamp) * 1000).toISOString(),
                txHash: event.log.transactionHash,
                blockNumber: event.log.blockNumber
            });
        };

        // 🔪 LISTENER: Halving Executed
        const handleHalving = (newEmissionRate, timestamp, event) => {
            // Efecto de confetti explosivo
            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

            function randomInRange(min, max) {
                return Math.random() * (max - min) + min;
            }

            const interval = setInterval(() => {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);

                confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                    colors: ['#ff4757', '#ff6348', '#ffa502']
                });

                confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                    colors: ['#ff4757', '#ff6348', '#ffa502']
                });
            }, 250);

            // Toast especial para halving
            toast.custom(
                (t) => (
                    <div
                        className={`${t.visible ? 'animate-enter' : 'animate-leave'
                            } max-w-md w-full bg-gradient-to-r from-red-500 to-orange-500 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
                    >
                        <div className="flex-1 w-0 p-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0 pt-0.5">
                                    <span className="text-4xl">🔪</span>
                                </div>
                                <div className="ml-3 flex-1">
                                    <p className="text-lg font-bold text-white">
                                        ¡HALVING EJECUTADO!
                                    </p>
                                    <p className="mt-1 text-sm text-white/90">
                                        Las recompensas se han reducido a la mitad.
                                    </p>
                                    <p className="mt-2 text-xs text-white/80">
                                        Nueva tasa de emisión: {newEmissionRate.toString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex border-l border-white/20">
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-white hover:bg-white/10 focus:outline-none"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                ),
                { duration: 10000 }
            );

            // Reproducir sonido (opcional)
            try {
                const audio = new Audio('/sounds/halving.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => {
                    // Si falla, no pasa nada
                });
            } catch (error) {
                // Ignorar si no hay sonido
            }

            console.log('🔥 Halving Executed Event:', {
                newEmissionRate: newEmissionRate.toString(),
                timestamp: new Date(Number(timestamp) * 1000).toISOString(),
                txHash: event.log.transactionHash,
                blockNumber: event.log.blockNumber
            });
        };

        // 🚨 LISTENER: Emergency Pause
        const handleEmergencyPause = (pauser, reason, event) => {
            toast.error(
                `🚨 PAUSA DE EMERGENCIA ACTIVADA\n\nMotivo: ${reason}\nPor: ${pauser.slice(0, 6)}...${pauser.slice(-4)}`,
                {
                    duration: Infinity, // No se cierra automáticamente
                    style: {
                        background: '#dc2626',
                        color: '#fff',
                        fontSize: '16px',
                        maxWidth: '500px'
                    }
                }
            );

            console.error('🚨 Emergency Pause Event:', {
                pauser,
                reason,
                txHash: event.log.transactionHash,
                blockNumber: event.log.blockNumber
            });
        };

        // Agregar listeners
        contract.on('APYUpdated', handleAPYUpdated);
        contract.on('HalvingExecuted', handleHalving);
        contract.on('EmergencyPause', handleEmergencyPause);

        // Guardar referencia para cleanup
        listenersRef.current = {
            contract,
            handleAPYUpdated,
            handleHalving,
            handleEmergencyPause
        };

        console.log('👂 BeZhas event listeners inicializados');

        // Cleanup: Remover listeners al desmontar
        return () => {
            if (listenersRef.current) {
                const { contract, handleAPYUpdated, handleHalving, handleEmergencyPause } = listenersRef.current;

                contract.off('APYUpdated', handleAPYUpdated);
                contract.off('HalvingExecuted', handleHalving);
                contract.off('EmergencyPause', handleEmergencyPause);

                console.log('🔇 BeZhas event listeners removidos');
            }
        };
    }, [provider, isConnected]);

    return null; // Este hook no retorna nada, solo agrega listeners
}

/**
 * 📊 Hook alternativo con retorno de métricas
 * 
 * Si necesitas acceder a los datos de eventos:
 */
export function useBeZhasEventsWithMetrics() {
    const { provider, isConnected } = useWeb3();
    const [metrics, setMetrics] = useState({
        lastAPYUpdate: null,
        lastHalving: null,
        totalAPYUpdates: 0,
        totalHalvings: 0
    });

    useEffect(() => {
        if (!provider || !isConnected) return;

        const contractAddress = import.meta.env.VITE_BEZHAS_CORE_ADDRESS;
        if (!contractAddress) return;

        const { ethers } = require('ethers');
        const contract = new ethers.Contract(
            contractAddress,
            BEZHAS_CORE_ABI,
            provider
        );

        const handleAPYUpdated = (oldAPY, newAPY, timestamp) => {
            setMetrics(prev => ({
                ...prev,
                lastAPYUpdate: {
                    oldAPY: Number(oldAPY),
                    newAPY: Number(newAPY),
                    timestamp: Number(timestamp) * 1000
                },
                totalAPYUpdates: prev.totalAPYUpdates + 1
            }));

            // Mostrar notificación
            const oldPercent = Number(oldAPY) / 100;
            const newPercent = Number(newAPY) / 100;
            toast.success(`📊 APY: ${oldPercent}% → ${newPercent}%`);
        };

        const handleHalving = (newEmissionRate, timestamp) => {
            setMetrics(prev => ({
                ...prev,
                lastHalving: {
                    newEmissionRate: newEmissionRate.toString(),
                    timestamp: Number(timestamp) * 1000
                },
                totalHalvings: prev.totalHalvings + 1
            }));

            // Animación + notificación
            confetti({ particleCount: 200, spread: 100 });
            toast('🔪 ¡Halving Ejecutado!', { icon: '🚨', duration: 10000 });
        };

        contract.on('APYUpdated', handleAPYUpdated);
        contract.on('HalvingExecuted', handleHalving);

        return () => {
            contract.off('APYUpdated', handleAPYUpdated);
            contract.off('HalvingExecuted', handleHalving);
        };
    }, [provider, isConnected]);

    return metrics;
}

/**
 * 🎨 Componente de ejemplo de uso
 */
export function BeZhasEventsDemo() {
    // Opción 1: Solo listeners (sin retorno)
    useBeZhasEvents();

    // Opción 2: Con métricas
    const metrics = useBeZhasEventsWithMetrics();

    return (
        <div className="p-4 bg-gray-900 text-white rounded-lg">
            <h3 className="text-lg font-bold mb-2">📊 BeZhas Events Metrics</h3>

            {metrics.lastAPYUpdate && (
                <div className="mb-2">
                    <p className="text-sm">Último APY Update:</p>
                    <p className="text-xs text-gray-400">
                        {metrics.lastAPYUpdate.oldAPY / 100}% → {metrics.lastAPYUpdate.newAPY / 100}%
                    </p>
                    <p className="text-xs text-gray-500">
                        {new Date(metrics.lastAPYUpdate.timestamp).toLocaleString()}
                    </p>
                </div>
            )}

            {metrics.lastHalving && (
                <div className="mb-2">
                    <p className="text-sm">Último Halving:</p>
                    <p className="text-xs text-gray-400">
                        Emisión: {metrics.lastHalving.newEmissionRate}
                    </p>
                    <p className="text-xs text-gray-500">
                        {new Date(metrics.lastHalving.timestamp).toLocaleString()}
                    </p>
                </div>
            )}

            <div className="mt-4 flex gap-4 text-sm">
                <div>
                    <p className="text-gray-400">Total APY Updates:</p>
                    <p className="text-2xl font-bold">{metrics.totalAPYUpdates}</p>
                </div>
                <div>
                    <p className="text-gray-400">Total Halvings:</p>
                    <p className="text-2xl font-bold text-red-500">{metrics.totalHalvings}</p>
                </div>
            </div>
        </div>
    );
}

export default useBeZhasEvents;
