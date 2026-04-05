import React, { useState } from 'react';
import { Key as KeyIcon, Plus as PlusIcon, Check as CheckIcon, Copy as CopyIcon, Settings as SettingsIcon, RefreshCw as RefreshCwIcon, Trash2 as Trash2Icon, AlertCircle as AlertCircleIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAccount, useSignMessage } from 'wagmi';

// Sector → Required permissions auto-fill map
const SECTOR_PERMISSIONS_MAP = {
    ecommerce: ['marketplace:read', 'marketplace:write', 'payments:read', 'payments:escrow:create', 'payments:swap', 'logistics:read', 'logistics:write'],
    logistics: ['logistics:read', 'logistics:write', 'logistics:fleet', 'supply:provenance:track', 'supply:compliance:verify', 'supply:warehouse:manage'],
    services: ['payments:read', 'payments:escrow:create', 'ai:moderate', 'identity:read', 'identity:verify'],
    realestate: ['realestate:tokenize', 'realestate:fractionate', 'realestate:manage', 'realestate:rent:collect', 'payments:read', 'payments:escrow:create', 'legal:contract:deploy'],
    finance: ['payments:read', 'payments:escrow:create', 'payments:swap', 'ai:analyze', 'identity:read', 'identity:verify'],
    healthcare: ['healthcare:prescriptions:verify', 'healthcare:supply:track', 'healthcare:records:read', 'healthcare:records:write', 'healthcare:compliance:audit', 'identity:verify'],
    automotive: ['automotive:vehicle:tokenize', 'automotive:parts:sync', 'automotive:maintenance:log', 'automotive:history:read', 'automotive:ownership:transfer', 'logistics:read'],
    manufacturing: ['manufacturing:iot:read', 'manufacturing:quality:certify', 'manufacturing:supply:track', 'manufacturing:twin:create', 'manufacturing:compliance:verify', 'supply:provenance:track'],
    energy: ['energy:credits:trade', 'energy:consumption:track', 'energy:grid:balance', 'energy:renewable:certify', 'energy:meters:read', 'carbon:credits:trade'],
    agriculture: ['agriculture:harvest:certify', 'agriculture:supply:track', 'agriculture:land:tokenize', 'agriculture:organic:verify', 'agriculture:iot:sensors', 'supply:provenance:track'],
    education: ['education:credentials:issue', 'education:credentials:verify', 'education:courses:manage', 'education:enrollment:track', 'education:certificates:mint', 'identity:verify'],
    insurance: ['insurance:policy:create', 'insurance:claim:process', 'insurance:claim:verify', 'insurance:oracle:trigger', 'insurance:premium:calculate', 'identity:verify', 'ai:analyze'],
    entertainment: ['entertainment:nft:mint', 'entertainment:royalties:distribute', 'entertainment:rights:manage', 'entertainment:tickets:issue', 'entertainment:streaming:track', 'payments:read'],
    legal: ['legal:contract:deploy', 'legal:notarize', 'legal:dispute:arbitrate', 'legal:documents:verify', 'legal:signatures:collect', 'identity:verify'],
    supply_chain: ['supply:provenance:track', 'supply:compliance:verify', 'supply:carbon:offset', 'supply:customs:clear', 'supply:warehouse:manage', 'logistics:read', 'logistics:write'],
    government: ['gov:identity:issue', 'gov:identity:verify', 'gov:vote:cast', 'gov:records:certify', 'gov:licenses:issue', 'identity:verify'],
    carbon: ['carbon:credits:issue', 'carbon:credits:trade', 'carbon:offset:verify', 'carbon:projects:certify', 'carbon:compliance:report', 'energy:renewable:certify'],
    other: []
};

// Componente de Estado Vacío
export const EmptyState = ({ onCreateClick }) => (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-12 text-center border-2 border-dashed border-purple-300 dark:border-purple-700">
        <div className="relative inline-block mb-6">
            <KeyIcon className="w-20 h-20 text-purple-600 dark:text-purple-400 animate-bounce" />
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse">
                <PlusIcon className="w-5 h-5 text-gray-900" />
            </div>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            ¡Comienza tu integración!
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-2 max-w-md mx-auto">
            Crea tu primera API Key para acceder a todos los servicios de BeZhas
        </p>
        <p className="text-sm text-purple-600 dark:text-purple-400 mb-8">
            🚀 Marketplace • Logística • IA • Blockchain • Real Estate • ¡y más!
        </p>
        <button
            onClick={onCreateClick}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all shadow-lg inline-flex items-center gap-2"
        >
            <PlusIcon className="w-6 h-6" />
            Crear Mi Primera API Key
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-6">
            ✓ Gratis para desarrollo • ✓ Documentación completa • ✓ Soporte 24/7
        </p>
    </div>
);

// Componente de Tarjeta de API Key
export const ApiKeyCard = ({ apiKey, onDelete, onRotate, onViewDetails }) => {
    const [copied, setCopied] = useState(false);

    const copyKey = () => {
        navigator.clipboard.writeText(apiKey.keyPreview);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const statusColors = {
        active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        suspended: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        revoked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {apiKey.name}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[apiKey.status]}`}>
                            {apiKey.status}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {apiKey.environment}
                        </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {apiKey.description || 'Sin descripción'}
                    </p>

                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg font-mono text-sm">
                            <code className="text-gray-700 dark:text-gray-300">{apiKey.keyPreview}</code>
                            <button onClick={copyKey} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                {copied ? <CheckIcon className="w-4 h-4 text-green-600" /> : <CopyIcon className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Permisos:</span>
                        {apiKey.permissions.slice(0, 3).map((perm) => (
                            <span key={perm} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                                {perm}
                            </span>
                        ))}
                        {apiKey.permissions.length > 3 && (
                            <span className="text-xs text-gray-500">+{apiKey.permissions.length - 3} más</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                    <button
                        onClick={() => onViewDetails(apiKey)}
                        className="p-2 text-gray-600 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
                        title="Ver detalles"
                    >
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => onRotate(apiKey._id)}
                        className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                        title="Rotar clave"
                    >
                        <RefreshCwIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => onDelete(apiKey._id)}
                        className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                        title="Revocar"
                    >
                        <Trash2Icon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Modal de Creación de API Key
export const CreateKeyModal = ({ onClose, onCreate, permissionModules }) => {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [isSigning, setIsSigning] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sector: 'ecommerce',
        environment: 'development',
        permissions: SECTOR_PERMISSIONS_MAP['ecommerce'] || []
    });

    // Auto-fill permissions when sector changes
    const handleSectorChange = (newSector) => {
        const autoPerms = SECTOR_PERMISSIONS_MAP[newSector] || [];
        setFormData(prev => ({
            ...prev,
            sector: newSector,
            permissions: autoPerms
        }));
        toast.success(`Permisos auto-configurados para ${newSector}`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) {
            toast.error('El nombre es requerido');
            return;
        }
        if (formData.permissions.length === 0) {
            toast.error('Selecciona al menos un permiso');
            return;
        }
        if (!isConnected || !address) {
            toast.error('Por favor, conecta tu wallet primero antes de crear una API Key.');
            return;
        }

        try {
            setIsSigning(true);
            const signatureData = `BeZhas Developer Console - Authorize API Key Creation for App: ${formData.name}\nTimestamp: ${Date.now()}\nEnvironment: ${formData.environment}`;
            const signature = await signMessageAsync({ message: signatureData });

            // Adjuntar dirección y firma para validación en el Backend (si lo soporta)
            const finalData = {
                ...formData,
                developerWallet: address,
                signature
            };

            onCreate(finalData);
        } catch (error) {
            console.error(error);
            toast.error('Firma rechazada. Debes firmar el mensaje para emitir la clave.');
        } finally {
            setIsSigning(false);
        }
    };

    const togglePermission = (permission) => {
        setFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(permission)
                ? prev.permissions.filter(p => p !== permission)
                : [...prev.permissions, permission]
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex justify-between items-center">
                        <span>Crear Nueva API Key</span>
                        {address && (
                            <span className="text-sm font-normal bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Conectado: {address.substring(0, 6)}...{address.substring(38)}
                            </span>
                        )}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Información Básica */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nombre de la Aplicación *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                            placeholder="Mi Aplicación E-commerce"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Descripción
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                            rows="3"
                            placeholder="Descripción de tu integración..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Sector
                            </label>
                            <select
                                value={formData.sector}
                                onChange={(e) => handleSectorChange(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                            >
                                <option value="ecommerce">E-commerce</option>
                                <option value="logistics">Logística</option>
                                <option value="services">Servicios</option>
                                <option value="realestate">Bienes Raíces</option>
                                <option value="finance">Finanzas</option>
                                <option value="healthcare">Healthcare</option>
                                <option value="automotive">Automotriz</option>
                                <option value="manufacturing">Manufactura</option>
                                <option value="energy">Energía</option>
                                <option value="agriculture">Agricultura</option>
                                <option value="education">Educación</option>
                                <option value="insurance">Seguros</option>
                                <option value="entertainment">Entretenimiento</option>
                                <option value="legal">Legal</option>
                                <option value="supply_chain">Supply Chain</option>
                                <option value="government">Gobierno</option>
                                <option value="carbon">Carbon Credits</option>
                                <option value="other">Otro</option>
                            </select>
                            {formData.permissions.length > 0 && (
                                <p className="mt-1 text-xs text-green-500 dark:text-green-400">
                                    ✅ {formData.permissions.length} permisos auto-configurados para este sector
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Entorno
                            </label>
                            <select
                                value={formData.environment}
                                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                            >
                                <option value="development">Development</option>
                                <option value="production">Production</option>
                            </select>
                        </div>
                    </div>

                    {/* Selector de Permisos */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                            Selecciona los Permisos (Módulos)
                        </label>
                        <div className="space-y-4">
                            {Object.entries(permissionModules).map(([moduleKey, module]) => {
                                const Icon = module.icon;
                                return (
                                    <div key={moduleKey} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <Icon className="w-5 h-5 text-purple-600" />
                                            <h4 className="font-semibold text-gray-900 dark:text-white">
                                                {module.label}
                                            </h4>
                                        </div>
                                        <div className="space-y-2 ml-8">
                                            {module.permissions.map((perm) => (
                                                <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions.includes(perm.id)}
                                                        onChange={() => togglePermission(perm.id)}
                                                        className="rounded text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">{perm.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSigning}
                            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${isSigning ? 'bg-purple-400 text-white cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'
                                }`}
                        >
                            {isSigning ? 'Firmando Autorización...' : 'Firmar y Crear API Key'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Modal de Revelación de Clave (Solo se muestra una vez)
export const KeyRevealModal = ({ keyData, onClose }) => {
    const [copied, setCopied] = useState(false);

    const copyKey = () => {
        navigator.clipboard.writeText(keyData.key);
        setCopied(true);
        toast.success('Clave copiada al portapapeles');
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-8">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        ¡API Key Creada Exitosamente!
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Guarda esta clave en un lugar seguro. No podrás verla nuevamente.
                    </p>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                    <div className="flex gap-3">
                        <AlertCircleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Importante:</strong> Por seguridad, esta clave solo se muestra una vez.
                            Cópiala ahora y guárdala en tu gestor de contraseñas.
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900 dark:bg-black rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <code className="text-green-400 font-mono text-sm break-all">
                            {keyData.key}
                        </code>
                        <button
                            onClick={copyKey}
                            className="ml-4 p-2 hover:bg-gray-800 rounded transition-colors flex-shrink-0"
                        >
                            {copied ? (
                                <CheckIcon className="w-5 h-5 text-green-400" />
                            ) : (
                                <CopyIcon className="w-5 h-5 text-gray-400" />
                            )}
                        </button>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                    Entendido, he guardado la clave
                </button>
            </div>
        </div>
    );
};

// Modal de Detalles de API Key
export const KeyDetailsModal = ({ apiKey, onClose, permissionModules }) => {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {apiKey.name}
                        </h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Información General */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Sector</p>
                            <p className="text-gray-900 dark:text-white font-semibold capitalize">{apiKey.sector}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Entorno</p>
                            <p className="text-gray-900 dark:text-white font-semibold capitalize">{apiKey.environment}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Creada</p>
                            <p className="text-gray-900 dark:text-white font-semibold">
                                {new Date(apiKey.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Último Uso</p>
                            <p className="text-gray-900 dark:text-white font-semibold">
                                {apiKey.usage?.lastUsed ? new Date(apiKey.usage.lastUsed).toLocaleDateString() : 'Nunca'}
                            </p>
                        </div>
                    </div>

                    {/* Métricas de Uso */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Métricas de Uso</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {apiKey.usage?.requestsToday || 0}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Hoy</p>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {apiKey.usage?.requestsThisMonth || 0}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Este Mes</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {apiKey.usage?.totalRequests || 0}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                            </div>
                        </div>
                    </div>

                    {/* Permisos Activos */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            Permisos Activos ({apiKey.permissions.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {apiKey.permissions.map((perm) => (
                                <span
                                    key={perm}
                                    className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium"
                                >
                                    {perm}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Rate Limits */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Rate Limits</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                <span className="text-gray-700 dark:text-gray-300">Requests por minuto</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {apiKey.rateLimit?.requestsPerMinute || 60}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                <span className="text-gray-700 dark:text-gray-300">Requests por día</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {apiKey.rateLimit?.requestsPerDay || 10000}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
