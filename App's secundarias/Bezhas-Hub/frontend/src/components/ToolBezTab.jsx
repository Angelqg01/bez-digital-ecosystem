import React, { useState, useEffect } from 'react';
import { Zap, Package, Terminal, TrendingUp, CheckCircle, Globe, Activity } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const ToolBezTab = ({ selectedApiKey }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        if (selectedApiKey) {
            fetchToolBezStats();
        }
    }, [selectedApiKey]);

    const fetchToolBezStats = async () => {
        try {
            const response = await axios.get('/api/oracle/toolbez/stats', {
                headers: { 'x-api-key': selectedApiKey },
                timeout: 5000
            });

            setStats(response.data.data);
        } catch (error) {
            console.error('Error fetching ToolBEZ stats:', error);
            toast.error('Error al obtener estadísticas ToolBEZ');
        } finally {
            setLoading(false);
        }
    };

    const handleTestIoT = async () => {
        try {
            const testData = {
                productId: `TEST_${Date.now()}`,
                sensorData: {
                    temperature: 4.2,
                    humidity: 65,
                    location: 'Warehouse Madrid'
                },
                metadata: {
                    deviceId: 'SENSOR_001'
                }
            };

            const response = await axios.post('/api/oracle/toolbez/iot-ingest', testData, {
                headers: { 'x-api-key': selectedApiKey },
                timeout: 10000
            });

            setTestResult(response.data);
            toast.success('Test IoT exitoso');
        } catch (error) {
            console.error('Error en test IoT:', error);
            toast.error(error.response?.data?.error || 'Error en test IoT');
        }
    };

    const handleTestBatch = async () => {
        try {
            const operations = [
                {
                    productId: `BATCH_ITEM_1_${Date.now()}`,
                    sensorData: { temperature: 3.8, location: 'Warehouse A' },
                    metadata: { deviceId: 'SENSOR_001' }
                },
                {
                    productId: `BATCH_ITEM_2_${Date.now()}`,
                    sensorData: { temperature: 4.1, location: 'Warehouse B' },
                    metadata: { deviceId: 'SENSOR_002' }
                },
                {
                    productId: `BATCH_ITEM_3_${Date.now()}`,
                    sensorData: { temperature: 3.9, location: 'Warehouse C' },
                    metadata: { deviceId: 'SENSOR_003' }
                }
            ];

            const response = await axios.post('/api/oracle/toolbez/batch', { operations }, {
                headers: { 'x-api-key': selectedApiKey },
                timeout: 15000
            });

            setTestResult(response.data);
            toast.success(`Batch completado: ${response.data.successCount}/${response.data.totalOperations} exitosos`);
        } catch (error) {
            console.error('Error en test batch:', error);
            toast.error(error.response?.data?.error || 'Error en test batch');
        }
    };

    if (!selectedApiKey) {
        return (
            <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Selecciona una API Key
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                    Elige una API Key para ver las estadísticas de ToolBEZ
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-2">ToolBEZ™ Enterprise</h2>
                <p className="text-purple-100">
                    Blockchain-as-a-Service para adopción empresarial
                </p>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Cuota Mensual
                            </h3>
                            <Package className="w-5 h-5 text-blue-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {stats.quota.used.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            de {stats.quota.monthly === Infinity ? '∞' : stats.quota.monthly.toLocaleString()} ({stats.quota.percentage}%)
                        </p>
                        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(stats.quota.percentage, 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Tier
                            </h3>
                            <TrendingUp className="w-5 h-5 text-green-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {stats.tier}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {stats.companyName}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Tiempo de Respuesta
                            </h3>
                            <Activity className="w-5 h-5 text-purple-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {stats.stats.avgResponseTime}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Uptime: {stats.stats.uptime}
                        </p>
                    </div>
                </div>
            )}

            {/* Features */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Funcionalidades Empresariales
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3">
                        <Zap className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                                Fee Delegation
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                BeZhas paga el gas de tus usuarios. Sin fricción Web3.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Package className="w-6 h-6 text-purple-500 flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                                Multi-Task Transactions
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Agrupa 50+ operaciones en un solo batch.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Globe className="w-6 h-6 text-cyan-500 flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                                IoT Ready
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Conecta sensores directamente a blockchain.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Code Examples */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Terminal className="w-5 h-5" />
                    Ejemplo de Integración IoT
                </h3>
                <pre className="bg-gray-950 text-gray-300 p-4 rounded-xl overflow-x-auto text-sm font-mono">
                    {`// NodeJS - Registrar datos de sensor
const response = await fetch('${window.location.origin}/api/oracle/toolbez/iot-ingest', {
  method: 'POST',
  headers: {
    'x-api-key': '${selectedApiKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    productId: 'PRODUCT_12345',
    sensorData: {
      temperature: 4.2,
      humidity: 65,
      location: 'Warehouse Madrid'
    },
    metadata: {
      deviceId: 'SENSOR_001'
    }
  })
});

const result = await response.json();
console.log('Tx Hash:', result.txHash);
// Gas pagado por ToolBEZ (Fee Delegation)`}
                </pre>

                <div className="flex gap-3 mt-4">
                    <button
                        onClick={handleTestIoT}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                        <Zap className="w-4 h-4" />
                        Probar IoT Ingest
                    </button>
                    <button
                        onClick={handleTestBatch}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                        <Package className="w-4 h-4" />
                        Probar Batch (3 ops)
                    </button>
                </div>

                {testResult && (
                    <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-semibold">Test Exitoso</span>
                        </div>
                        <pre className="text-xs text-green-600 dark:text-green-300 overflow-x-auto">
                            {JSON.stringify(testResult, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            {/* Permissions */}
            {stats && stats.permissions && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Permisos Activos
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {stats.permissions.map((perm, i) => (
                            <span
                                key={i}
                                className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium"
                            >
                                {perm}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToolBezTab;
