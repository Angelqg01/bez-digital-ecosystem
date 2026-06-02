'use client';

import { useDocuments, useDocumentStats } from '@/lib/hooks';
import { api } from '@/lib/api';
import { useState } from 'react';
import { FileText, Plus, CheckCircle2, XCircle, Clock, Shield, AlertTriangle, FileSearch, Eye, EyeOff, Globe, Lock, Share2 } from 'lucide-react';
import { useSWRConfig } from 'swr';
import type { Document as DocType } from '@/lib/types';

const DOC_TYPE_LABELS: Record<string, string> = {
    invoice: 'Factura',
    bill_of_lading: 'Conocimiento de Embarque',
    certificate_of_origin: 'Certificado de Origen',
    customs_declaration: 'Declaración Aduanera',
    inspection_report: 'Reporte de Inspección',
    insurance_certificate: 'Certificado de Seguro',
    packing_list: 'Lista de Empaque',
    contract: 'Contrato',
    other: 'Otro',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; classes: string }> = {
    pending: { label: 'Pendiente', icon: <Clock className="w-3.5 h-3.5" />, classes: 'bg-yellow-50 text-yellow-700' },
    validating: { label: 'Validando', icon: <FileSearch className="w-3.5 h-3.5" />, classes: 'bg-blue-50 text-blue-700' },
    approved: { label: 'Aprobado', icon: <CheckCircle2 className="w-3.5 h-3.5" />, classes: 'bg-green-50 text-green-700' },
    rejected: { label: 'Rechazado', icon: <XCircle className="w-3.5 h-3.5" />, classes: 'bg-red-50 text-red-700' },
    expired: { label: 'Expirado', icon: <AlertTriangle className="w-3.5 h-3.5" />, classes: 'bg-gray-50 text-gray-500' },
    revoked: { label: 'Revocado', icon: <XCircle className="w-3.5 h-3.5" />, classes: 'bg-red-50 text-red-600' },
};

export default function DocumentsPage() {
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const { data, isLoading } = useDocuments(typeFilter, statusFilter);
    const { data: statsData } = useDocumentStats();
    const { mutate } = useSWRConfig();
    const [showUpload, setShowUpload] = useState(false);
    const [verifyHash, setVerifyHash] = useState('');
    const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);

    const documents = data?.documents ?? [];
    const stats = statsData?.stats ?? [];

    const totalDocs = stats.reduce((s, r) => s + r.total, 0);
    const totalApproved = stats.reduce((s, r) => s + r.approved, 0);
    const totalPending = stats.reduce((s, r) => s + r.pending, 0);
    const totalRejected = stats.reduce((s, r) => s + r.rejected, 0);

    async function handleVerify() {
        if (!verifyHash) return;
        try {
            const result = await api.get<Record<string, unknown>>(`/documents/verify/${verifyHash}`);
            setVerifyResult(result);
        } catch {
            setVerifyResult({ verified: false, error: 'Documento no encontrado' });
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="w-7 h-7 text-bezhas-accent" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Validación Documental</h1>
                        <p className="text-sm text-gray-500">Registra, valida y firma documentos con blockchain</p>
                    </div>
                </div>
                <button onClick={() => setShowUpload(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-bezhas-accent text-white rounded-lg hover:bg-bezhas-accent/90 transition text-sm font-medium">
                    <Plus className="w-4 h-4" /> Registrar Documento
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatBox label="Total Documentos" value={totalDocs} />
                <StatBox label="Aprobados" value={totalApproved} color="text-green-600" />
                <StatBox label="Pendientes" value={totalPending} color="text-yellow-600" />
                <StatBox label="Rechazados" value={totalRejected} color="text-red-600" />
            </div>

            {/* Verify Section */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Verificar Documento por Hash</h3>
                <div className="flex gap-2">
                    <input type="text" value={verifyHash} onChange={e => setVerifyHash(e.target.value)}
                        placeholder="0x... (SHA-256 hash del archivo)"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
                    <button onClick={handleVerify}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800">
                        Verificar
                    </button>
                </div>
                {verifyResult && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${verifyResult.verified ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {verifyResult.verified
                            ? `✓ Documento verificado — Estado: ${verifyResult.status} | TX: ${String(verifyResult.txHash || 'N/A').slice(0, 18)}...`
                            : `✗ ${verifyResult.error || 'Documento no verificado'}`
                        }
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex gap-3">
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                    <option value="">Todos los tipos</option>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                    <option value="">Todos los estados</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
            </div>

            {/* Document Table */}
            {isLoading ? (
                <div className="text-gray-400 text-sm py-8 text-center">Cargando documentos...</div>
            ) : documents.length === 0 ? (
                <div className="text-gray-400 text-sm py-16 text-center">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    No hay documentos registrados
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="text-left px-4 py-3">Documento</th>
                                <th className="text-left px-4 py-3">Tipo</th>
                                <th className="text-left px-4 py-3">Estado</th>
                                <th className="text-left px-4 py-3">Firmas</th>
                                <th className="text-left px-4 py-3">AI</th>
                                <th className="text-left px-4 py-3">Fecha</th>
                                <th className="text-right px-4 py-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {documents.map(doc => (
                                <DocumentRow key={doc.id} doc={doc} onAction={() => {
                                    mutate((key: string) => typeof key === 'string' && key.startsWith('/documents'));
                                }} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && <UploadModal onClose={() => { setShowUpload(false); mutate((key: string) => typeof key === 'string' && key.startsWith('/documents')); }} />}
        </div>
    );
}

function StatBox({ label, value, color = 'text-gray-900' }: { label: string; value: number; color?: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
    );
}

function DocumentRow({ doc, onAction }: { doc: DocType; onAction: () => void }) {
    const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;

    async function handleApprove() {
        await api.post(`/documents/${doc.id}/approve`, {});
        onAction();
    }

    async function handleReject() {
        const reason = prompt('Razón de rechazo:');
        if (!reason) return;
        await api.post(`/documents/${doc.id}/reject`, { reason });
        onAction();
    }

    async function handleGenerateQR() {
        await api.post(`/documents/${doc.id}/qr`, { maxScans: 100 });
        onAction();
    }

    return (
        <tr className="hover:bg-gray-50/50">
            <td className="px-4 py-3">
                <p className="font-medium text-gray-900">{doc.title}</p>
                <p className="text-xs text-gray-400 font-mono truncate max-w-[200px]">{doc.file_hash.slice(0, 18)}...</p>
            </td>
            <td className="px-4 py-3 text-gray-600">{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</td>
            <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.classes}`}>
                    {statusCfg.icon} {statusCfg.label}
                </span>
            </td>
            <td className="px-4 py-3 text-gray-600">{doc.signature_count}</td>
            <td className="px-4 py-3">
                {doc.ai_confidence != null ? (
                    <span className={`text-xs font-medium ${doc.ai_confidence > 0.7 ? 'text-green-600' : doc.ai_confidence > 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {(doc.ai_confidence * 100).toFixed(0)}%
                    </span>
                ) : <span className="text-xs text-gray-300">—</span>}
            </td>
            <td className="px-4 py-3 text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</td>
            <td className="px-4 py-3 text-right">
                <div className="flex gap-1 justify-end">
                    {(doc.status === 'pending' || doc.status === 'validating') && (
                        <>
                            <button onClick={handleApprove} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Aprobar</button>
                            <button onClick={handleReject} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Rechazar</button>
                        </>
                    )}
                    {doc.status === 'approved' && !doc.qr_code_id && (
                        <button onClick={handleGenerateQR} className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100">Generar QR</button>
                    )}
                </div>
            </td>
        </tr>
    );
}

function UploadModal({ onClose }: { onClose: () => void }) {
    const [docType, setDocType] = useState('invoice');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [fileHash, setFileHash] = useState('');
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Marketplace & Permissions State
    const [visibility, setVisibility] = useState<'private' | 'shared' | 'public'>('private');
    const [listable, setListable] = useState(false);
    const [price, setPrice] = useState('0');
    const [rentEnabled, setRentEnabled] = useState(false);
    const [rentPrice, setRentPrice] = useState('0');

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);

        // Compute SHA-256 hash client-side
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        setFileHash(hashHex);
    }

    async function handleSubmit() {
        if (!title || !fileHash || !fileName) {
            setError('Título y archivo son requeridos');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await api.post('/documents', {
                docType,
                title,
                description: description || undefined,
                fileHash,
                fileName,
                permissions: {
                    visibility,
                    listable,
                    sale_enabled: listable,
                    rent_enabled: rentEnabled,
                    price: price || '0',
                    rental_terms: rentEnabled ? {
                        duration_days: 30,
                        price_per_day: rentPrice
                    } : undefined,
                    allowed_addresses: [] // To be implemented with a tags input
                }
            });
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al registrar documento');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Registrar Documento</h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Tipo de Documento</label>
                        <select value={docType} onChange={e => setDocType(e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Título</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            placeholder="Factura #12345" />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Descripción (opcional)</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            rows={2} placeholder="Detalles adicionales" />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Archivo</label>
                        <input type="file" onChange={handleFileSelect}
                            className="mt-1 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-bezhas-accent/10 file:text-bezhas-accent hover:file:bg-bezhas-accent/20" />
                        {fileHash && (
                            <p className="text-xs font-mono text-gray-400 mt-1 truncate">Hash: {fileHash}</p>
                        )}
                    </div>

                    {/* Permissions & Marketplace */}
                    <div className="pt-4 border-t border-gray-100">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Permisos y Mercado</h3>
                        
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <button onClick={() => setVisibility('private')}
                                className={`flex flex-col items-center p-2 rounded-xl border text-[10px] gap-1 transition-colors ${visibility === 'private' ? 'bg-bezhas-accent/10 border-bezhas-accent text-bezhas-accent' : 'border-gray-100 text-gray-500'}`}>
                                <Lock size={16} /> Privado
                            </button>
                            <button onClick={() => setVisibility('shared')}
                                className={`flex flex-col items-center p-2 rounded-xl border text-[10px] gap-1 transition-colors ${visibility === 'shared' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-100 text-gray-500'}`}>
                                <Share2 size={16} /> Compartido
                            </button>
                            <button onClick={() => setVisibility('public')}
                                className={`flex flex-col items-center p-2 rounded-xl border text-[10px] gap-1 transition-colors ${visibility === 'public' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-gray-100 text-gray-500'}`}>
                                <Globe size={16} /> Público
                            </button>
                        </div>

                        <div className="space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={listable} onChange={e => setListable(e.target.checked)} 
                                    className="rounded border-gray-300 text-bezhas-accent focus:ring-bezhas-accent" />
                                <span className="text-sm text-gray-700">Listar en el mercado para venta</span>
                            </label>

                            {listable && (
                                <div className="pl-6 animate-in slide-in-from-top-2 duration-200">
                                    <label className="text-xs font-medium text-gray-500">Precio de Venta ($BEZ)</label>
                                    <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                                        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                                </div>
                            )}

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={rentEnabled} onChange={e => setRentEnabled(e.target.checked)} 
                                    className="rounded border-gray-300 text-bezhas-accent focus:ring-bezhas-accent" />
                                <span className="text-sm text-gray-700">Habilitar alquiler temporal</span>
                            </label>

                            {rentEnabled && (
                                <div className="pl-6 animate-in slide-in-from-top-2 duration-200">
                                    <label className="text-xs font-medium text-gray-500">Precio por día ($BEZ)</label>
                                    <input type="number" value={rentPrice} onChange={e => setRentPrice(e.target.value)}
                                        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                                </div>
                            )}
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button onClick={handleSubmit} disabled={loading}
                            className="flex-1 px-4 py-2 text-sm bg-bezhas-accent text-white rounded-lg hover:bg-bezhas-accent/90 disabled:opacity-50">
                            {loading ? 'Registrando...' : 'Registrar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
