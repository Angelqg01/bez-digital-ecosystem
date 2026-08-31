import React from 'react';
import { TrendingUp as TrendingUpIcon, Trophy as TrophyIcon, Zap as ZapIcon, Shield as ShieldIcon, Rocket as RocketIcon } from 'lucide-react';

// Developer Incentives Component (Extracted from DeveloperConsole)
const DeveloperIncentives = ({ usageStats }) => {
    // Calcular progreso
    const apiCallsProgress = Math.min((usageStats?.requestsThisMonth || 0) / 10000 * 100, 100);
    const contractProgress = Math.min((usageStats?.smartContractCalls || 0) / 1000 * 100, 100);
    const identityProgress = Math.min((usageStats?.identityValidations || 0) / 100 * 100, 100);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* CARD 1: API BUILDER */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-yellow-500/20 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <ZapIcon className="text-yellow-500" size={20} />
                        API Builder
                    </h3>
                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded-full text-xs font-bold">
                        Gold Tier
                    </span>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                    Realiza 10,000 llamadas al mes para desbloquear soporte prioritario.
                </p>
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Progreso</span>
                        <span className="text-white font-mono">
                            {usageStats?.requestsThisMonth || 0} / 10,000
                        </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-yellow-500 h-full transition-all duration-500"
                            style={{ width: `${Math.min(apiCallsProgress, 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* CARD 2: SMART CONTRACTOR */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-blue-500/20 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShieldIcon className="text-blue-500" size={20} />
                        Smart Contractor
                    </h3>
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-500 border border-blue-500/30 rounded-full text-xs font-bold">
                        Diamond
                    </span>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                    Valida 1,000 contratos on-chain para recibir auditoría gratuita.
                </p>
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Contratos Validados</span>
                        <span className="text-white font-mono">
                            {usageStats?.smartContractCalls || 0} / 1000
                        </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-blue-500 h-full transition-all duration-500"
                            style={{ width: `${Math.min(contractProgress, 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* CARD 3: IDENTITY PIONEER */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-purple-500/20 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <TrophyIcon className="text-purple-500" size={20} />
                        Identity Pioneer
                    </h3>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-500 border border-purple-500/30 rounded-full text-xs font-bold">
                        Platinum
                    </span>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                    Integra el módulo de Identidad y obtén un nodo dedicado.
                </p>
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Verificaciones</span>
                        <span className="text-white font-mono">
                            {usageStats?.identityValidations || 0} / 100
                        </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-purple-500 h-full transition-all duration-500"
                            style={{ width: `${Math.min(identityProgress, 100)}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// New Loyalty Metrics Tab
const LoyaltyMetricsTab = ({ usageStats }) => {
    return (
        <div className="space-y-6">
            {/* Developer Incentives Cards */}
            <DeveloperIncentives usageStats={usageStats} />

            {/* Métricas Detalladas */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <TrendingUpIcon className="text-green-400" />
                    Tus Métricas de Uso
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-lg border border-purple-200 dark:border-purple-700">
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total API Calls (Este Mes)</p>
                        <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                            {usageStats?.requestsThisMonth?.toLocaleString() || 0}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700">
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Validaciones de Contratos</p>
                        <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                            {usageStats?.smartContractCalls?.toLocaleString() || 0}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-lg border border-green-200 dark:border-green-700">
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Verificaciones de Identidad</p>
                        <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                            {usageStats?.identityValidations?.toLocaleString() || 0}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-lg border border-orange-200 dark:border-orange-700">
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Histórico</p>
                        <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">
                            {usageStats?.totalRequests?.toLocaleString() || 0}
                        </p>
                    </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-300">
                        💡 <strong>Tip:</strong> Cada vez que tu aplicación llama a{' '}
                        <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded text-xs">bezhas.getContract()</code> o{' '}
                        <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded text-xs">bezhas.identity.verify()</code>,
                        incrementas estos contadores y avanzas hacia el siguiente tier VIP.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoyaltyMetricsTab;
