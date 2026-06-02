import React from 'react';
import { Crown, Sparkles } from 'lucide-react';

export default function VIPTierSelector({ currentTier, onTierChange }) {
    const tiers = [
        {
            id: 0,
            name: 'Estándar',
            months: 0,
            multiplier: '100%',
            price: 'Gratis',
            color: 'gray',
            gradient: 'from-gray-500 to-gray-600',
            borderColor: 'border-gray-600'
        },
        {
            id: 1,
            name: 'VIP Bronze',
            months: 1,
            multiplier: '150%',
            price: '$9.99',
            color: 'orange',
            gradient: 'from-orange-500 to-orange-600',
            borderColor: 'border-orange-500'
        },
        {
            id: 3,
            name: 'VIP Silver',
            months: 3,
            multiplier: '200%',
            price: '$24.99',
            color: 'blue',
            gradient: 'from-blue-500 to-blue-600',
            borderColor: 'border-blue-500'
        },
        {
            id: 6,
            name: 'VIP Gold',
            months: 6,
            multiplier: '250%',
            price: '$44.99',
            color: 'yellow',
            gradient: 'from-yellow-500 to-yellow-600',
            borderColor: 'border-yellow-500'
        },
        {
            id: 9,
            name: 'VIP Diamond',
            months: 9,
            multiplier: '300%',
            price: '$59.99',
            color: 'purple',
            gradient: 'from-purple-500 to-pink-500',
            borderColor: 'border-purple-500'
        }
    ];

    return (
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-700/50">
                <Crown className="w-6 h-6 text-yellow-400" />
                <div>
                    <h2 className="text-xl font-bold text-white">Nivel VIP</h2>
                    <p className="text-sm text-gray-400">Selecciona tu membresía</p>
                </div>
            </div>

            {/* Tiers Grid */}
            <div className="space-y-3">
                {tiers.map((tier) => (
                    <button
                        key={tier.id}
                        onClick={() => onTierChange(tier.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 ${currentTier === tier.id
                                ? `${tier.borderColor} bg-gradient-to-r ${tier.gradient} bg-opacity-20 shadow-lg`
                                : 'border-gray-700/50 bg-gray-900/30 hover:border-gray-600'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {tier.id > 0 && <Crown className={`w-5 h-5 text-${tier.color}-400`} />}
                                {tier.id === 0 && <Sparkles className="w-5 h-5 text-gray-400" />}
                                <div>
                                    <h3 className="font-bold text-white">{tier.name}</h3>
                                    <p className="text-xs text-gray-400">
                                        {tier.months > 0 ? `${tier.months} ${tier.months === 1 ? 'Mes' : 'Meses'}` : 'Gratis para siempre'}
                                    </p>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className={`text-2xl font-bold text-${tier.color}-400`}>
                                    {tier.multiplier}
                                </p>
                                <p className="text-xs text-gray-400">{tier.price}</p>
                            </div>
                        </div>

                        {currentTier === tier.id && (
                            <div className="mt-3 pt-3 border-t border-gray-700/50">
                                <p className="text-xs text-gray-300">✓ Seleccionado actualmente</p>
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* Info adicional */}
            <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <p className="text-sm text-blue-300 mb-2 font-semibold">
                    ℹ️ ¿Cómo funciona el multiplicador VIP?
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                    El multiplicador VIP se aplica sobre tus recompensas diarias después de
                    aplicar el multiplicador de nivel y el bonus por racha. Por ejemplo,
                    con VIP Diamond (300%) obtienes 3x más tokens que un usuario estándar.
                </p>
            </div>
        </div>
    );
}
