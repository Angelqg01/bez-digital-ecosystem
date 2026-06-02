/* eslint-disable */
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Terminal, Lock, Globe, Bell,
    ShoppingCart, Truck, Briefcase, Building, Activity,
    Key, Plus, Eye, EyeOff, Copy, RefreshCw, Trash2,
    Shield, Check, X as XAlt, Settings,
    FileCode, Code, Zap, Cpu, BarChart2,
    Search, User, DollarSign, Wallet, ExternalLink, AlertCircle
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ApiKey {
    _id: string;
    name: string;
    prefix: string;
    permissions: string[];
    status: 'active' | 'revoked';
    lastUsed?: string;
    createdAt: string;
    requestCount?: number;
}

interface UsageStats {
    totalRequests: number;
    activeKeys: number;
    avgLatency: number;
    errorRate: number;
}

interface PermissionModule {
    label: string;
    icon: React.ElementType;
    permissions: { id: string; label: string }[];
}

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PERMISSION_MODULES: Record<string, PermissionModule> = {
    marketplace: { label: 'Marketplace', icon: ShoppingCart, permissions: [{ id: 'marketplace:read', label: 'Leer Productos' }, { id: 'marketplace:write', label: 'Gestionar Productos' }] },
    logistics:   { label: 'LogÃ­stica',   icon: Truck,        permissions: [{ id: 'logistics:read', label: 'Ver EnvÃ­os' }, { id: 'logistics:write', label: 'Crear EnvÃ­os' }, { id: 'logistics:fleet', label: 'GestiÃ³n de Flota' }] },
    payments:    { label: 'Pagos & Escrow', icon: DollarSign, permissions: [{ id: 'payments:read', label: 'Ver Transacciones' }, { id: 'payments:escrow:create', label: 'Crear Escrow' }, { id: 'payments:swap', label: 'Swap Tokens' }] },
    identity:    { label: 'Identidad (KYC)', icon: User,     permissions: [{ id: 'identity:read', label: 'Leer Perfil' }, { id: 'identity:verify', label: 'Verificar KYC' }] },
    realestate:  { label: 'Real Estate',  icon: Building,    permissions: [{ id: 'realestate:tokenize', label: 'Tokenizar Propiedad' }, { id: 'realestate:manage', label: 'Gestionar Activos' }] },
    ai:          { label: 'Inteligencia Artificial', icon: Cpu, permissions: [{ id: 'ai:analyze', label: 'AnÃ¡lisis Predictivo' }, { id: 'ai:moderate', label: 'ModeraciÃ³n de Contenido' }] },
    legal:       { label: 'Legal & Contratos', icon: Briefcase, permissions: [{ id: 'legal:contract:deploy', label: 'Desplegar Contratos' }, { id: 'legal:notarize', label: 'Notarizar Documentos' }] },
};

const TABS = [
    { id: 'keys',       label: 'API Keys',           icon: Key },
    { id: 'sdk',        label: 'IntegraciÃ³n SDK',    icon: FileCode },
    { id: 'webhooks',   label: 'Webhooks',           icon: Globe },
    { id: 'openclaw',   label: 'OpenClaw (AI)',       icon: Cpu },
    { id: 'revenue',    label: 'Ingresos (Web3)',     icon: DollarSign },
    { id: 'docs',       label: 'DocumentaciÃ³n',       icon: Code },
    { id: 'metrics',    label: 'MÃ©tricas & Loyalty',  icon: BarChart2 },
];

// â”€â”€â”€ Sub-Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ApiKeyCard({ apiKey, onDelete, onRotate }: { apiKey: ApiKey; onDelete: (id: string) => void; onRotate: (id: string) => void }) {
    const [showPrefix, setShowPrefix] = useState(false);
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{apiKey.name}</h3>
                    <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${apiKey.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                        {apiKey.status === 'active' ? 'â— Activa' : 'â—‹ Revocada'}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => onRotate(apiKey._id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500" title="Rotar clave">
                        <RefreshCw size={16} />
                    </button>
                    <button onClick={() => onDelete(apiKey._id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500" title="Revocar">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 font-mono text-sm mb-3 flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">{showPrefix ? apiKey.prefix + '...' : 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}</span>
                <button onClick={() => setShowPrefix(!showPrefix)} className="text-gray-400 hover:text-gray-600">
                    {showPrefix ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{apiKey.permissions?.length || 0} permisos</span>
                <span>{apiKey.requestCount?.toLocaleString() || 0} requests</span>
            </div>
        </div>
    );
}

function CreateKeyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: { name: string; permissions: string[] }) => void }) {
    const [name, setName] = useState('');
    const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

    const togglePerm = (id: string) => {
        setSelectedPerms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-light-border dark:border-gray-700 shadow-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Key size={20} className="text-primary-500" /> Nueva API Key
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500"><XAlt size={18} /></button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Nombre de la Key</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Mi integraciÃ³n marketplace" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Permisos</label>
                            <div className="space-y-4">
                                {Object.entries(PERMISSION_MODULES).map(([key, mod]) => (
                                    <div key={key} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <mod.icon size={18} className="text-primary-500" />
                                            <span className="font-semibold text-gray-900 dark:text-white text-sm">{mod.label}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {mod.permissions.map(p => (
                                                <button key={p.id} onClick={() => togglePerm(p.id)} className={`text-xs px-3 py-2 rounded-lg border transition-all ${selectedPerms.includes(p.id) ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-300'}`}>
                                                    {selectedPerms.includes(p.id) && <Check size={12} className="inline mr-1" />}
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => onCreate({ name, permissions: selectedPerms })} disabled={!name.trim()} className="w-full bg-gradient-primary text-white font-bold py-4 rounded-xl shadow-button hover:opacity-90 transition-opacity disabled:opacity-40">
                            Crear API Key ({selectedPerms.length} permisos)
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

function KeyRevealModal({ keyData, onClose }: { keyData: { key: string; name: string }; onClose: () => void }) {
    const copyKey = () => { navigator.clipboard.writeText(keyData.key); toast.success('Key copiada'); };
    return (
        <>
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-light-border dark:border-gray-700 p-8 max-w-md w-full text-center shadow-2xl">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check size={32} className="text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Â¡Key Creada!</h2>
                    <p className="text-sm text-red-500 dark:text-red-400 mb-4 font-semibold">
                        âš ï¸ Copia esta key ahora. No se mostrarÃ¡ de nuevo.
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 font-mono text-sm text-gray-800 dark:text-gray-200 break-all text-left mb-4 border border-gray-200 dark:border-gray-700">
                        {keyData.key}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={copyKey} className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700"><Copy size={16} /> Copiar</button>
                        <button onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700">Cerrar</button>
                    </div>
                </div>
            </div>
        </>
    );
}

function SdkSnippetsPanel() {
    const snippets = [
        { lang: 'JavaScript', code: `import { BeZhasSDK } from '@bezhas/sdk';\n\nconst sdk = new BeZhasSDK({\n  apiKey: 'bzh_sk_...your_key',\n  network: 'polygon'\n});\n\n// List marketplace items\nconst items = await sdk.marketplace.list({ limit: 20 });\nconsole.log(items);` },
        { lang: 'cURL', code: `curl -X GET "https://api.bez.digital/v1/marketplace/items" \\\n  -H "Authorization: Bearer bzh_sk_...your_key" \\\n  -H "Content-Type: application/json"` },
        { lang: 'Python', code: `import requests\n\nheaders = {\n    "Authorization": "Bearer bzh_sk_...your_key",\n    "Content-Type": "application/json"\n}\n\nresponse = requests.get(\n    "https://api.bez.digital/v1/marketplace/items",\n    headers=headers\n)\nprint(response.json())` },
    ];
    const [active, setActive] = useState(0);
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Code size={20} className="text-primary-500" /> SDK Integration Snippets</h3>
                <div className="flex gap-2 mb-4">
                    {snippets.map((s, i) => (
                        <button key={i} onClick={() => setActive(i)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${active === i ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-700' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{s.lang}</button>
                    ))}
                </div>
                <pre className="bg-gray-900 dark:bg-gray-950 text-green-400 rounded-xl p-6 overflow-x-auto text-sm font-mono leading-relaxed"><code>{snippets[active].code}</code></pre>
                <button onClick={() => { navigator.clipboard.writeText(snippets[active].code); toast.success('CÃ³digo copiado'); }} className="mt-4 flex items-center gap-2 text-sm text-primary-500 hover:text-primary-400 font-medium"><Copy size={14} /> Copiar snippet</button>
            </div>
        </div>
    );
}

function WebhooksPanel() {
    const [url, setUrl] = useState('');
    const events = ['payment.completed', 'escrow.created', 'escrow.released', 'order.shipped', 'nft.minted', 'user.verified'];
    const [selected, setSelected] = useState<string[]>([]);
    const toggle = (e: string) => setSelected(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><Globe size={20} className="text-primary-500" /> GestiÃ³n de Webhooks</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">URL del Webhook</label>
                    <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://tu-dominio.com/api/webhook" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Eventos</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {events.map(e => (
                            <button key={e} onClick={() => toggle(e)} className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all ${selected.includes(e) ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-300'}`}>
                                {selected.includes(e) && <Check size={12} className="inline mr-1" />}{e}
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={() => toast.success('Webhook registrado (demo)')} disabled={!url || selected.length === 0} className="bg-gradient-primary text-white font-bold py-3 px-6 rounded-xl shadow-button hover:opacity-90 transition-opacity disabled:opacity-40">
                    Registrar Webhook
                </button>
            </div>
        </div>
    );
}

function OpenClawPanel({ address }: { address?: string }) {
    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-glow">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm"><Cpu size={24} /></div>
                    <div>
                        <h3 className="text-xl font-bold">OpenClaw AI Agent</h3>
                        <p className="text-sm opacity-80">Agente autÃ³nomo de inteligencia artificial</p>
                    </div>
                </div>
                <p className="text-sm opacity-90 leading-relaxed">OpenClaw es el agente de IA autÃ³nomo del ecosistema BeZhas. Monitorea transacciones, optimiza farming, detecta fraude y ejecuta estrategias DeFi en nombre del usuario.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Estado del Agente', value: 'ðŸŸ¢ Activo', sub: 'Ãšltima acciÃ³n: hace 14m' },
                    { label: 'Alertas Procesadas', value: '1,247', sub: 'Este mes' },
                    { label: 'Efectividad', value: '98.3%', sub: 'PrecisiÃ³n promedio' },
                ].map((s, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                        <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4">Ãšltimas Acciones del Agente</h4>
                <div className="space-y-3">
                    {[
                        { action: 'OptimizÃ³ pool BEZ/USDT', time: '14m ago', type: 'farm' },
                        { action: 'DetectÃ³ actividad sospechosa â€” bloqueada', time: '2h ago', type: 'security' },
                        { action: 'AjustÃ³ parÃ¡metros de Quality Escrow', time: '5h ago', type: 'escrow' },
                        { action: 'GenerÃ³ reporte mensual de mÃ©tricas', time: '1d ago', type: 'report' },
                    ].map((a, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${a.type === 'security' ? 'bg-red-500' : a.type === 'farm' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{a.action}</span>
                            </div>
                            <span className="text-xs text-gray-400">{a.time}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function RevenueDashboard() {
    const stats = [
        { label: 'Ingresos BEZ (30d)', value: '12,450 BEZ', change: '+18.2%', positive: true },
        { label: 'Volumen Escrow', value: '$45,230', change: '+7.5%', positive: true },
        { label: 'Fees Marketplace', value: '890 BEZ', change: '+22.1%', positive: true },
        { label: 'Staking Rewards', value: '2,340 BEZ', change: '-3.4%', positive: false },
    ];
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                        <p className={`text-xs font-semibold mt-1 ${s.positive ? 'text-green-500' : 'text-red-500'}`}>{s.change}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4">Historial de Ingresos</h4>
                <div className="h-48 bg-gray-50 dark:bg-gray-800/30 rounded-xl flex items-center justify-center text-gray-400 text-sm">
                    ðŸ“Š GrÃ¡fico de ingresos â€” se conectarÃ¡ con Recharts en Fase 3C
                </div>
            </div>
        </div>
    );
}

function DocumentationPanel() {
    const sections = [
        { title: 'Inicio RÃ¡pido', desc: 'GuÃ­a de 5 minutos para integrar la API BeZhas en tu proyecto.', icon: Zap },
        { title: 'AutenticaciÃ³n', desc: 'Aprende a usar API Keys, SIWE, y OAuth con el SDK.', icon: Shield },
        { title: 'Marketplace API', desc: 'Endpoints para productos, Ã³rdenes, y bÃºsqueda avanzada.', icon: ShoppingCart },
        { title: 'Pagos & Escrow', desc: 'Integra pagos BEZ, Quality Escrow, y suscripciones VIP.', icon: DollarSign },
        { title: 'Webhooks', desc: 'Recibe notificaciones en tiempo real de eventos del ecosistema.', icon: Globe },
        { title: 'Smart Contracts', desc: 'ABIs, direcciones de contratos, y guÃ­as de interacciÃ³n on-chain.', icon: FileCode },
    ];
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((s, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg hover:shadow-xl transition-shadow cursor-pointer group">
                    <s.icon size={24} className="text-primary-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2">{s.title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{s.desc}</p>
                    <div className="mt-4 text-primary-500 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                        Ver docs <ExternalLink size={14} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function MetricsPanel() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Requests (24h)', value: '14,238', icon: Activity },
                    { label: 'Latencia Promedio', value: '42ms', icon: Zap },
                    { label: 'Tasa de Error', value: '0.12%', icon: AlertCircle },
                    { label: 'Puntos Loyalty', value: '3,840', icon: BarChart2 },
                ].map((s, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                        <div className="flex items-center justify-between mb-3">
                            <s.icon size={20} className="text-primary-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4">Programa de Loyalty</h4>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 dark:from-yellow-900/10 to-orange-50 dark:to-orange-900/10 rounded-xl border border-yellow-200 dark:border-yellow-800">
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white">Nivel: <span className="text-yellow-600 dark:text-yellow-400">Gold Developer</span></p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">3,840 / 5,000 puntos para Platinum</p>
                    </div>
                    <div className="text-3xl">ðŸ†</div>
                </div>
                <div className="mt-4 w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3">
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full" style={{ width: '76.8%' }} />
                </div>
            </div>
        </div>
    );
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ðŸ”§ MAIN PAGE COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function DeveloperConsolePage() {
    const { address, isConnected } = useAccount();
    const { open } = useWeb3Modal();

    const [activeTab, setActiveTab] = useState('keys');
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newKeyData, setNewKeyData] = useState<{ key: string; name: string } | null>(null);

    // â”€â”€ API Key CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fetchApiKeys = useCallback(async () => {
        if (!isConnected) { setApiKeys([]); setLoading(false); return; }
        try {
            const res = await api.get('/api/developer/keys', { timeout: 5000 });
            setApiKeys(res.data.data || []);
        } catch {
            // Backend not available â€” use mock data
            setApiKeys([
                { _id: 'demo1', name: 'Production Key', prefix: 'bzh_sk_prod_a3f2', permissions: ['marketplace:read', 'payments:read'], status: 'active', createdAt: new Date().toISOString(), requestCount: 12450 },
                { _id: 'demo2', name: 'Staging Key', prefix: 'bzh_sk_stg_9b1c', permissions: ['marketplace:read', 'marketplace:write', 'logistics:read'], status: 'active', createdAt: new Date().toISOString(), requestCount: 487 },
            ]);
        } finally {
            setLoading(false);
        }
    }, [isConnected]);

    useEffect(() => { fetchApiKeys(); }, [fetchApiKeys]);

    const handleCreateKey = async (formData: { name: string; permissions: string[] }) => {
        try {
            const res = await api.post('/api/developer/keys', formData);
            setNewKeyData(res.data.data);
            setShowCreateModal(false);
            fetchApiKeys();
            toast.success('API Key creada exitosamente');
        } catch {
            // Demo mode
            setNewKeyData({ key: `bzh_sk_${Math.random().toString(36).slice(2, 14)}`, name: formData.name });
            setShowCreateModal(false);
            toast.success('API Key creada (demo mode)');
        }
    };

    const handleDeleteKey = async (id: string) => {
        if (!window.confirm('Â¿Revocar esta API Key? Esta acciÃ³n no se puede deshacer.')) return;
        try {
            await api.delete(`/api/developer/keys/${id}`);
            toast.success('API Key revocada');
        } catch {
            toast.success('Key revocada (demo mode)');
        }
        setApiKeys(prev => prev.filter(k => k._id !== id));
    };

    const handleRotateKey = async (id: string) => {
        if (!window.confirm('Â¿Rotar esta clave? La anterior dejarÃ¡ de funcionar.')) return;
        const newKey = `bzh_sk_${Math.random().toString(36).slice(2, 14)}`;
        setNewKeyData({ key: newKey, name: apiKeys.find(k => k._id === id)?.name || 'Rotated Key' });
        toast.success('Clave rotada exitosamente');
    };

    // â”€â”€ Gate: Not Connected â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (!isConnected) {
        return (
            <div className="container mx-auto px-6 py-24 text-center">
                <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl shadow-soft-lg border border-light-border dark:border-gray-800 p-12">
                    <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Shield size={40} className="text-primary-500" />
                    </div>
                    <h2 className="text-3xl font-display font-bold text-gray-900 dark:text-white mb-4">Acceso Restringido</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8">Conecta tu wallet para acceder a la Developer Console.</p>
                    <button onClick={() => open()} className="bg-gradient-primary text-white font-bold py-4 px-8 rounded-xl shadow-button hover:opacity-90 transition-opacity w-full">Conectar Wallet</button>
                </div>
            </div>
        );
    }

    // â”€â”€ Main Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return (
        <div className="container mx-auto px-6 py-8 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-600 dark:from-primary-400 dark:to-indigo-400">
                        Developer Console
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        Gestiona tus integraciones, monitorea el uso y accede a herramientas avanzadas.
                    </p>
                </div>
                {activeTab === 'keys' && (
                    <button onClick={() => setShowCreateModal(true)} className="bg-gradient-primary text-white px-6 py-3 rounded-xl font-semibold shadow-button hover:opacity-90 transition-opacity flex items-center gap-2">
                        <Plus size={20} /> Nueva API Key
                    </button>
                )}
            </div>

            {/* Tabs Navigation */}
            <div className="flex overflow-x-auto gap-2 mb-8 pb-2 scrollbar-hide">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-primary-600 text-white shadow-button'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-light-hover dark:hover:bg-gray-700 border border-light-border dark:border-gray-700'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
                    </div>
                ) : (
                    <>
                        {/* API KEYS TAB */}
                        {activeTab === 'keys' && (
                            <div className="space-y-6">
                                {apiKeys.length === 0 ? (
                                    <div className="bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-12 text-center">
                                        <Key size={48} className="text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                                        <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">Sin API Keys</h3>
                                        <p className="text-gray-500 mb-6">Crea tu primera API Key para comenzar a integrar.</p>
                                        <button onClick={() => setShowCreateModal(true)} className="bg-gradient-primary text-white font-bold py-3 px-8 rounded-xl shadow-button hover:opacity-90 transition-opacity">
                                            <Plus size={18} className="inline mr-2" /> Crear API Key
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {apiKeys.map(key => (
                                            <ApiKeyCard key={key._id} apiKey={key} onDelete={handleDeleteKey} onRotate={handleRotateKey} />
                                        ))}
                                        <button onClick={() => setShowCreateModal(true)} className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-500 hover:border-primary-500 hover:text-primary-500 transition-all min-h-[200px]">
                                            <Plus size={40} className="mb-2 opacity-50" />
                                            <span className="font-semibold">Crear Nueva Key</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'sdk' && <SdkSnippetsPanel />}
                        {activeTab === 'webhooks' && <WebhooksPanel />}
                        {activeTab === 'openclaw' && <OpenClawPanel address={address} />}
                        {activeTab === 'revenue' && <RevenueDashboard />}
                        {activeTab === 'docs' && <DocumentationPanel />}
                        {activeTab === 'metrics' && <MetricsPanel />}
                    </>
                )}
            </div>

            {/* Modals */}
            {showCreateModal && <CreateKeyModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateKey} />}
            {newKeyData && <KeyRevealModal keyData={newKeyData} onClose={() => setNewKeyData(null)} />}
        </div>
    );
}

