'use client';

import { useState, useMemo } from 'react';
import { useContracts, useBlockchainSSE } from '@/lib/hooks';
import { useDeployments, useContractABI } from '@/lib/contract-hooks';
import type { DeployedContract } from '@/lib/types';
import { SECTOR_META } from '@/lib/types';
import InfraEcosystemNav from '@/components/InfraEcosystemNav';
import {
    FileCode2, Search, Activity, ChevronDown, ChevronRight, Copy,
    CheckCircle2, Layers, Hash, Box, ExternalLink,
} from 'lucide-react';

export default function ContractsPage() {
    const { data: contracts, isLoading } = useContracts();
    const { deployments, loading: deploymentsLoading } = useDeployments();
    const { events: contractEvents, connected: sseConnected } = useBlockchainSSE('contract');

    const [search, setSearch] = useState('');
    const [sectorFilter, setSectorFilter] = useState<string>('all');
    const [expandedContract, setExpandedContract] = useState<string | null>(null);
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    // ── Derived Data ──
    const allContracts = contracts ?? [];

    const sectors = useMemo(() => {
        const set = new Set(allContracts.map(c => c.sector));
        return Array.from(set).sort();
    }, [allContracts]);

    const filtered = useMemo(() => {
        let list = allContracts;
        if (sectorFilter !== 'all') {
            list = list.filter(c => c.sector === sectorFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(c =>
                c.contract_name.toLowerCase().includes(q) ||
                c.address.toLowerCase().includes(q) ||
                c.sector.toLowerCase().includes(q)
            );
        }
        return list;
    }, [allContracts, sectorFilter, search]);

    // ── Deployment counts from manifest ──
    const deploymentStats = useMemo(() => {
        if (!deployments) return { core: 0, sectors: 0, total: 0 };
        const core = Object.keys(deployments.core || {}).length;
        const sectorCount = Object.values(deployments.sectors || {}).reduce(
            (acc, s) => acc + Object.keys(s).length, 0
        );
        return { core, sectors: sectorCount, total: core + sectorCount };
    }, [deployments]);

    const copyAddress = (addr: string) => {
        navigator.clipboard.writeText(addr);
        setCopiedAddress(addr);
        setTimeout(() => setCopiedAddress(null), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Ecosystem Nav */}
            <InfraEcosystemNav />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileCode2 className="w-7 h-7 text-bezhas-accent" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Contratos Desplegados</h1>
                        <p className="text-sm text-gray-500">
                            Registro de smart contracts en la L2 BeZhas · {allContracts.length} contratos
                        </p>
                    </div>
                </div>
                {/* SSE indicator */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-500">
                    <div className={`h-2 w-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
                    {sseConnected ? 'Eventos en vivo' : 'Sin conexión'}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Total Contratos</p>
                    <p className="text-xl font-bold text-gray-900">{allContracts.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Sectores</p>
                    <p className="text-xl font-bold text-indigo-600">{sectors.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Core (Manifest)</p>
                    <p className="text-xl font-bold text-blue-600">{deploymentsLoading ? '...' : deploymentStats.core}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Sectoriales</p>
                    <p className="text-xl font-bold text-emerald-600">{deploymentsLoading ? '...' : deploymentStats.sectors}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Eventos SSE</p>
                    <p className="text-xl font-bold text-bezhas-accent">{contractEvents.length}</p>
                </div>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, dirección o sector..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bezhas-accent transition"
                    />
                </div>
                <select
                    value={sectorFilter}
                    onChange={e => setSectorFilter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-bezhas-accent"
                >
                    <option value="all">Todos los sectores</option>
                    {sectors.map(s => {
                        const meta = SECTOR_META[s];
                        return <option key={s} value={s}>{meta ? `${meta.icon} ${meta.name}` : s}</option>;
                    })}
                </select>
            </div>

            {/* Sector Chips */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSectorFilter('all')}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${sectorFilter === 'all'
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                >
                    Todos ({allContracts.length})
                </button>
                {sectors.map(s => {
                    const meta = SECTOR_META[s];
                    const count = allContracts.filter(c => c.sector === s).length;
                    return (
                        <button
                            key={s}
                            onClick={() => setSectorFilter(s === sectorFilter ? 'all' : s)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition ${sectorFilter === s
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            {meta?.icon || '🔗'} {meta?.name || s} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Contracts List */}
            {isLoading ? (
                <div className="text-gray-400 text-sm py-8 text-center">Cargando contratos...</div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                    <FileCode2 className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400 text-sm">
                        {search || sectorFilter !== 'all' ? 'No hay contratos que coincidan con el filtro' : 'No hay contratos desplegados'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(contract => (
                        <ContractRow
                            key={contract.address}
                            contract={contract}
                            expanded={expandedContract === contract.address}
                            onToggle={() => setExpandedContract(
                                expandedContract === contract.address ? null : contract.address
                            )}
                            copiedAddress={copiedAddress}
                            onCopy={copyAddress}
                        />
                    ))}
                </div>
            )}

            {/* Live Contract Events */}
            {contractEvents.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-bezhas-accent" />
                        Eventos de Contrato Recientes
                    </h3>
                    <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                        {contractEvents.slice(0, 30).map((evt, i) => (
                            <div key={`${evt.timestamp}-${i}`}
                                className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded text-xs hover:bg-gray-100 transition">
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-bezhas-accent" />
                                    <span className="font-medium text-gray-700">{evt.channel}</span>
                                    <span className="text-gray-400 truncate max-w-[250px]">
                                        {JSON.stringify(evt.data).slice(0, 60)}
                                    </span>
                                </div>
                                <span className="text-gray-300 whitespace-nowrap ml-2">
                                    {new Date(evt.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Deployment Manifest Preview */}
            {deployments && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        Manifiesto de Despliegue
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Core contracts */}
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Core ({Object.keys(deployments.core || {}).length})</h4>
                            <div className="space-y-1">
                                {Object.entries(deployments.core || {}).map(([name, addr]) => (
                                    <div key={name} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-xs">
                                        <span className="font-medium text-gray-700">{name}</span>
                                        <span className="font-mono text-gray-400 text-[10px]">
                                            {typeof addr === 'string' ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Sector contracts */}
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Sectores</h4>
                            <div className="space-y-1">
                                {Object.entries(deployments.sectors || {}).map(([sector, contractsMap]) => {
                                    const meta = SECTOR_META[sector];
                                    return (
                                        <div key={sector} className="py-1 px-2 bg-gray-50 rounded text-xs">
                                            <span className="font-medium text-gray-700">
                                                {meta?.icon || '🔗'} {meta?.name || sector}
                                            </span>
                                            <span className="ml-2 text-gray-400">
                                                ({Object.keys(contractsMap).length} contratos)
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Contract Row with expandable ABI details ──
function ContractRow({ contract, expanded, onToggle, copiedAddress, onCopy }: {
    contract: DeployedContract;
    expanded: boolean;
    onToggle: () => void;
    copiedAddress: string | null;
    onCopy: (addr: string) => void;
}) {
    const meta = SECTOR_META[contract.sector];

    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-sm transition">
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition"
                onClick={onToggle}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-1.5">
                        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">{contract.contract_name}</span>
                            {meta && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-600">
                                    {meta.icon} {meta.name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-bezhas-accent">{contract.address}</span>
                            <button
                                onClick={e => { e.stopPropagation(); onCopy(contract.address); }}
                                className="p-0.5 hover:bg-gray-100 rounded transition"
                                title="Copiar dirección"
                            >
                                {copiedAddress === contract.address
                                    ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    : <Copy className="w-3 h-3 text-gray-400" />
                                }
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Hash className="w-3 h-3" /> {contract.chain_id}
                    </span>
                    <span className="text-xs text-gray-400">
                        {contract.deployed_at ? new Date(contract.deployed_at).toLocaleDateString() : '—'}
                    </span>
                </div>
            </div>

            {expanded && (
                <ContractABIPanel contractName={contract.contract_name} address={contract.address} />
            )}
        </div>
    );
}

// ── ABI detail panel (lazy-loaded per contract) ──
function ContractABIPanel({ contractName, address }: { contractName: string; address: string }) {
    const { abiMeta, loading, error } = useContractABI(contractName);

    if (loading) {
        return (
            <div className="px-4 py-6 border-t border-gray-50 text-center text-sm text-gray-400">
                Cargando ABI de {contractName}...
            </div>
        );
    }

    if (error || !abiMeta) {
        return (
            <div className="px-4 py-4 border-t border-gray-50 text-center text-xs text-gray-400">
                {error || 'ABI no disponible para este contrato'}
            </div>
        );
    }

    const functions = abiMeta.abi?.filter(e => e.type === 'function') ?? [];
    const events = abiMeta.abi?.filter(e => e.type === 'event') ?? [];
    const readFns = functions.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure');
    const writeFns = functions.filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure');

    return (
        <div className="px-4 py-4 border-t border-gray-50 bg-gray-50/30 space-y-4">
            {/* Summary */}
            <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1 text-gray-600">
                    <Box className="w-3 h-3 text-blue-500" /> {abiMeta.functions} funciones
                </span>
                <span className="flex items-center gap-1 text-gray-600">
                    <Activity className="w-3 h-3 text-emerald-500" /> {abiMeta.events} eventos
                </span>
                <span className="flex items-center gap-1 text-gray-600">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {abiMeta.deployed ? 'Desplegado' : 'No desplegado'}
                </span>
                {abiMeta.address && (
                    <span className="flex items-center gap-1 text-gray-400 font-mono text-[10px]">
                        <ExternalLink className="w-3 h-3" /> {abiMeta.address}
                    </span>
                )}
            </div>

            {/* Read Functions */}
            {readFns.length > 0 && (
                <div>
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Lectura ({readFns.length})</h4>
                    <div className="flex flex-wrap gap-1">
                        {readFns.map(fn => (
                            <span key={fn.name} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">
                                {fn.name}({fn.inputs?.map(i => i.type).join(', ') || ''})
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Write Functions */}
            {writeFns.length > 0 && (
                <div>
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Escritura ({writeFns.length})</h4>
                    <div className="flex flex-wrap gap-1">
                        {writeFns.map(fn => (
                            <span key={fn.name} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-mono">
                                {fn.name}({fn.inputs?.map(i => i.type).join(', ') || ''})
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Events */}
            {events.length > 0 && (
                <div>
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Eventos ({events.length})</h4>
                    <div className="flex flex-wrap gap-1">
                        {events.map(evt => (
                            <span key={evt.name} className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-mono">
                                {evt.name}({evt.inputs?.map(i => `${i.indexed ? 'indexed ' : ''}${i.type}`).join(', ') || ''})
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
