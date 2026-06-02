'use client';

import Link from 'next/link';
import { useSectors } from '@/lib/hooks';
import { SECTOR_META } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useMemo } from 'react';

export default function SectorsPage() {
    const { user } = useAuth() as any;
    const isGuest = !user;

    const { data: realSectors, isLoading: isSectorsLoading } = useSectors();

    const mockSectors = useMemo(() => [
        { key: 'logistics', contracts: 6, transactions: 1540, active: true },
        { key: 'retail', contracts: 4, transactions: 840, active: true },
        { key: 'finance', contracts: 8, transactions: 2450, active: true },
        { key: 'energy', contracts: 3, transactions: 340, active: true },
        { key: 'healthcare', contracts: 5, transactions: 920, active: true },
        { key: 'realestate', contracts: 4, transactions: 610, active: true },
        { key: 'telecom', contracts: 5, transactions: 1120, active: true },
        { key: 'media', contracts: 3, transactions: 430, active: true },
        { key: 'agriculture', contracts: 4, transactions: 510, active: true },
        { key: 'manufacturing', contracts: 6, transactions: 1340, active: true },
        { key: 'education', contracts: 3, transactions: 210, active: false },
        { key: 'hospitality', contracts: 4, transactions: 310, active: false },
        { key: 'automotive', contracts: 5, transactions: 890, active: true },
        { key: 'construction', contracts: 3, transactions: 150, active: false },
        { key: 'aerospace', contracts: 4, transactions: 410, active: true },
        { key: 'government', contracts: 6, transactions: 980, active: true }
    ], []);

    const sectors = isGuest ? mockSectors : realSectors;
    const isLoading = isGuest ? false : isSectorsLoading;

    // Fallback: show all 16 sectors from SECTOR_META even if API is down
    const sectorKeys = sectors?.map(s => s.key) ?? Object.keys(SECTOR_META);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Sectores</h1>
                <p className="text-sm text-gray-500 mt-1">16 sectores industriales con contratos inteligentes dedicados</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sectorKeys.map(key => {
                    const meta = SECTOR_META[key] || { name: key, icon: '📁', color: 'gray' };
                    const sectorData = sectors?.find(s => s.key === key);

                    return (
                        <Link
                            key={key}
                            href={`/dashboard/sectors/${key}`}
                            className="group bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-bezhas-accent/30 transition-all"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">{meta.icon}</span>
                                <h3 className="font-semibold text-gray-900 group-hover:text-bezhas-accent transition-colors">
                                    {meta.name}
                                </h3>
                            </div>
                            <div className="flex gap-4 text-xs text-gray-500">
                                <span>{sectorData?.contracts ?? 4} contratos</span>
                                <span>{isLoading ? '...' : (sectorData?.transactions ?? 0)} txs</span>
                            </div>
                            {sectorData?.active !== undefined && (
                                <div className="mt-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sectorData.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {sectorData.active ? 'Activo' : 'Pendiente'}
                                    </span>
                                </div>
                            )}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
