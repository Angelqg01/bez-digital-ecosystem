'use client';

import { useParams } from 'next/navigation';
import { useSectorDetail } from '@/lib/hooks';
import { SECTOR_META } from '@/lib/types';
import type { DeployedContract, Transaction } from '@/lib/types';
import DataTable from '@/components/DataTable';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SectorDetailPage() {
    const params = useParams() ?? {};
    const sector = (params.sector ?? '') as string;
    const { data, isLoading } = useSectorDetail(sector);
    const meta = SECTOR_META[sector] || { name: sector, icon: '📁', color: 'gray' };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/sectors" className="text-gray-400 hover:text-gray-600 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <span className="text-3xl">{meta.icon}</span>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{meta.name}</h1>
                    <p className="text-sm text-gray-500">Sector: {sector}</p>
                </div>
            </div>

            {isLoading ? (
                <div className="text-gray-400 text-sm py-8 text-center">Cargando datos del sector...</div>
            ) : (
                <>
                    {/* Contracts Table */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Contratos Desplegados</h3>
                        <DataTable<DeployedContract>
                            columns={[
                                { key: 'contract_name', label: 'Contrato' },
                                {
                                    key: 'address', label: 'Direccion', render: (r) => (
                                        <span className="font-mono text-xs text-bezhas-accent">{r.address?.slice(0, 14)}...</span>
                                    )
                                },
                                { key: 'chain_id', label: 'Chain' },
                                {
                                    key: 'deployed_at', label: 'Fecha', render: (r) => (
                                        <span className="text-xs">{r.deployed_at ? new Date(r.deployed_at).toLocaleDateString() : '-'}</span>
                                    )
                                },
                            ]}
                            data={data?.contracts ?? []}
                            emptyMessage="No hay contratos desplegados para este sector"
                        />
                    </div>

                    {/* Transactions Table */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Transacciones del Sector</h3>
                        <DataTable<Transaction>
                            columns={[
                                {
                                    key: 'tx_hash', label: 'Hash', render: (r) => (
                                        <span className="font-mono text-xs text-bezhas-accent">{r.tx_hash?.slice(0, 14)}...</span>
                                    )
                                },
                                { key: 'contract_name', label: 'Contrato' },
                                { key: 'method', label: 'Metodo' },
                                {
                                    key: 'status', label: 'Estado', render: (r) => (
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                            r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>{r.status}</span>
                                    )
                                },
                                { key: 'block_number', label: 'Bloque' },
                            ]}
                            data={data?.transactions ?? []}
                            emptyMessage="No hay transacciones para este sector"
                        />
                    </div>
                </>
            )}
        </div>
    );
}
