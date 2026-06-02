'use client';

import { useGasBalances } from '@/lib/hooks';
import StatCard from '@/components/StatCard';
import { Fuel, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useMemo } from 'react';

export default function GasPage() {
    const { user } = useAuth() as any;
    const isGuest = !user;

    const { data: realBalances, isLoading: isBalancesLoading } = useGasBalances();

    const mockBalances = useMemo(() => [
        { enterprise_name: 'BZ Logistics L2', enterprise_id: 1, balance_bez: 1250.4500, wallet_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', updated_at: new Date(Date.now() - 3600000).toISOString() },
        { enterprise_name: 'BZ Prestige Retail', enterprise_id: 2, balance_bez: 0.8500, wallet_address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', updated_at: new Date(Date.now() - 7200000).toISOString() },
        { enterprise_name: 'BZ CargoLink Tracking', enterprise_id: 3, balance_bez: 540.2000, wallet_address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', updated_at: new Date().toISOString() }
    ], []);

    const balances = isGuest ? mockBalances : realBalances;
    const isLoading = isGuest ? false : isBalancesLoading;

    const totalBEZ = balances?.reduce((sum, b) => sum + b.balance_bez, 0) ?? 0;
    const lowTanks = balances?.filter(b => b.balance_bez < 1.0) ?? [];


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Gas Tanks</h1>
                <p className="text-sm text-gray-500 mt-1">Monitoreo de tanques de gas corporativos (BEZ)</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Balance Total" value={`${totalBEZ.toFixed(2)} BEZ`} icon={<Fuel className="w-5 h-5" />} />
                <StatCard label="Tanques Activos" value={isLoading ? '...' : (balances?.length ?? 0)} />
                <StatCard
                    label="Tanques Bajos"
                    value={lowTanks.length}
                    sub={lowTanks.length > 0 ? 'Requieren recarga' : 'Todos OK'}
                    icon={<AlertTriangle className={`w-5 h-5 ${lowTanks.length > 0 ? 'text-orange-500' : ''}`} />}
                />
            </div>

            {isLoading ? (
                <div className="text-gray-400 text-sm py-8 text-center">Cargando tanques de gas...</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(balances ?? []).map((b, i) => (
                        <div key={i} className={`bg-white rounded-xl border p-5 shadow-sm ${b.balance_bez < 1.0 ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100'
                            }`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-gray-900 text-sm">{b.enterprise_name || `Enterprise #${b.enterprise_id}`}</h3>
                                {b.balance_bez < 1.0 && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                            </div>
                            <div className="text-3xl font-bold text-gray-900 mb-1">
                                {b.balance_bez.toFixed(4)} <span className="text-sm text-gray-400 font-normal">BEZ</span>
                            </div>
                            <div className="text-xs text-gray-500 font-mono">{b.wallet_address?.slice(0, 18)}...</div>
                            <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                    className={`h-1.5 rounded-full ${b.balance_bez < 1.0 ? 'bg-orange-400' : 'bg-bezhas-accent'}`}
                                    style={{ width: `${Math.min(100, (b.balance_bez / 100) * 100)}%` }}
                                />
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">
                                Actualizado: {b.updated_at ? new Date(b.updated_at).toLocaleString() : '-'}
                            </div>
                        </div>
                    ))}
                    {(balances ?? []).length === 0 && (
                        <div className="col-span-full text-gray-400 text-sm py-8 text-center">No hay tanques de gas registrados</div>
                    )}
                </div>
            )}
        </div>
    );
}
