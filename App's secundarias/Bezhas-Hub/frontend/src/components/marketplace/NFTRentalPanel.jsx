import React, { useState } from 'react';
import { FaCalendarAlt, FaClock, FaDollarSign, FaShieldAlt, FaKey, FaBox } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

const NFTRentalPanel = () => {
    const [activeTab, setActiveTab] = useState('browse');
    const [rentals, setRentals] = useState([
        {
            id: 1,
            name: 'Gaming Avatar #789',
            image: 'https://picsum.photos/seed/rent1/300',
            pricePerDay: '0.05',
            minDays: 1,
            maxDays: 30,
            collateral: '0.5',
            owner: '0xabcd...efgh'
        }
    ]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    NFT Rental Marketplace
                </h1>
                <p className="text-gray-400 mb-8">Alquila NFTs por tiempo limitado</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rentals.map((rental) => (
                        <div key={rental.id} className="bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700">
                            <img src={rental.image} alt={rental.name} className="w-full h-48 object-cover" />
                            <div className="p-4 space-y-3">
                                <h4 className="font-bold">{rental.name}</h4>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400 flex items-center gap-1">
                                        <FaDollarSign className="w-4 h-4" />
                                        Precio/Día:
                                    </span>
                                    <span className="font-bold">{rental.pricePerDay} ETH</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400 flex items-center gap-1">
                                        <FaCalendarAlt className="w-4 h-4" />
                                        Período:
                                    </span>
                                    <span>{rental.minDays}-{rental.maxDays} días</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400 flex items-center gap-1">
                                        <FaShieldAlt className="w-4 h-4" />
                                        Colateral:
                                    </span>
                                    <span className="font-bold text-yellow-400">{rental.collateral} ETH</span>
                                </div>
                                <button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2">
                                    <FaKey className="w-4 h-4" />
                                    Rentar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NFTRentalPanel;
