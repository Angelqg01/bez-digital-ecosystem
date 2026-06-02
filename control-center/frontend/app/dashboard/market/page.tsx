'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import {
    TrendingUp, Coins, Image, Users, BarChart3, Activity, RefreshCw,
    ShieldCheck, ShoppingBag, Key
} from 'lucide-react';
import { useMarketDocuments } from '@/lib/hooks';
import type { Document } from '@/lib/types';

interface MarketStats {
    totalSupply: string;
    totalNFTs: number;
    owners: number;
    totalVolume: string;
    volume24h: string;
    blockNumber: number;
    gasPrice: string;
}

export default function MarketPage() {
    const { data, isLoading, mutate: refresh } = useSWR<MarketStats>('/market/stats', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 15000,
    });

    const fmt = (v: string | number, decimals = 2) => {
        const n = typeof v === 'string' ? parseFloat(v) : v;
        if (isNaN(n)) return '0';
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(decimals)}K`;
        return n.toFixed(decimals);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Market Overview</h1>
                    <p className="text-slate-500 mt-1">Estadisticas en tiempo real del ecosistema BeZhas</p>
                </div>
                <button
                    onClick={() => refresh()}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Token Supply */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400 rounded-full blur-[100px] opacity-10 -mr-16 -mt-16" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <Coins className="text-amber-400" size={24} />
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">$BEZ Total Supply</span>
                        </div>
                        <p className="text-4xl font-black tracking-tight">
                            {data ? fmt(data.totalSupply) : '—'}
                        </p>
                        <p className="text-sm text-slate-400 mt-2">Token nativo de la red BeZhas L2</p>
                    </div>
                </div>

                {/* Volume 24h */}
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-300 rounded-full blur-[100px] opacity-20 -mr-16 -mt-16" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="text-emerald-200" size={24} />
                            <span className="text-xs font-bold uppercase tracking-widest text-emerald-200/80">Volumen 24h</span>
                        </div>
                        <p className="text-4xl font-black tracking-tight">
                            {data ? `${fmt(data.volume24h)} BEZ` : '—'}
                        </p>
                        <p className="text-sm text-emerald-200/80 mt-2">
                            Total historico: {data ? `${fmt(data.totalVolume)} BEZ` : '—'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Detail Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <DetailCard
                    icon={<Image className="text-indigo-500" size={20} />}
                    label="Total NFTs"
                    value={data ? data.totalNFTs.toLocaleString() : '—'}
                    sub="Mintados on-chain"
                />
                <DetailCard
                    icon={<Users className="text-blue-500" size={20} />}
                    label="Propietarios Unicos"
                    value={data ? data.owners.toLocaleString() : '—'}
                    sub="Wallets con NFTs"
                />
                <DetailCard
                    icon={<BarChart3 className="text-bezhas-accent" size={20} />}
                    label="Block Height"
                    value={data ? data.blockNumber.toLocaleString() : '—'}
                    sub="Ultimo bloque L2"
                />
                <DetailCard
                    icon={<Activity className="text-rose-500" size={20} />}
                    label="Gas Price"
                    value={data ? `${data.gasPrice} Gwei` : '—'}
                    sub="Precio promedio"
                />
            </div>

            {/* Market Info */}
            <div className="bg-white rounded-3xl border border-slate-100 p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Metricas del Token $BEZ</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Network</p>
                        <p className="text-lg font-bold text-slate-900">BeZhas L2 (OP Stack)</p>
                        <p className="text-sm text-slate-500 mt-1">Chain ID: 2708</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Token Standard</p>
                        <p className="text-lg font-bold text-slate-900">ERC-20</p>
                        <p className="text-sm text-slate-500 mt-1">BEZCoinV2.sol — 18 decimales</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Consensus</p>
                        <p className="text-lg font-bold text-slate-900">OP Stack + Aegis AI</p>
                        <p className="text-sm text-slate-500 mt-1">Validacion por IA antes de firma</p>
                    </div>
                </div>
            </div>

            {/* Document Marketplace */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Document Marketplace</h2>
                        <p className="text-slate-500 text-sm">Comercializa activos validados on-chain</p>
                    </div>
                </div>

                <MarketplaceGrid />
            </div>
        </div>
    );
}

function MarketplaceGrid() {
    const { data, isLoading } = useMarketDocuments();
    const documents = data?.documents ?? [];

    if (isLoading) return <div className="text-center py-12 text-slate-400">Cargando mercado...</div>;
    if (documents.length === 0) return (
        <div className="bg-slate-50 rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
            <ShoppingBag className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-medium">No hay documentos listados para la venta en este momento.</p>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
                <MarketItem key={doc.id} doc={doc} />
            ))}
        </div>
    );
}

function MarketItem({ doc }: { doc: Document }) {
    return (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <ShieldCheck size={24} />
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md">
                        {doc.doc_type}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">ID: {doc.id.slice(0, 8)}</p>
                </div>
            </div>

            <h3 className="font-bold text-slate-900 mb-1">{doc.title}</h3>
            <p className="text-sm text-slate-500 line-clamp-2 mb-4">{doc.description || 'Sin descripción disponible'}</p>

            <div className="space-y-3 mb-6">
                <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Creador</span>
                    <span className="font-mono text-slate-700">{doc.owner_address.slice(0, 6)}...{doc.owner_address.slice(-4)}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Validación AI</span>
                    <span className="text-emerald-600 font-bold">{(doc.ai_confidence ? doc.ai_confidence * 100 : 0).toFixed(0)}% Confianza</span>
                </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precio</p>
                    <p className="text-xl font-black text-slate-900">{doc.permissions?.price || '0.00'} <span className="text-sm font-bold text-indigo-500">BEZ</span></p>
                </div>
                <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-bezhas-accent transition-colors">
                    Comprar
                </button>
            </div>

            {doc.permissions?.rent_enabled && (
                <button className="w-full mt-3 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                    <Key size={12} /> Alquilar por {doc.permissions.rental_terms?.price_per_day} BEZ / día
                </button>
            )}
        </div>
    );
}

function DetailCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                    {icon}
                </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
            <p className="text-xs text-slate-400 mt-1">{sub}</p>
        </div>
    );
}
