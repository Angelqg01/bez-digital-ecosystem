import React, { useState } from 'react';
import { StatCard } from '../components/quality-oracle/StatCard';
import { ServiceTable } from '../components/quality-oracle/ServiceTable';
import Sidebar from '../components/Sidebar';

const QualityOracleDashboard = () => {
    // Mock data - replace with Web3 hook
    const [services] = useState([
        { id: 1, clientWallet: '0x123...', status: 'IN_PROGRESS', amount: '1000' },
        { id: 2, clientWallet: '0x456...', status: 'COMPLETED', amount: '500' },
    ]);

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 p-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Quality Oracle Dashboard</h1>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <StatCard title="Active Services" value="12" icon="⚙️" trend={5} />
                        <StatCard title="Total Value Locked" value="50k BZH" icon="🔒" trend={12} />
                        <StatCard title="Disputes" value="0" icon="⚖️" />
                    </div>

                    <div className="mt-8">
                        <h2 className="text-xl font-semibold mb-4">Recent Escrows</h2>
                        <ServiceTable services={services} onFinalize={(id) => console.log(id)} />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default QualityOracleDashboard;
