'use client';

import { Settings, Globe, Shield, Key, Database, Server, HardDrive, Loader2, AlertCircle, ExternalLink, Lock, Cpu } from 'lucide-react';
import { usePlatformConfig } from '@/lib/hooks';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">{icon} {title}</h2>
            {children}
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-mono text-gray-900">{value}</span>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const isUp = status === 'up' || status === 'connected';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isUp ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-green-500' : 'bg-red-500'}`} />
            {status}
        </span>
    );
}

export default function SettingsPage() {
    const { data: config, error, isLoading } = usePlatformConfig();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando configuración…
            </div>
        );
    }

    if (error || !config) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500 gap-2">
                <AlertCircle className="w-5 h-5" /> Error al cargar la configuración de la plataforma.
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-3">
                <Settings className="w-7 h-7 text-gray-400" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
                    <p className="text-sm text-gray-500">Ajustes de red, API y seguridad del Control Center</p>
                </div>
            </div>

            <Section title="Red Blockchain" icon={<Globe className="w-5 h-5 text-bezhas-accent" />}>
                <Field label="Chain ID" value={String(config.network.chain_id)} />
                <Field label="Nombre" value={config.network.name} />
                <Field label="RPC URL" value={config.network.rpc_url} />
                <Field label="Token Nativo" value={config.network.token} />
                <Field label="Block Height" value={config.network.block_height != null ? config.network.block_height.toLocaleString() : '—'} />
                <Field label="Gas Price" value={config.network.gas_price ?? '—'} />
            </Section>

            <Section title="API Backend" icon={<Database className="w-5 h-5 text-bezhas-purple" />}>
                <Field label="Versión" value={config.api.version} />
                <Field label="URL Base" value={config.api.url} />
                <Field label="Documentación" value={config.api.docs_url} />
                <Field label="Rate Limit" value={`${config.api.rate_limit_per_15min} req / 15 min`} />
                <Field label="Autenticación" value={config.api.auth_method} />
                <Field label="CORS" value={config.api.cors_origins.join(', ')} />
            </Section>

            <Section title="Servicios" icon={<Server className="w-5 h-5 text-bezhas-emerald" />}>
                <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                    <span className="text-sm text-gray-500">Base de datos</span>
                    <div className="flex items-center gap-3">
                        <StatusBadge status={config.services.database.status} />
                        <span className="text-xs text-gray-400">{config.services.database.version ?? ''} · {config.services.database.tables} tablas</span>
                    </div>
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                    <span className="text-sm text-gray-500">Aegis AI</span>
                    <div className="flex items-center gap-3">
                        <StatusBadge status={config.services.aegis.status} />
                        <span className="text-xs text-gray-400">{config.services.aegis.models} modelos</span>
                    </div>
                </div>
                <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-gray-500">MCP Engine</span>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{config.services.mcp.tools} herramientas</span>
                    </div>
                </div>
            </Section>

            <Section title="IPFS / Almacenamiento" icon={<HardDrive className="w-5 h-5 text-bezhas-orange" />}>
                <Field label="Configurado" value={config.ipfs.configured ? 'Sí (Pinata)' : 'No'} />
                <Field label="Gateway" value={config.ipfs.gateway || '—'} />
            </Section>

            <Section title="Administración de Infraestructura L2 & Docker" icon={<Cpu className="w-5 h-5 text-bezhas-accent" />}>
                <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-2 mb-4">
                    <div className="flex items-center gap-1.5 font-bold">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        Aislamiento de Seguridad DevOps Activado
                    </div>
                    <p className="leading-relaxed">
                        Los paneles de infraestructura corren en contenedores Docker y subdominios aislados del portal de clientes. Requieren autenticación independiente de doble factor (2FA) para mitigar vectores de ataque RCE.
                    </p>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Grafana Analytics & Logs</p>
                            <p className="text-xs text-gray-500">Métricas L2, hardware, docker y agregación de logs Loki</p>
                        </div>
                        <a 
                            href="http://localhost:3030" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1 bg-bezhas-accent hover:bg-bezhas-accent/90 text-white text-xs font-bold rounded-lg transition"
                        >
                            Abrir <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Portainer Docker GUI</p>
                            <p className="text-xs text-gray-500">Control visual de contenedores, reinicios y volúmenes</p>
                        </div>
                        <a 
                            href="http://localhost:9000" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-lg transition"
                        >
                            Portainer <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Prometheus Server</p>
                            <p className="text-xs text-gray-500">Explorador de telemetría y consultas PromQL</p>
                        </div>
                        <a 
                            href="http://localhost:9090" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold rounded-lg transition"
                        >
                            Prometheus <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Alertmanager Alerts</p>
                            <p className="text-xs text-gray-500">Despacho de notificaciones críticas a canales</p>
                        </div>
                        <a 
                            href="http://localhost:9093" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold rounded-lg transition"
                        >
                            Alerts <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </Section>

            <Section title="API Keys" icon={<Key className="w-5 h-5 text-bezhas-orange" />}>
                <div className="text-sm text-gray-500 py-4 text-center">
                    La gestión de API Keys estará disponible en la próxima versión.
                </div>
            </Section>
        </div>
    );
}
