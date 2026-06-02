'use client';

import { useQRCodes, useQRStats } from '@/lib/hooks';
import { api } from '@/lib/api';
import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { QrCode, Plus, Eye, Ban, Copy, ScanLine, CreditCard, Package, FileCheck, User } from 'lucide-react';
import { useSWRConfig } from 'swr';
import type { QRCode as GlobalQRCode } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

// Interfaces locales para máxima precisión de datos
interface QRPayload {
    amount?: number;
    recipient?: string;
    shipmentId?: string;
    contractAddress?: string;
    function?: string;
    tokenId?: string;
    dynamic?: boolean;
    onChainSync?: boolean;
    dynamicMetadata?: boolean;
    isBridge?: boolean;
}

interface QRCode extends Omit<GlobalQRCode, 'payload'> {
    payload?: QRPayload;
}

const QR_TYPE_META = {
    payment: { label: 'Pago/DeFi', icon: <CreditCard className="w-4 h-4" />, color: 'text-green-600 bg-green-50 border-green-100' },
    contract: { label: 'Smart Contract', icon: <ScanLine className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
    tracking: { label: 'Trazabilidad', icon: <Package className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50 border-blue-100' },
    nft: { label: 'NFT/Activo', icon: <QrCode className="w-4 h-4" />, color: 'text-pink-600 bg-pink-50 border-pink-100' },
    validation: { label: 'Validación ZK', icon: <FileCheck className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50 border-purple-100' },
    identity: { label: 'Identidad DID', icon: <User className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 border-amber-100' },
    governance: { label: 'Gobernanza', icon: <FileCheck className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50 border-orange-100' },
    custom: { label: 'Custom Payload', icon: <QrCode className="w-4 h-4" />, color: 'text-gray-600 bg-gray-50 border-gray-100' },
} as const;

const STATUS_BADGES: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    used: 'bg-gray-100 text-gray-600',
    expired: 'bg-yellow-100 text-yellow-700',
    revoked: 'bg-red-100 text-red-700',
};

export default function QRPage() {
    const [filters, setFilters] = useState({ type: '', status: '' });
    const { user, openLoginModal } = useAuth() as any;
    const isGuest = !user;

    const { data: realData, isLoading: isQrLoading } = useQRCodes(isGuest ? 'null' : filters.type, isGuest ? 'null' : filters.status);
    const { data: realStatsData } = useQRStats();
    const { mutate } = useSWRConfig();
    const [showCreate, setShowCreate] = useState(false);

    const mockQRCodes: QRCode[] = useMemo(() => [
        { id: 'qr-1', code: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', type: 'payment', status: 'active', amount_bez: 250, scan_count: 0, max_scans: 1, created_at: new Date().toISOString(), owner_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
        { id: 'qr-2', code: 'SHIP-001-TEST', type: 'tracking', status: 'active', shipment_id: 'SHIP-001', scan_count: 1, max_scans: 5, created_at: new Date(Date.now() - 3600000).toISOString(), owner_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
        { id: 'qr-3', code: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', type: 'contract', status: 'used', payload: { contractAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', function: 'refillGas' }, scan_count: 1, max_scans: 1, created_at: new Date(Date.now() - 86400000).toISOString(), owner_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' }
    ], []);

    const filteredMockCodes = useMemo(() => {
        return mockQRCodes.filter(qr => {
            if (filters.type && qr.type !== filters.type) return false;
            if (filters.status && qr.status !== filters.status) return false;
            return true;
        });
    }, [mockQRCodes, filters.type, filters.status]);

    const data = isGuest ? { qrCodes: filteredMockCodes } : realData;
    const isLoading = isGuest ? false : isQrLoading;

    const statsData = isGuest ? {
        stats: [
            { type: 'payment', total: 1, active: 1, total_scans: 0 },
            { type: 'tracking', total: 1, active: 1, total_scans: 1 },
            { type: 'contract', total: 1, active: 0, total_scans: 1 }
        ]
    } : realStatsData;

    const statsSummary = useMemo(() => {
        const stats = statsData?.stats ?? [];
        return {
            totalCodes: stats.reduce((s, r) => s + (r.total || 0), 0),
            totalActive: stats.reduce((s, r) => s + (r.active || 0), 0),
            totalScans: stats.reduce((s, r) => s + (r.total_scans || 0), 0),
            byType: stats
        };
    }, [statsData]);

    const handleRefresh = useCallback(() => {
        mutate((key: string) => typeof key === 'string' && key.includes('/qr'));
    }, [mutate]);

    return (
        <div className="space-y-6 p-4 max-w-7xl mx-auto">
            {/* Header section optimizada */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-bezhas-accent/10 rounded-xl">
                        <QrCode className="w-8 h-8 text-bezhas-accent" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Gestión de QR</h1>
                        <p className="text-sm text-gray-500">Puente interactivo entre activos físicos y la red BeZhas</p>
                    </div>
                </div>
                <button
                    onClick={() => isGuest ? openLoginModal() : setShowCreate(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-bezhas-accent text-white rounded-2xl hover:shadow-lg transition-all active:scale-95 font-bold text-sm"
                >
                    <Plus className="w-4 h-4" /> Nuevo Código
                </button>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Códigos" value={statsSummary.totalCodes} />
                <StatCard label="Activos" value={statsSummary.totalActive} color="text-green-600" />
                <StatCard label="Escaneos Totales" value={statsSummary.totalScans} color="text-blue-600" />
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2">Por Categoría</p>
                    <div className="flex flex-wrap gap-1.5">
                        {statsSummary.byType.map(s => (
                            <span key={s.type} className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-50 text-gray-500 border border-gray-100 font-bold">
                                {QR_TYPE_META[s.type as keyof typeof QR_TYPE_META]?.label || s.type}: {s.total}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filtros y Lista */}
            <section className="space-y-4">
                <div className="flex flex-wrap gap-3">
                    <select
                        className="text-sm border border-gray-100 rounded-xl px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-bezhas-accent/20 outline-none transition-all font-medium"
                        value={filters.type}
                        onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))}
                    >
                        <option value="">Todos los Tipos</option>
                        {Object.entries(QR_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select
                        className="text-sm border border-gray-100 rounded-xl px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-bezhas-accent/20 outline-none transition-all font-medium"
                        value={filters.status}
                        onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="">Todos los Estados</option>
                        <option value="active">Activos</option>
                        <option value="used">Usados</option>
                        <option value="expired">Expirados</option>
                        <option value="revoked">Revocados</option>
                    </select>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center py-20 gap-4 text-gray-300">
                        <QrCode className="w-12 h-12 animate-pulse" />
                        <p className="text-sm font-medium">Sincronizando con BeZhas Scan...</p>
                    </div>
                ) : (data?.qrCodes ?? []).length === 0 ? (
                    <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 py-20 text-center">
                         <QrCode className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                         <p className="text-gray-400 font-medium">No se encontraron códigos con estos criterios</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {(data?.qrCodes ?? []).map((qr: QRCode) => (
                            <QRCard key={qr.id} qr={qr} onRefresh={handleRefresh} />
                        ))}
                    </div>
                )}
            </section>

            {showCreate && <CreateQRModal onClose={() => setShowCreate(false)} onCreated={handleRefresh} />}
        </div>
    );
}

function StatCard({ label, value, color = "text-gray-900" }: { label: string; value: number; color?: string }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{label}</p>
            <p className={`text-3xl font-black mt-1 ${color}`}>{value.toLocaleString()}</p>
        </div>
    );
}

function QRCard({ qr, onRefresh }: { qr: QRCode; onRefresh: () => void }) {
    const { user, openLoginModal } = useAuth() as any;
    const isGuest = !user;

    const meta = QR_TYPE_META[qr.type as keyof typeof QR_TYPE_META] || QR_TYPE_META.custom;
    const isDynamic = qr.type === 'contract' || qr.type === 'nft' || !!qr.payload?.dynamic;

    const handleRevoke = async () => {
        if (isGuest) {
            openLoginModal();
            return;
        }
        if (!confirm('¿Deseas revocar este acceso? Esta acción es irreversible.')) return;
        try {
            await api.post(`/qr/${qr.code}/revoke`, {});
            onRefresh();
        } catch (err) {
            console.error("Error revoking QR", err);
        }
    };

    return (
        <div className="bg-white rounded-3xl border border-gray-100 p-5 hover:border-bezhas-accent/30 hover:shadow-xl transition-all duration-300 group relative">
            <div className="flex items-center justify-between mb-4">
                <span className={`flex items-center gap-2 text-[10px] uppercase font-black px-3 py-1 rounded-xl border ${meta.color}`}>
                    {meta.icon} {meta.label}
                </span>
                <div className="flex gap-1.5">
                    {isDynamic && (
                        <span className="flex items-center gap-1.5 text-[9px] font-black text-bezhas-accent bg-bezhas-accent/5 px-2.5 py-1 rounded-full border border-bezhas-accent/10">
                            <span className="w-1.5 h-1.5 bg-bezhas-accent rounded-full animate-pulse" />
                            LIVE
                        </span>
                    )}
                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${STATUS_BADGES[qr.status]}`}>
                        {qr.status}
                    </span>
                </div>
            </div>

            <p className="text-[11px] font-mono text-gray-400 bg-gray-50 p-2 rounded-xl mb-4 truncate select-all" title={qr.code}>
                {qr.code}
            </p>

            <div className="space-y-2 mb-6">
                {qr.amount_bez && (
                    <div className="flex items-center justify-between bg-green-50/50 p-3 rounded-2xl">
                        <span className="text-xs text-green-600 font-bold uppercase tracking-tight">Valor BEZ</span>
                        <span className="text-lg font-black text-green-700">{qr.amount_bez}</span>
                    </div>
                )}
                
                {qr.type === 'contract' && !!qr.payload?.contractAddress && (
                    <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/30">
                        <p className="text-[9px] text-indigo-400 font-black uppercase mb-1">On-Chain Interaction</p>
                        <p className="text-xs font-mono text-indigo-700 truncate">{String(qr.payload.contractAddress)}</p>
                        {!!qr.payload.function && (
                            <p className="text-xs text-indigo-900 mt-1 font-black">fn: {String(qr.payload.function)}()</p>
                        )}
                    </div>
                )}

                {qr.type === 'nft' && !!qr.payload?.tokenId && (
                    <div className="bg-pink-50/50 p-3 rounded-2xl border border-pink-100/30">
                        <p className="text-[9px] text-pink-400 font-black uppercase mb-1">Asset Tokenizado</p>
                        <p className="text-sm font-black text-pink-700 underline decoration-pink-200">Token ID: #{String(qr.payload.tokenId)}</p>
                    </div>
                )}

                {qr.shipment_id && (
                    <div className="flex items-center justify-between bg-blue-50/30 p-2 px-3 rounded-xl">
                        <span className="text-[10px] text-blue-400 font-bold uppercase">Shipment ID</span>
                        <span className="text-xs font-black text-blue-600">{qr.shipment_id}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold">
                        <ScanLine className="w-3.5 h-3.5" />
                        {qr.scan_count}/{qr.max_scans}
                    </div>
                    <p className="text-[9px] text-gray-300 font-medium">{new Date(qr.created_at).toLocaleDateString()}</p>
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                    <button onClick={() => { navigator.clipboard.writeText(qr.code); alert('Hash copiado'); }}
                        className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:bg-bezhas-accent hover:text-white transition-colors">
                        <Copy className="w-4 h-4" />
                    </button>
                    {(qr.type === 'tracking' || qr.type === 'contract') && (
                        <a href={`https://explorer.bez.digital/tx/${qr.code}`} target="_blank" rel="noopener noreferrer"
                           className="p-2 rounded-xl bg-blue-50 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors">
                            <Eye className="w-4 h-4" />
                        </a>
                    )}
                    {qr.status === 'active' && (
                        <button onClick={handleRevoke}
                            className="p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-colors">
                            <Ban className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function CreateQRModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [formData, setFormData] = useState({
        type: 'payment',
        maxScans: '1',
        expiresInHours: '720',
        amount: '',
        recipient: '',
        shipmentId: '',
        contractAddr: '',
        contractFn: '',
        tokenId: '',
        customJson: '{\n  "dynamic": true\n}'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        setLoading(true);
        setError('');
        try {
            const payload: QRPayload = {};
            switch (formData.type) {
                case 'payment':
                    if (formData.amount) payload.amount = parseFloat(formData.amount);
                    if (formData.recipient) payload.recipient = formData.recipient;
                    break;
                case 'tracking':
                    payload.shipmentId = formData.shipmentId;
                    payload.onChainSync = true;
                    break;
                case 'contract':
                    payload.contractAddress = formData.contractAddr;
                    payload.function = formData.contractFn;
                    payload.isBridge = true;
                    break;
                case 'nft':
                    payload.tokenId = formData.tokenId;
                    payload.dynamicMetadata = true;
                    break;
                case 'custom':
                    Object.assign(payload, JSON.parse(formData.customJson));
                    break;
            }

            await api.post('/qr', {
                type: formData.type,
                maxScans: parseInt(formData.maxScans, 10),
                expiresInHours: parseInt(formData.expiresInHours, 10),
                data: payload,
            });
            onCreated();
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Error al emitir el código QR');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-bezhas-accent rounded-2xl flex items-center justify-center text-white">
                        <Plus className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 leading-tight">Configurar BeZ-QR</h2>
                        <p className="text-sm text-gray-500 font-medium">Define los parámetros operativos del código</p>
                    </div>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo de Utilidad</label>
                        <select
                            value={formData.type}
                            onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}
                            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-bezhas-accent transition-all"
                        >
                            {Object.entries(QR_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>

                    {formData.type === 'payment' && (
                        <div className="grid grid-cols-1 gap-3 p-4 bg-green-50/30 rounded-3xl border border-green-100/50">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-green-600 uppercase tracking-widest">Monto BEZ</label>
                                <input type="number" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                                    className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold" placeholder="0.00" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-green-600 uppercase tracking-widest">Destinatario (wallet)</label>
                                <input type="text" value={formData.recipient} onChange={e => setFormData(p => ({ ...p, recipient: e.target.value }))}
                                    className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-mono" placeholder="0x..." />
                            </div>
                        </div>
                    )}

                    {formData.type === 'contract' && (
                        <div className="grid grid-cols-1 gap-3 p-4 bg-indigo-50/30 rounded-3xl border border-indigo-100/50">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Dirección Contrato</label>
                                <input type="text" value={formData.contractAddr} onChange={e => setFormData(p => ({ ...p, contractAddr: e.target.value }))}
                                    className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-mono" placeholder="0x..." />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Función (Signature)</label>
                                <input type="text" value={formData.contractFn} onChange={e => setFormData(p => ({ ...p, contractFn: e.target.value }))}
                                    className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-mono" placeholder="transfer(address,uint256)" />
                            </div>
                        </div>
                    )}

                    {formData.type === 'nft' && (
                        <div className="p-4 bg-pink-50/30 rounded-3xl border border-pink-100/50 space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-pink-600 uppercase tracking-widest">Token ID</label>
                                <input type="text" value={formData.tokenId} onChange={e => setFormData(p => ({ ...p, tokenId: e.target.value }))}
                                    className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-black" placeholder="123" />
                            </div>
                            <p className="text-[10px] text-pink-400 font-bold italic text-center">Vinculación automática con metadatos dinámicos</p>
                        </div>
                    )}

                    {formData.type === 'tracking' && (
                        <div className="p-4 bg-blue-50/30 rounded-3xl border border-blue-100/50 space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Shipment ID</label>
                                <input type="text" value={formData.shipmentId} onChange={e => setFormData(p => ({ ...p, shipmentId: e.target.value }))}
                                    className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-black" placeholder="SHIP-001" />
                            </div>
                            <p className="text-[10px] text-blue-400 font-bold text-center">Registrará eventos geolocalizados en el ledger de BeZhas</p>
                        </div>
                    )}

                    {formData.type === 'custom' && (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payload JSON</label>
                            <textarea value={formData.customJson} onChange={e => setFormData(p => ({ ...p, customJson: e.target.value }))}
                                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-xs font-mono h-32 focus:ring-2 focus:ring-bezhas-accent" />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Máx. Escaneos</label>
                            <input type="number" value={formData.maxScans} onChange={e => setFormData(p => ({ ...p, maxScans: e.target.value }))}
                                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm font-bold" min="1" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expira (h)</label>
                            <input type="number" value={formData.expiresInHours} onChange={e => setFormData(p => ({ ...p, expiresInHours: e.target.value }))}
                                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm font-bold" min="1" />
                        </div>
                    </div>
                </div>

                {error && <div className="p-4 bg-red-50 text-red-600 text-[11px] rounded-2xl font-bold border border-red-100">{error}</div>}

                <div className="flex gap-4 pt-4">
                    <button onClick={onClose} className="flex-1 py-4 text-sm font-black text-gray-400 hover:bg-gray-50 rounded-2xl transition-all">Cancelar</button>
                    <button
                        onClick={handleCreate}
                        disabled={loading}
                        className="flex-1 py-4 bg-bezhas-accent text-white text-sm font-black rounded-2xl shadow-xl hover:shadow-2xl disabled:opacity-50 transition-all transform active:scale-95"
                    >
                        {loading ? 'Emitiendo...' : 'Emitir BeZ-QR'}
                    </button>
                </div>
            </div>
        </div>
    );
}
