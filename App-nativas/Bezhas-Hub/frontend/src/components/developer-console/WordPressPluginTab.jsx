import React, { useState } from 'react';
import {
    Globe, Download, Check, ExternalLink, Copy,
    Zap, ShieldCheck, CreditCard, LayoutDashboard,
    ToggleRight, Package, ChevronRight, Terminal
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const WP_VERSION = '2.0.0';
const DOWNLOAD_URL = '/api/downloads/bezhas-hub-wp.zip';

const FEATURES = [
    { icon: LayoutDashboard, color: '#10B981', label: 'Consola BeZ-Hub en wp-admin', desc: 'Panel completo del ecosistema incrustado en tu WordPress.' },
    { icon: Package,         color: '#6366F1', label: 'Planes de suscripción',       desc: 'Suscríbete y gestiona tu plan (Starter, Business, Pro, Enterprise) en $BEZ.' },
    { icon: ToggleRight,     color: '#0EA5E9', label: 'Activación de SubApps',       desc: 'Enciende CargoLink, Energy, Pay, PureScan y más con un toggle.' },
    { icon: CreditCard,      color: '#F59E0B', label: 'BeZhas-Pay integrado',        desc: 'Shortcode [bezhas_pay] + bloque Gutenberg + gateway WooCommerce.' },
    { icon: ShieldCheck,     color: '#8B5CF6', label: 'Polygon & BNB Chain',         desc: 'Liquidación on-chain real. Firma server-side, clave nunca al browser.' },
    { icon: Zap,             color: '#EC4899', label: 'API-Key segura',              desc: 'X-API-Key server-side; nonce WP en cada petición del panel.' },
];

const STEPS = [
    { n: '01', title: 'Descarga el ZIP', body: 'Pulsa el botón de descarga y guarda el archivo bezhas-hub-2.0.0.zip en tu equipo.' },
    { n: '02', title: 'Sube a WordPress', body: 'En tu dashboard: Plugins → Añadir nuevo → Subir plugin → Elige el ZIP → Instalar → Activar.' },
    { n: '03', title: 'Conecta tu API Key', body: 'Copia tu API Key de la pestaña "API Keys" y pégala en BeZhas Hub → Ajustes → API Key.' },
    { n: '04', title: 'Activa las SubApps', body: 'Entra en BeZhas Hub → Consola → SubApps y activa los módulos que necesites con un toggle.' },
    { n: '05', title: 'Configura los pagos', body: 'Activa el gateway en WooCommerce → Métodos de pago → BeZhas Pay, o usa el bloque en cualquier página.' },
];

function CopyBox({ label, value, accent = '#6366F1' }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success('Copiado');
        setTimeout(() => setCopied(false), 1800);
    };
    return (
        <div className="bg-gray-900 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
                {label && <p className="text-xs text-gray-500 mb-0.5">{label}</p>}
                <code className="text-sm font-mono" style={{ color: accent }}>{value}</code>
            </div>
            <button onClick={copy} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 hover:text-white">
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
        </div>
    );
}

export default function WordPressPluginTab() {
    return (
        <div className="space-y-8 max-w-5xl">

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-green-900/40 via-gray-900 to-blue-900/30 border border-green-500/30 rounded-2xl p-8">
                {/* decorative blob */}
                <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-green-500/10 blur-3xl pointer-events-none" />
                <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-shrink-0 p-5 bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl shadow-lg shadow-green-500/25">
                        <Globe className="w-12 h-12 text-white" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                            <h2 className="text-2xl font-bold text-white">Plugin WordPress BeZhas Hub</h2>
                            <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 font-semibold">
                                v{WP_VERSION} · Embedded Gateway
                            </span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">
                            Todo el ecosistema BeZhas dentro de tu WordPress: consola del Hub, planes, SubApps y BeZhas-Pay sin salir de wp-admin. Gateway WooCommerce incluido.
                        </p>
                    </div>
                    <a
                        href={DOWNLOAD_URL}
                        download="bezhas-hub-2.0.0.zip"
                        className="flex-shrink-0 flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-green-500/25 transition-all whitespace-nowrap"
                    >
                        <Download size={20} />
                        Descargar v{WP_VERSION}
                    </a>
                </div>

                {/* Requirements row */}
                <div className="relative mt-6 flex flex-wrap gap-3 text-xs">
                    {[
                        'WordPress 6.0+',
                        'PHP 7.4+',
                        'WooCommerce 8+ (opcional)',
                        'API Key BeZhas Hub',
                        'Cuenta BeZhas activa',
                    ].map(req => (
                        <span key={req} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-gray-300">
                            <Check size={11} className="text-green-400" /> {req}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Main grid: features + download card ──────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* Features — 3/5 */}
                <div className="lg:col-span-3 bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                    <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                        <Zap size={18} className="text-green-400" /> Qué incluye
                    </h3>
                    <div className="space-y-4">
                        {FEATURES.map(f => (
                            <div key={f.label} className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-9 h-9 rounded-xl grid place-items-center"
                                    style={{ background: `${f.color}20`, color: f.color }}>
                                    <f.icon size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{f.label}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Download card — 2/5 */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 flex-1">
                        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                            <Download size={18} className="text-green-400" /> Descarga
                        </h3>
                        <CopyBox label="Archivo" value="bezhas-hub-2.0.0.zip" accent="#10B981" />
                        <div className="mt-3 space-y-2 text-xs text-gray-400">
                            <p className="flex items-center gap-2"><Check size={12} className="text-green-400 shrink-0" /> Directorio raíz: <code className="text-gray-300">bezhas-hub/</code></p>
                            <p className="flex items-center gap-2"><Check size={12} className="text-green-400 shrink-0" /> Sin builder — PHP vanilla + JS vanilla</p>
                            <p className="flex items-center gap-2"><Check size={12} className="text-green-400 shrink-0" /> Actualizable vía ZIP sin perder ajustes</p>
                        </div>
                        <a
                            href={DOWNLOAD_URL}
                            download="bezhas-hub-2.0.0.zip"
                            className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl transition-all"
                        >
                            <Download size={18} /> Descargar ZIP
                        </a>
                    </div>

                    {/* Shortcode reference */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Terminal size={15} className="text-purple-400" /> Shortcode de pago
                        </h3>
                        <CopyBox value='[bezhas_pay amount="99" currency="EUR"]' accent="#A78BFA" />
                        <p className="text-xs text-gray-500 mt-2">Inserta el widget de cobro en cualquier página o entrada.</p>
                    </div>
                </div>
            </div>

            {/* ── Installation steps ───────────────────────────────────────── */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
                    <Package size={18} className="text-blue-400" /> Instalación paso a paso
                </h3>
                <div className="relative">
                    {/* vertical line */}
                    <div className="absolute left-5 top-6 bottom-6 w-px bg-gray-700 hidden md:block" />
                    <div className="space-y-5">
                        {STEPS.map((s, i) => (
                            <div key={s.n} className="flex items-start gap-5">
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 grid place-items-center text-white font-bold text-sm z-10">
                                    {s.n}
                                </div>
                                <div className="flex-1 bg-gray-900/50 rounded-xl px-4 py-3">
                                    <p className="text-sm font-semibold text-white">{s.title}</p>
                                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{s.body}</p>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <ChevronRight size={16} className="text-gray-600 mt-3 hidden md:block flex-shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── WooCommerce config snippet ────────────────────────────────── */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                    <Terminal size={18} className="text-yellow-400" /> Ejemplo: llamada directa a la API desde PHP
                </h3>
                <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto font-mono text-sm leading-relaxed">
                    <p className="text-gray-500">{'// Dentro de tu tema o plugin personalizado:'}</p>
                    <p className="text-purple-300">{'$client = new BeZhas_Client();'}</p>
                    <p className="text-yellow-300">{'$quote  = $client->post(\'/api/plugin-bridge/quote\', ['}</p>
                    <p className="text-yellow-300">{'    \'plan\'     => \'business\','}</p>
                    <p className="text-yellow-300">{'    \'billing\'  => \'annual\','}</p>
                    <p className="text-yellow-300">{'    \'currency\' => \'BEZ\','}</p>
                    <p className="text-yellow-300">{']);'}</p>
                    <p className="text-green-400 mt-2">{'// $quote->price_bez → precio final en $BEZ'}</p>
                </div>
            </div>
        </div>
    );
}
