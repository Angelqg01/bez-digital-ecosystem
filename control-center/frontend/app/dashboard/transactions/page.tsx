'use client';

import { useState } from 'react';
import { useTransactions } from '@/lib/hooks';
import DataTable from '@/components/DataTable';
import type { Transaction } from '@/lib/types';

export default function TransactionsPage() {
    const [page, setPage] = useState(1);
    const { data, isLoading } = useTransactions(page, 20);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Transacciones</h1>
                <p className="text-sm text-gray-500 mt-1">Historial completo de transacciones on-chain</p>
            </div>

            {isLoading ? (
                <div className="text-gray-400 text-sm py-8 text-center">Cargando transacciones...</div>
            ) : (
                <>
                    <DataTable<Transaction>
                        columns={[
                            {
                                key: 'tx_hash', label: 'Hash', render: (r) => (
                                    <span className="font-mono text-xs text-bezhas-accent">{r.tx_hash?.slice(0, 18)}...</span>
                                )
                            },
                            { key: 'contract_name', label: 'Contrato' },
                            { key: 'method', label: 'Metodo' },
                            {
                                key: 'from_address', label: 'Desde', render: (r) => (
                                    <span className="font-mono text-xs">{r.from_address?.slice(0, 10)}...</span>
                                )
                            },
                            {
                                key: 'status', label: 'Estado', render: (r) => (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                            r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                        }`}>{r.status}</span>
                                )
                            },
                            { key: 'gas_used', label: 'Gas' },
                            { key: 'block_number', label: 'Bloque' },
                            {
                                key: 'created_at', label: 'Fecha', render: (r) => (
                                    <span className="text-xs">{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</span>
                                )
                            },
                        ]}
                        data={data?.rows ?? []}
                    />

                    {/* Pagination */}
                    {data && data.total > 20 && (
                        <div className="flex justify-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                            >
                                Anterior
                            </button>
                            <span className="px-3 py-1.5 text-sm text-gray-500">
                                Pagina {page} de {Math.ceil(data.total / 20)}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= Math.ceil(data.total / 20)}
                                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
