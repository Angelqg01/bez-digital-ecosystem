'use client';

import { useState, useMemo } from 'react';
import { useDocuments } from '@/lib/hooks';
import { FileText, ShieldCheck, ExternalLink, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function DocumentAssetsPage() {
    const { user, openLoginModal } = useAuth() as any;
    const isGuest = !user;
    const router = useRouter();

    const [page, setPage] = useState(1);
    const { data: realData, isLoading: isDocsLoading } = useDocuments(); // Reusing useDocuments for consistency

    const mockDocuments = useMemo(() => [
        { id: 'doc-token-1', title: 'Certificado de Trazabilidad Luxury Wine', doc_type: 'NFT Prestige', status: 'approved', permissions: { visibility: 'Public' } },
        { id: 'doc-token-2', title: 'Declaración de Customs CargoLink #482', doc_type: 'Cargo Proof Token', status: 'approved', permissions: { visibility: 'Public' } },
        { id: 'doc-token-3', title: 'Audit Log Hash de Seguridad L2', doc_type: 'Security Proof Token', status: 'approved', permissions: { visibility: 'Private' } }
    ], []);

    const data = isGuest ? { documents: mockDocuments } : realData;
    const isLoading = isGuest ? false : isDocsLoading;

    const documents = data?.documents ?? [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mis Activos Digitales</h1>
                    <p className="text-sm text-gray-500 mt-1">Documentos validados y pruebas de existencia (Document Proof Tokens)</p>
                </div>
                <button
                    onClick={() => {
                        if (isGuest) {
                            openLoginModal();
                        } else {
                            router.push('/dashboard/documents');
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-bezhas-accent/10 text-bezhas-accent rounded-lg hover:bg-bezhas-accent/20 transition text-sm font-medium"
                >
                    Validar nuevo <ArrowRight size={14} />
                </button>
            </div>

            {isLoading ? (
                <div className="text-gray-400 text-sm py-8 text-center italic">Sincronizando con la red...</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {documents.map((doc) => (
                            <div key={doc.id} className="group bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-bezhas-accent/10 group-hover:text-bezhas-accent transition-colors">
                                        <FileText size={20} />
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                        #{doc.id.slice(0, 8)}
                                    </span>
                                </div>
                                
                                <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{doc.title}</h3>
                                <p className="text-xs text-gray-500 mb-4">{doc.doc_type}</p>
                                
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-gray-400 uppercase tracking-wider">Estado</span>
                                        <span className={`font-bold uppercase ${doc.status === 'approved' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                            {doc.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-gray-400 uppercase tracking-wider">Visibilidad</span>
                                        <span className="text-gray-700 font-medium">{doc.permissions?.visibility || 'Private'}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            if (isGuest) {
                                                openLoginModal();
                                            } else {
                                                router.push('/dashboard/documents');
                                            }
                                        }}
                                        className="flex-1 text-[11px] py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors"
                                    >
                                        Gestionar
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (isGuest) {
                                                openLoginModal();
                                            } else {
                                                router.push(`/dashboard/documents?id=${doc.id}`);
                                            }
                                        }}
                                        className="p-2 border border-gray-100 rounded-lg text-gray-400 hover:text-bezhas-accent hover:border-bezhas-accent/30 transition-all"
                                    >
                                        <ExternalLink size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {documents.length === 0 && (
                        <div className="bg-gray-50 rounded-2xl py-12 text-center border-2 border-dashed border-gray-100">
                            <ShieldCheck className="mx-auto text-gray-200 mb-3" size={40} />
                            <p className="text-gray-400 text-sm">No tienes documentos validados aún.</p>
                            <Link href="/dashboard/documents" className="text-bezhas-accent text-xs font-bold mt-2 inline-block hover:underline">
                                Comienza validando tu primer documento
                            </Link>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
