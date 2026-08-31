import React, { useState, useEffect } from 'react';
import { 
    Cpu as CpuIcon, 
    ShieldCheck as ShieldCheckIcon, 
    Zap as ZapIcon, 
    Key as KeyIcon, 
    RefreshCw as RefreshCwIcon,
    Globe as GlobeIcon,
    AlertCircle as AlertIcon,
    ExternalLink as ExternalLinkIcon,
    Copy as CopyIcon,
    Eye as EyeIcon,
    EyeOff as EyeOffIcon
} from 'lucide-react';
import http from '../../services/http';
import { toast } from 'react-hot-toast';

const OpenClawTab = ({ address }) => {
    const [clientData, setClientData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showKey, setShowKey] = useState(false);
    const [rotating, setRotating] = useState(false);

    useEffect(() => {
        if (address) {
            fetchClientData();
        }
    }, [address]);

    const fetchClientData = async () => {
        try {
            setLoading(true);
            const response = await http.get(`/api/openclaw/client/${address}`);
            if (response.data.success) {
                setClientData(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching OpenClaw data:', error);
            // Si no existe el cliente, dejamos data en null
            setClientData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleRotate = async () => {
        if (!window.confirm('¿Estás seguro de rotar tu API Key de OpenClaw? La actual dejará de funcionar inmediatamente.')) return;
        try {
            setRotating(true);
            const response = await http.post('/api/openclaw/rotate', { walletAddress: address });
            if (response.data.success) {
                toast.success('API Key rotada exitosamente');
                fetchClientData();
            }
        } catch (error) {
            toast.error('Error al rotar la clave');
        } finally {
            setRotating(false);
        }
    };

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado al portapapeles`);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mb-4"></div>
                <p className="text-gray-500">Cargando perfil de Agente IA...</p>
            </div>
        );
    }

    if (!clientData) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-xl shadow-purple-500/5">
                <div className="bg-purple-100 dark:bg-purple-900/30 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <ZapIcon className="text-purple-600 dark:text-purple-400" size={40} />
                </div>
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Activa tu Agente OpenClaw</h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
                    OpenClaw es el Agente IA de BeZhas que te permite automatizar pagos, gestionar plataformas de terceros y recibir análisis en tiempo real.
                </p>
                <button 
                    onClick={() => window.location.href = '/bezpay?tab=subscription'}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all transform hover:scale-105"
                >
                    Suscribirse ahora
                </button>
                <p className="mt-4 text-sm text-gray-500">Requiere una suscripción de nivel Creator o superior.</p>
            </div>
        );
    }

    const { plan, status, platforms, limits, clientId, apiKey } = clientData;
    const platformLimit = limits?.platforms || 0;
    const platformUsagePercent = platformLimit > 0 ? (platforms.length / platformLimit) * 100 : 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Status & Plan Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-purple-100 text-sm font-medium uppercase tracking-wider">Plan de Agente</span>
                        <ZapIcon size={20} className="text-yellow-300" />
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                        <h3 className="text-3xl font-bold capitalize">{plan}</h3>
                        <span className="text-purple-100 text-sm pb-1 opacity-80">Tier</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm bg-white/10 w-fit px-3 py-1 rounded-full">
                        <ShieldCheckIcon size={14} />
                        <span>{status === 'active' ? 'Suscripción Activa' : 'Expirada/Pausada'}</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-xl shadow-purple-500/5">
                    <div className="flex items-center justify-between mb-4 text-gray-400">
                        <span className="text-sm font-medium uppercase tracking-wider">Conectividad</span>
                        <GlobeIcon size={20} />
                    </div>
                    <div className="flex items-end gap-2 mb-4">
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{platforms.length}</h3>
                        <span className="text-gray-500 dark:text-gray-400 text-sm pb-1">/ {platformLimit > 0 ? platformLimit : '∞'} Plataformas</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div 
                            className="bg-purple-600 h-full transition-all duration-1000" 
                            style={{ width: `${Math.min(platformUsagePercent, 100)}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-xl shadow-purple-500/5">
                    <div className="flex items-center justify-between mb-4 text-gray-400">
                        <span className="text-sm font-medium uppercase tracking-wider">Tasa de Sincronización</span>
                        <RefreshCwIcon size={20} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{limits?.syncInterval || 'N/A'}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Intervalo de actualización en tiempo real</p>
                    </div>
                    <div className="mt-4 text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 cursor-help">
                        <AlertIcon size={12} />
                        Optimizado por AEGIS
                    </div>
                </div>
            </div>

            {/* API Credentials */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-xl shadow-purple-500/5">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <KeyIcon size={20} />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Credenciales de Acceso</h3>
                    </div>
                    <button 
                        onClick={handleRotate}
                        disabled={rotating}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 transition-colors disabled:opacity-50"
                    >
                        <RefreshCwIcon size={16} className={rotating ? 'animate-spin' : ''} />
                        Rotar API Key
                    </button>
                </div>
                
                <div className="p-8 space-y-6">
                    {/* Client ID */}
                    <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 block">CLIENT ID</label>
                        <div className="flex gap-2">
                            <code className="flex-1 bg-gray-100 dark:bg-gray-900 p-4 rounded-xl font-mono text-sm text-purple-600 dark:text-purple-300 break-all select-all">
                                {clientId}
                            </code>
                            <button 
                                onClick={() => copyToClipboard(clientId, 'Client ID')}
                                className="p-4 bg-gray-100 dark:bg-gray-900 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                <CopyIcon size={20} />
                            </button>
                        </div>
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 block">API KEY (KEEP SECRET)</label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <code className="block w-full bg-gray-100 dark:bg-gray-900 p-4 rounded-xl font-mono text-sm text-purple-600 dark:text-purple-300 break-all overflow-hidden whitespace-nowrap">
                                    {showKey ? apiKey : '•'.repeat(48)}
                                </code>
                                <button 
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showKey ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                                </button>
                            </div>
                            <button 
                                onClick={() => copyToClipboard(apiKey, 'API Key')}
                                className="p-4 bg-gray-100 dark:bg-gray-900 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                <CopyIcon size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-2xl flex gap-3 text-sm text-yellow-700 dark:text-yellow-400 border border-yellow-200/50 dark:border-yellow-700/50">
                        <AlertIcon size={20} className="shrink-0" />
                        <p>
                            Utiliza estas credenciales con el <strong>BeZhas Universal Bridge SDK</strong> para conectar tus aplicaciones con el agente IA OpenClaw. Nunca compartas tu API Key en el frontend de tus aplicaciones de terceros.
                        </p>
                    </div>
                </div>
            </div>

            {/* SDK Links / Docs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button 
                    onClick={() => window.open('https://docs.bez.digital/ai/openclaw', '_blank')}
                    className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-purple-500 transition-all group shadow-xl shadow-purple-500/5"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400">
                            <CpuIcon size={24} />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-gray-900 dark:text-white">API Docs</h4>
                            <p className="text-sm text-gray-500">Aprende a usar OpenClaw</p>
                        </div>
                    </div>
                    <ExternalLinkIcon size={20} className="text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </button>

                <button 
                    onClick={() => window.location.href = '/developer?tab=sdk'}
                    className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-purple-500 transition-all group shadow-xl shadow-purple-500/5"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-2xl text-green-600 dark:text-green-400">
                            <ShieldCheckIcon size={24} />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-gray-900 dark:text-white">SDK Examples</h4>
                            <p className="text-sm text-gray-500">Snippets de código listos</p>
                        </div>
                    </div>
                    <ExternalLinkIcon size={20} className="text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </button>
            </div>
        </div>
    );
};

export default OpenClawTab;
