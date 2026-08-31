import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import confetti from 'canvas-confetti';

// Función helper para determinar si un error debe mostrarse en consola
const shouldLogError = (error) => {
    const status = error.response?.status;
    const code = error.code;

    // No mostrar errores de conexión o servidor iniciando
    return !(
        code === 'ERR_NETWORK' ||
        code === 'ECONNREFUSED' ||
        status === 503 ||
        status === 500
    );
};

// Axios instance con configuración optimizada
const api = axios.create({
    baseURL: '/api/automation',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor de respuesta para silenciar errores 503/500 durante reconexión
api.interceptors.response.use(
    response => response,
    error => {
        // Silenciar errores de conexión en consola (503, 500, ERR_CONNECTION_REFUSED)
        if (
            error.code === 'ERR_NETWORK' ||
            error.code === 'ECONNREFUSED' ||
            error.response?.status === 503 ||
            error.response?.status === 500
        ) {
            // No hacer nada, estos errores se manejan en checkBackend
            return Promise.reject(error);
        }
        // Otros errores se propagan normalmente
        console.error('API Error:', error.message);
        return Promise.reject(error);
    }
);

// Funciones de confetti optimizadas (fuera del componente para evitar recreación)
const triggerOracleConfetti = () => {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff6b35', '#f7931e', '#fdc500'],
        scalar: 1.2,
        gravity: 0.8
    });
};

const triggerAPYConfetti = () => {
    confetti({
        particleCount: 50,
        spread: 60,
        colors: ['#10b981', '#34d399', '#6ee7b7'],
        startVelocity: 30,
        decay: 0.9
    });
};

const triggerHalvingConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#ff0000', '#ff6b6b', '#ff9999']
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#ff0000', '#ff6b6b', '#ff9999']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    };
    frame();
};

const triggerSuccessConfetti = () => {
    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#10b981', '#34d399', '#6ee7b7', '#22d3ee', '#818cf8'],
        startVelocity: 45
    });
};

// Componente de estado del sistema memoizado
const SystemStatus = memo(({ status, isRunning }) => {
    if (!status) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <div className="text-6xl mb-4">🔍</div>
                <p>Haz clic en "Obtener Estado del Sistema"</p>
            </div>
        );
    }

    const statusColor = status.status === 'OK' ? 'bg-green-500' :
        status.status === 'DEGRADED' ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="space-y-4">
            <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Status General</p>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${statusColor} animate-pulse`}></div>
                    <p className="text-2xl font-bold">{status.status}</p>
                    {isRunning && <span className="text-sm text-green-400">(RUNNING)</span>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {Object.entries(status.components).map(([key, value]) => {
                    const color = value === 'UP' ? 'bg-green-500' :
                        value === 'DEGRADED' ? 'bg-yellow-500' : 'bg-red-500';
                    return (
                        <div key={key} className="bg-gray-700/50 rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-1">{key}</p>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${color}`}></div>
                                <p className="text-sm font-semibold">{value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="text-xs text-gray-500 text-center">
                Actualizado: {new Date(status.timestamp).toLocaleTimeString()}
            </div>
        </div>
    );
});

// Componente de logs
const EventLogs = memo(({ logs }) => {
    if (!logs || logs.length === 0) {
        return (
            <div className="text-center text-gray-500 py-8">
                <p>No hay eventos recientes</p>
            </div>
        );
    }

    const getEventColor = (type) => {
        const colors = {
            'ORACLE_UPDATE': 'text-orange-400',
            'APY_ADJUSTED': 'text-green-400',
            'HALVING_EXECUTED': 'text-red-400',
            'ML_ANALYSIS': 'text-blue-400'
        };
        return colors[type] || 'text-gray-400';
    };

    return (
        <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
                <div key={index} className="bg-gray-700/50 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                        <span className={`font-semibold ${getEventColor(log.eventType)}`}>
                            {log.eventType}
                        </span>
                        <span className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                    <p className="text-gray-300">{log.description || 'Sin descripción'}</p>
                </div>
            ))}
        </div>
    );
});

// Componente de métricas memoizado
const MetricsPanel = memo(({ metrics }) => {
    if (!metrics) return null;

    const metricsData = [
        {
            label: 'Total Decisiones',
            value: metrics.orchestrator?.totalDecisions || 0,
            gradient: 'from-blue-600 to-blue-800',
            textColor: 'text-blue-200'
        },
        {
            label: 'Ajustes Exitosos',
            value: metrics.orchestrator?.successfulAdjustments || 0,
            gradient: 'from-green-600 to-green-800',
            textColor: 'text-green-200'
        },
        {
            label: 'Ajustes Fallidos',
            value: metrics.orchestrator?.failedAdjustments || 0,
            gradient: 'from-red-600 to-red-800',
            textColor: 'text-red-200'
        },
        {
            label: 'Halvings',
            value: metrics.orchestrator?.halvingsExecuted || 0,
            gradient: 'from-purple-600 to-purple-800',
            textColor: 'text-purple-200'
        }
    ];

    return (
        <div className="max-w-7xl mx-auto mb-8">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    📊 Métricas del Orchestrator
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {metricsData.map(({ label, value, gradient, textColor }) => (
                        <div key={label} className={`bg-gradient-to-br ${gradient} rounded-lg p-4`}>
                            <p className={`text-sm ${textColor} mb-1`}>{label}</p>
                            <p className="text-3xl font-bold">{value}</p>
                        </div>
                    ))}
                </div>

                {metrics.eventBus && (
                    <div className="mt-6 pt-6 border-t border-gray-600">
                        <h3 className="text-lg font-semibold mb-3">Event Bus</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-gray-700/50 rounded-lg p-3">
                                <p className="text-xs text-gray-400">Total Events</p>
                                <p className="text-xl font-bold">{metrics.eventBus.totalEvents}</p>
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-3">
                                <p className="text-xs text-gray-400">Circuit Breaker</p>
                                <p className="text-xl font-bold">
                                    {metrics.eventBus.circuitBreaker?.isOpen ? '🔴 OPEN' : '🟢 CLOSED'}
                                </p>
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-3">
                                <p className="text-xs text-gray-400">Listeners</p>
                                <p className="text-xl font-bold">
                                    {Object.keys(metrics.eventBus.eventsByType || {}).length}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default function AutomationDemo() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [logs, setLogs] = useState([]);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [systemRunning, setSystemRunning] = useState(false);
    const [backendReady, setBackendReady] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    // Estados para modo Demo/Live
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [demoCalculations, setDemoCalculations] = useState([]);
    const [calculationSummary, setCalculationSummary] = useState(null);

    // Verificar disponibilidad del backend
    useEffect(() => {
        let retries = 0;
        const maxRetries = 5;
        const checkBackend = async () => {
            try {
                await api.get('/health', { timeout: 3000 });
                setBackendReady(true);
                setRetryCount(0);
                toast.success('✅ Conectado al backend', { id: 'backend-ready', duration: 2000 });
            } catch (error) {
                retries++;
                setRetryCount(retries);

                // Solo mostrar error en consola después de varios intentos
                if (retries >= 3 && error.response?.status !== 503 && error.response?.status !== 500) {
                    console.warn(`[Intento ${retries}/${maxRetries}] Backend no disponible:`, error.message);
                }

                if (retries < maxRetries) {
                    setTimeout(checkBackend, 2000); // Reintentar cada 2 segundos
                } else {
                    toast.error('⚠️ Backend no disponible. Inicia el servidor backend.', {
                        id: 'backend-error',
                        duration: 5000
                    });
                }
            }
        };

        checkBackend();
    }, []);

    // Auto-refresh cada 10 segundos (solo si backend está listo)
    useEffect(() => {
        if (autoRefresh && backendReady) {
            const interval = setInterval(() => {
                fetchStatus();
                fetchMetrics();
            }, 10000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, backendReady]);

    // Cargar estado inicial (solo cuando backend esté listo)
    useEffect(() => {
        if (backendReady) {
            fetchStatus();
            fetchMetrics();
            fetchLogs();
        }
    }, [backendReady]);

    // Funciones memoizadas con useCallback
    const fetchStatus = useCallback(async () => {
        try {
            const { data } = await api.get('/health');
            setStatus(data.data);
            setSystemRunning(data.data.status === 'OK');
        } catch (error) {
            if (shouldLogError(error)) {
                console.error('Error obteniendo estado:', error);
                toast.error('Backend no disponible', { id: 'backend-error' });
            }
        }
    }, []);

    const fetchMetrics = useCallback(async () => {
        try {
            const { data } = await api.get('/metrics');
            setMetrics(data.data);
        } catch (error) {
            if (shouldLogError(error)) {
                console.error('Error obteniendo métricas:', error);
            }
        }
    }, []);

    const fetchLogs = useCallback(async () => {
        try {
            const { data } = await api.get('/logs/events?limit=50');
            setLogs(data.data || []);
            if (data.data?.length > 0) {
                toast.success(`${data.data.length} eventos cargados`, { id: 'logs-loaded' });
            }
        } catch (error) {
            if (shouldLogError(error)) {
                console.error('Error obteniendo logs:', error);
            }
        }
    }, []);

    const startSystem = useCallback(async () => {
        setLoading(true);
        try {
            await api.post('/start');
            toast.success('🚀 Sistema de automatización iniciado');
            triggerSuccessConfetti();
            setTimeout(() => {
                fetchStatus();
                fetchMetrics();
            }, 1000);
        } catch (error) {
            toast.error('Error: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    }, [fetchStatus, fetchMetrics]);

    const stopSystem = useCallback(async () => {
        setLoading(true);
        try {
            await api.post('/stop');
            toast.success('⏹️ Sistema de automatización detenido');
            setTimeout(() => {
                fetchStatus();
                fetchMetrics();
            }, 1000);
        } catch (error) {
            toast.error('Error: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    }, [fetchStatus, fetchMetrics]);

    const simulateOracle = useCallback(async () => {
        setLoading(true);
        try {
            const randomPrice = Math.floor(Math.random() * 20000 + 50000);
            const randomVolume = Math.floor(Math.random() * 5000000000);

            // Modo Demo: Solo calcular
            if (!isLiveMode) {
                const calculation = {
                    id: Date.now(),
                    type: 'ORACLE_UPDATE',
                    timestamp: new Date().toISOString(),
                    data: {
                        assetPair: 'BTC/USD',
                        price: randomPrice,
                        volume: randomVolume,
                        priceChange: ((randomPrice - 60000) / 60000 * 100).toFixed(2),
                        volumeImpact: (randomVolume / 1000000000).toFixed(2)
                    },
                    result: {
                        action: 'Actualización de precio registrada',
                        impact: randomPrice > 65000 ? 'Alcista' : randomPrice < 55000 ? 'Bajista' : 'Neutral',
                        recommendation: randomPrice > 65000 ? 'Considerar aumento de APY' : 'Mantener APY actual'
                    }
                };

                setDemoCalculations(prev => [...prev, calculation]);
                toast.success(`📊 Cálculo Demo: BTC = $${randomPrice.toLocaleString()}`, {
                    duration: 3000,
                    icon: '🧮'
                });
                triggerOracleConfetti();
                updateSummary([...demoCalculations, calculation]);
                return;
            }

            // Modo Live: Ejecutar en blockchain
            await api.post('/test/oracle', {
                assetPair: 'BTC/USD',
                price: randomPrice,
                volume: randomVolume
            });

            toast.success(`🔮 Oráculo LIVE: BTC = $${randomPrice.toLocaleString()}`);
            triggerOracleConfetti();
            setTimeout(() => {
                fetchMetrics();
                fetchLogs();
            }, 2000);
        } catch (error) {
            toast.error('Error: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    }, [fetchMetrics, fetchLogs, isLiveMode, demoCalculations]);

    const adjustAPY = useCallback(async (newAPY) => {
        setLoading(true);
        try {
            // Modo Demo: Solo calcular
            if (!isLiveMode) {
                const calculation = {
                    id: Date.now(),
                    type: 'APY_ADJUSTMENT',
                    timestamp: new Date().toISOString(),
                    data: {
                        oldAPY: 1500, // Simulado
                        newAPY: newAPY,
                        change: ((newAPY - 1500) / 1500 * 100).toFixed(2),
                        reason: 'Ajuste manual desde demo'
                    },
                    result: {
                        action: `APY ajustado a ${newAPY / 100}%`,
                        impact: newAPY > 1500 ? 'Mayor rentabilidad' : 'Menor riesgo',
                        estimatedUsers: Math.floor(Math.random() * 1000 + 500),
                        estimatedRewards: (newAPY * 1000 / 100).toFixed(2)
                    }
                };

                setDemoCalculations(prev => [...prev, calculation]);
                toast.success(`📊 Cálculo Demo: APY = ${newAPY / 100}%`, {
                    duration: 3000,
                    icon: '🧮'
                });
                triggerAPYConfetti();
                updateSummary([...demoCalculations, calculation]);
                return;
            }

            // Modo Live: Ejecutar en blockchain
            await api.post('/manual/apy', {
                newAPY: parseInt(newAPY),
                reason: 'Ajuste manual desde demo'
            });

            toast.success(`✅ APY LIVE ajustado a ${newAPY / 100}%`);
            triggerAPYConfetti();
            setTimeout(() => {
                fetchMetrics();
                fetchLogs();
            }, 2000);
        } catch (error) {
            toast.error('Error: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    }, [fetchMetrics, fetchLogs, isLiveMode, demoCalculations]);

    const executeHalving = useCallback(async () => {
        if (!isLiveMode) {
            // Modo Demo: Solo calcular
            const calculation = {
                id: Date.now(),
                type: 'HALVING_EXECUTION',
                timestamp: new Date().toISOString(),
                data: {
                    currentReward: 100,
                    newReward: 50,
                    reduction: '50%',
                    reason: 'Halving manual desde demo'
                },
                result: {
                    action: 'Halving ejecutado (simulación)',
                    impact: 'Reducción de inflación',
                    affectedUsers: Math.floor(Math.random() * 5000 + 1000),
                    newEmissionRate: '50 tokens/block'
                }
            };

            setDemoCalculations(prev => [...prev, calculation]);
            toast.success('📊 Cálculo Demo: Halving simulado', {
                duration: 3000,
                icon: '🧮'
            });
            triggerHalvingConfetti();
            updateSummary([...demoCalculations, calculation]);
            return;
        }

        // Modo Live: Confirmar y ejecutar
        if (!confirm('¿Estás seguro de ejecutar un Halving? Esto reducirá las recompensas a la mitad.')) {
            return;
        }

        setLoading(true);
        try {
            await api.post('/manual/halving', {
                reason: 'Halving manual desde demo'
            });

            toast.success('💥 Halving LIVE ejecutado exitosamente');
            triggerHalvingConfetti();
            setTimeout(() => {
                fetchMetrics();
                fetchLogs();
            }, 2000);
        } catch (error) {
            toast.error('Error: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    }, [fetchMetrics, fetchLogs, isLiveMode, demoCalculations]);

    const analyzeMarket = useCallback(async () => {
        setLoading(true);
        try {
            const marketData = {
                price: Math.floor(Math.random() * 20000 + 50000),
                volume: Math.floor(Math.random() * 5000000000),
                trend: ['BULLISH', 'BEARISH', 'STABLE'][Math.floor(Math.random() * 3)]
            };

            // Modo Demo: Solo calcular
            if (!isLiveMode) {
                const suggestedAPY = marketData.trend === 'BULLISH' ? 2500 :
                    marketData.trend === 'BEARISH' ? 1000 : 1500;

                const calculation = {
                    id: Date.now(),
                    type: 'ML_ANALYSIS',
                    timestamp: new Date().toISOString(),
                    data: {
                        price: marketData.price,
                        volume: marketData.volume,
                        trend: marketData.trend,
                        volatility: (Math.random() * 10).toFixed(2) + '%'
                    },
                    result: {
                        action: 'Análisis ML completado',
                        suggestedAPY: suggestedAPY,
                        confidence: (Math.random() * 30 + 70).toFixed(2) + '%',
                        recommendation: `APY recomendado: ${suggestedAPY / 100}%`
                    }
                };

                setDemoCalculations(prev => [...prev, calculation]);
                toast.success(`📊 Análisis Demo: APY recomendado ${suggestedAPY / 100}%`, {
                    duration: 3000,
                    icon: '🧮'
                });
                triggerSuccessConfetti();
                updateSummary([...demoCalculations, calculation]);
                return;
            }

            // Modo Live: Simular análisis
            toast.success(`🧠 Análisis ML LIVE completado`, { duration: 3000 });
            triggerSuccessConfetti();

            setTimeout(() => {
                fetchMetrics();
                fetchLogs();
            }, 1000);
        } catch (error) {
            toast.error('Error: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    }, [fetchMetrics, fetchLogs, isLiveMode, demoCalculations]);

    // Función para actualizar resumen de cálculos
    const updateSummary = useCallback((calculations) => {
        if (calculations.length === 0) {
            setCalculationSummary(null);
            return;
        }

        const summary = {
            totalCalculations: calculations.length,
            byType: {
                ORACLE_UPDATE: calculations.filter(c => c.type === 'ORACLE_UPDATE').length,
                APY_ADJUSTMENT: calculations.filter(c => c.type === 'APY_ADJUSTMENT').length,
                HALVING_EXECUTION: calculations.filter(c => c.type === 'HALVING_EXECUTION').length,
                ML_ANALYSIS: calculations.filter(c => c.type === 'ML_ANALYSIS').length
            },
            lastCalculation: calculations[calculations.length - 1],
            timestamp: new Date().toISOString()
        };

        setCalculationSummary(summary);
    }, []);

    // Función para implementar cálculos en Live
    const implementCalculationsLive = useCallback(async () => {
        if (demoCalculations.length === 0) {
            toast.error('No hay cálculos para implementar');
            return;
        }

        const confirmMessage = `¿Implementar ${demoCalculations.length} cálculos en modo LIVE?\n\n` +
            `- ${calculationSummary.byType.ORACLE_UPDATE} actualizaciones de oráculo\n` +
            `- ${calculationSummary.byType.APY_ADJUSTMENT} ajustes de APY\n` +
            `- ${calculationSummary.byType.HALVING_EXECUTION} halvings\n` +
            `- ${calculationSummary.byType.ML_ANALYSIS} análisis ML\n\n` +
            `Esta acción NO SE PUEDE DESHACER.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        setLoading(true);
        let successful = 0;
        let failed = 0;

        try {
            toast.loading('🔄 Implementando cálculos...', { id: 'implementing' });

            // Implementar cada cálculo
            for (const calc of demoCalculations) {
                try {
                    switch (calc.type) {
                        case 'ORACLE_UPDATE':
                            await api.post('/test/oracle', calc.data);
                            break;
                        case 'APY_ADJUSTMENT':
                            await api.post('/manual/apy', {
                                newAPY: calc.data.newAPY,
                                reason: 'Implementación desde modo Demo'
                            });
                            break;
                        case 'HALVING_EXECUTION':
                            await api.post('/manual/halving', {
                                reason: 'Implementación desde modo Demo'
                            });
                            break;
                        default:
                            break;
                    }
                    successful++;
                    await new Promise(resolve => setTimeout(resolve, 500)); // Delay entre requests
                } catch (error) {
                    failed++;
                    if (shouldLogError(error)) {
                        console.error(`Error implementando ${calc.type}:`, error);
                    }
                }
            }

            toast.dismiss('implementing');
            toast.success(`✅ Implementación completa: ${successful} exitosos, ${failed} fallidos`, {
                duration: 5000
            });
            triggerSuccessConfetti();

            // Limpiar cálculos demo después de implementar
            setDemoCalculations([]);
            setCalculationSummary(null);

            // Actualizar métricas
            setTimeout(() => {
                fetchMetrics();
                fetchLogs();
            }, 2000);

        } catch (error) {
            toast.error('Error en implementación: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [demoCalculations, calculationSummary, fetchMetrics, fetchLogs]);

    // Función para resetear datos demo
    const resetDemoData = useCallback(() => {
        if (demoCalculations.length === 0) {
            toast.error('No hay datos para resetear');
            return;
        }

        if (confirm(`¿Borrar ${demoCalculations.length} cálculos demo?`)) {
            setDemoCalculations([]);
            setCalculationSummary(null);
            toast.success('🗑️ Datos demo reseteados', { duration: 2000 });
        }
    }, [demoCalculations]);

    // Función para cambiar modo Demo/Live
    const toggleMode = useCallback(() => {
        if (isLiveMode && demoCalculations.length > 0) {
            toast.error('Implementa o borra los cálculos demo antes de cambiar a modo Demo');
            return;
        }
        setIsLiveMode(prev => !prev);
        toast.success(isLiveMode ? '📊 Cambiado a modo Demo' : '🔴 Cambiado a modo LIVE', {
            duration: 2000
        });
    }, [isLiveMode, demoCalculations]);

    // APY buttons config memoizado
    const apyButtons = useMemo(() => [
        { value: 1000, label: '10% APY', color: 'bg-green-600 hover:bg-green-700' },
        { value: 1500, label: '15% APY', color: 'bg-green-600 hover:bg-green-700' },
        { value: 2000, label: '20% APY', color: 'bg-yellow-600 hover:bg-yellow-700' },
        { value: 2500, label: '25% APY', color: 'bg-orange-600 hover:bg-orange-700' }
    ], []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">🤖 Automation Engine Demo</h1>
                        <p className="text-gray-400">Sistema de Automatización BeZhas - Prueba en vivo</p>
                    </div>

                    <div className="flex gap-4">
                        {/* Backend Status Indicator */}
                        <div className={`border px-4 py-2 rounded-lg ${backendReady
                            ? 'bg-green-500/20 border-green-500'
                            : 'bg-yellow-500/20 border-yellow-500 animate-pulse'
                            }`}>
                            <p className={`text-sm ${backendReady ? 'text-green-400' : 'text-yellow-400'}`}>
                                {backendReady ? '✅ Backend Online' : `🔄 Conectando... (${retryCount}/5)`}
                            </p>
                            <p className="text-xs text-gray-300">Port 3001</p>
                        </div>

                        {/* Demo/Live Mode Toggle */}
                        <button
                            onClick={toggleMode}
                            disabled={loading}
                            className={`border px-6 py-2 rounded-lg font-bold transition-all transform hover:scale-105 ${isLiveMode
                                ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30'
                                : 'bg-blue-500/20 border-blue-500 text-blue-400 hover:bg-blue-500/30'
                                } disabled:opacity-50`}
                        >
                            <p className="text-sm font-bold">
                                {isLiveMode ? '🔴 LIVE Mode' : '📊 DEMO Mode'}
                            </p>
                            <p className="text-xs">
                                {isLiveMode ? 'Transacciones reales' : 'Solo cálculos'}
                            </p>
                        </button>

                        <label className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-4 h-4"
                                disabled={!backendReady}
                            />
                            <span className="text-sm">Auto-refresh (10s)</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Warning si backend no está disponible */}
            {!backendReady && (
                <div className="max-w-7xl mx-auto mb-8">
                    <div className="bg-yellow-900/50 border border-yellow-500 rounded-xl p-6">
                        <h3 className="text-xl font-bold text-yellow-400 mb-2">⚠️ Backend No Disponible</h3>
                        <p className="text-gray-300 mb-4">
                            El servidor backend no está respondiendo. Por favor, asegúrate de que esté corriendo:
                        </p>
                        <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm">
                            <p className="text-green-400">cd backend</p>
                            <p className="text-green-400">node server.js</p>
                        </div>
                        <p className="text-gray-400 text-sm mt-4">
                            Intentando reconectar automáticamente... ({retryCount}/5)
                        </p>
                    </div>
                </div>
            )}            {/* Control Principal - Start/Stop */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        🎛️ Control Principal
                    </h2>
                    <div className="flex gap-4">
                        <button
                            onClick={startSystem}
                            disabled={loading || systemRunning || !backendReady}
                            className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-4 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                        >
                            ▶️ Iniciar Sistema
                        </button>
                        <button
                            onClick={stopSystem}
                            disabled={loading || !systemRunning || !backendReady}
                            className="flex-1 bg-red-600 hover:bg-red-700 px-6 py-4 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                        >
                            ⏹️ Detener Sistema
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid de Controles */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Panel de Automatización */}
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">🎮 Acciones de Automatización</h2>

                    <div className="space-y-4">
                        <button
                            onClick={simulateOracle}
                            disabled={loading || !backendReady}
                            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? '⏳ Procesando...' : '🔮 Simular Evento de Oráculo'}
                        </button>

                        <button
                            onClick={executeHalving}
                            disabled={loading || !backendReady}
                            className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            💥 Ejecutar Halving Manual
                        </button>

                        <button
                            onClick={analyzeMarket}
                            disabled={loading || !backendReady}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            🧠 Análisis de Mercado ML
                        </button>

                        <div className="border-t border-gray-600 pt-4">
                            <p className="text-sm text-gray-400 mb-2">Ajuste Manual de APY:</p>
                            <div className="grid grid-cols-2 gap-2">
                                {apyButtons.map(({ value, label, color }) => (
                                    <button
                                        key={value}
                                        onClick={() => adjustAPY(value)}
                                        disabled={loading || !backendReady}
                                        className={`${color} px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-all`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Panel de Estado */}
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">🏥 Estado del Sistema</h2>
                    <SystemStatus status={status} isRunning={systemRunning} />

                    <div className="mt-4 space-y-2">
                        <button
                            onClick={fetchStatus}
                            className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        >
                            🔄 Actualizar Estado
                        </button>
                        <button
                            onClick={fetchMetrics}
                            className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        >
                            📈 Actualizar Métricas
                        </button>
                    </div>
                </div>
            </div>

            {/* Panel de Métricas */}
            <MetricsPanel metrics={metrics} />

            {/* Panel de Logs */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            📜 Registro de Eventos
                        </h2>
                        <button
                            onClick={fetchLogs}
                            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        >
                            🔄 Recargar Logs
                        </button>
                    </div>
                    <EventLogs logs={logs} />
                </div>
            </div>

            {/* Panel de Resumen de Cálculos Demo */}
            {!isLiveMode && demoCalculations.length > 0 && (
                <div className="max-w-7xl mx-auto mb-8">
                    <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-sm border border-purple-500 rounded-xl p-6">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            🧮 Resumen de Cálculos Demo
                            <span className="text-sm font-normal text-purple-300">
                                ({demoCalculations.length} operaciones)
                            </span>
                        </h2>

                        {/* Estadísticas por Tipo */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-orange-600/20 border border-orange-500 rounded-lg p-4">
                                <p className="text-xs text-orange-300 mb-1">Actualizaciones Oráculo</p>
                                <p className="text-3xl font-bold">{calculationSummary?.byType.ORACLE_UPDATE || 0}</p>
                            </div>
                            <div className="bg-green-600/20 border border-green-500 rounded-lg p-4">
                                <p className="text-xs text-green-300 mb-1">Ajustes APY</p>
                                <p className="text-3xl font-bold">{calculationSummary?.byType.APY_ADJUSTMENT || 0}</p>
                            </div>
                            <div className="bg-red-600/20 border border-red-500 rounded-lg p-4">
                                <p className="text-xs text-red-300 mb-1">Halvings</p>
                                <p className="text-3xl font-bold">{calculationSummary?.byType.HALVING_EXECUTION || 0}</p>
                            </div>
                            <div className="bg-blue-600/20 border border-blue-500 rounded-lg p-4">
                                <p className="text-xs text-blue-300 mb-1">Análisis ML</p>
                                <p className="text-3xl font-bold">{calculationSummary?.byType.ML_ANALYSIS || 0}</p>
                            </div>
                        </div>

                        {/* Lista de Cálculos */}
                        <div className="bg-gray-800/50 rounded-lg p-4 mb-6 max-h-96 overflow-y-auto">
                            <h3 className="text-lg font-semibold mb-3">Detalle de Operaciones</h3>
                            <div className="space-y-3">
                                {demoCalculations.map((calc, index) => (
                                    <div key={calc.id} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-purple-300">#{index + 1}</span>
                                                <span className={`text-sm font-semibold ${calc.type === 'ORACLE_UPDATE' ? 'text-orange-400' :
                                                    calc.type === 'APY_ADJUSTMENT' ? 'text-green-400' :
                                                        calc.type === 'HALVING_EXECUTION' ? 'text-red-400' :
                                                            'text-blue-400'
                                                    }`}>
                                                    {calc.type.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-400">
                                                {new Date(calc.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <p className="text-gray-400">Datos:</p>
                                                {Object.entries(calc.data).slice(0, 3).map(([key, value]) => (
                                                    <p key={key} className="text-gray-300">
                                                        {key}: <span className="font-semibold">{value}</span>
                                                    </p>
                                                ))}
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Resultado:</p>
                                                <p className="text-gray-300">{calc.result.action}</p>
                                                <p className="text-purple-300 font-semibold">{calc.result.recommendation || calc.result.impact}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex gap-4">
                            <button
                                onClick={implementCalculationsLive}
                                disabled={loading || !backendReady}
                                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-6 py-4 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                            >
                                <span>🚀</span>
                                <div className="text-left">
                                    <p>Implementar en LIVE</p>
                                    <p className="text-xs font-normal">Ejecutar {demoCalculations.length} operaciones</p>
                                </div>
                            </button>
                            <button
                                onClick={resetDemoData}
                                disabled={loading}
                                className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 px-6 py-4 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                            >
                                <span>🗑️</span>
                                <div className="text-left">
                                    <p>Borrar y Resetear</p>
                                    <p className="text-xs font-normal">Limpiar todos los datos demo</p>
                                </div>
                            </button>
                        </div>

                        <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                            <p className="text-xs text-yellow-300">
                                ⚠️ <strong>Advertencia:</strong> Al implementar en LIVE, estas operaciones se ejecutarán en el blockchain.
                                Esta acción es irreversible y puede afectar el sistema en producción.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Instrucciones */}
            <div className="max-w-7xl mx-auto">
                <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 backdrop-blur-sm border border-indigo-500 rounded-xl p-6">
                    <h3 className="text-xl font-bold mb-4">📖 Funciones Implementadas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {[
                            { id: 'demo-mode', emoji: '📊', title: 'Modo DEMO', desc: 'Realiza cálculos sin ejecutar transacciones reales. Perfecto para pruebas.' },
                            { id: 'live-mode', emoji: '🔴', title: 'Modo LIVE', desc: 'Ejecuta transacciones reales en blockchain. Requiere confirmación.' },
                            { id: 'summary', emoji: '🧮', title: 'Resumen de Cálculos', desc: 'Visualiza todos los cálculos demo antes de implementarlos' },
                            { id: 'implement', emoji: '🚀', title: 'Implementar LIVE', desc: 'Ejecuta todos los cálculos demo en el blockchain de una vez' },
                            { id: 'start-stop', emoji: '▶️', title: 'Iniciar/Detener Sistema', desc: 'Control completo del motor de automatización' },
                            { id: 'oracle', emoji: '🔮', title: 'Simular Oráculo', desc: 'Genera eventos de precio BTC para probar decisiones automáticas' },
                            { id: 'halving', emoji: '💥', title: 'Halving Manual', desc: 'Ejecuta reducción de recompensas (confirmación en LIVE)' },
                            { id: 'ml-analysis', emoji: '🧠', title: 'Análisis ML', desc: 'Analiza condiciones de mercado y recomienda APY óptimo' },
                            { id: 'apy-adjust', emoji: '�', title: 'Ajuste APY', desc: 'Cambia manualmente el porcentaje de recompensas (10-25%)' },
                            { id: 'auto-refresh', emoji: '🔄', title: 'Auto-refresh', desc: 'Actualiza estado y métricas cada 10 segundos automáticamente' },
                            { id: 'logs', emoji: '📜', title: 'Logs en Tiempo Real', desc: 'Visualiza todos los eventos del sistema con timestamps' },
                            { id: 'animations', emoji: '🎉', title: 'Animaciones', desc: 'Confetti personalizado para cada tipo de evento exitoso' }
                        ].map(({ id, emoji, title, desc }) => (
                            <div key={id} className="flex items-start gap-3 bg-gray-800/30 rounded-lg p-3">
                                <span className="text-2xl">{emoji}</span>
                                <div>
                                    <p className="font-semibold text-indigo-300">{title}</p>
                                    <p className="text-gray-400 text-xs">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-6 border-t border-indigo-500/30">
                        <p className="text-xs text-gray-500 mb-2">
                            💡 <strong>Modo DEMO:</strong> Todas las acciones generan cálculos que se almacenan para revisión.
                            Puedes ver el resumen completo y decidir implementarlos en LIVE cuando estés listo.
                        </p>
                        <p className="text-xs text-gray-500">
                            🔴 <strong>Modo LIVE:</strong> Las acciones se ejecutan directamente en el blockchain.
                            El sistema responde a eventos reales y ejecuta transacciones cuando se conecta una wallet con privilegios de admin.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
