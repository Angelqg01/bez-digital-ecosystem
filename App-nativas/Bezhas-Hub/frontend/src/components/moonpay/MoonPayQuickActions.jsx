import React, { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import MoonPayModal from './MoonPayModal';

/**
 * MoonPay Quick Actions Component
 * Quick access buttons for buying/selling crypto
 */
const MoonPayQuickActions = ({ className = '' }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('buy');

    const handleOpenBuy = () => {
        setModalMode('buy');
        setIsModalOpen(true);
    };

    const handleOpenSell = () => {
        setModalMode('sell');
        setIsModalOpen(true);
    };

    return (
        <>
            <div className={`flex gap-3 ${className}`}>
                {/* Buy Button */}
                <button
                    onClick={handleOpenBuy}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-green-500/50"
                >
                    <TrendingUp size={20} />
                    <span>Comprar Crypto</span>
                </button>

                {/* Sell Button */}
                <button
                    onClick={handleOpenSell}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-orange-500/50"
                >
                    <TrendingDown size={20} />
                    <span>Vender Crypto</span>
                </button>
            </div>

            {/* Modal */}
            <MoonPayModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                mode={modalMode}
            />
        </>
    );
};

export default MoonPayQuickActions;
