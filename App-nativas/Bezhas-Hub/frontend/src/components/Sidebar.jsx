import { Wallet, Package, Building2 } from 'lucide-react';
import { useAccount } from 'wagmi';

const Sidebar = ({ sidebarOpen, setSidebarOpen, logisticsBalance = 0, realEstateBalance = 0 }) => {
    const { address } = useAccount();

    return (
        <>
            {/* ...existing sidebar code... */}
            {/* Balance Web3 del usuario */}
            <div className="mt-8 mb-4 px-3">
                <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-4 flex items-center gap-3 mb-2">
                    <Package className="text-blue-400" />
                    <span className="text-white font-bold">Logística:</span>
                    <span className="text-blue-200 font-mono">{logisticsBalance}</span>
                </div>
                <div className="bg-gradient-to-r from-amber-900 to-yellow-700 rounded-xl p-4 flex items-center gap-3">
                    <Building2 className="text-amber-400" />
                    <span className="text-white font-bold">Real Estate:</span>
                    <span className="text-amber-200 font-mono">{realEstateBalance}</span>
                </div>
            </div>
            {/* ...resto del sidebar... */}
        </>
    );
};

export default Sidebar;