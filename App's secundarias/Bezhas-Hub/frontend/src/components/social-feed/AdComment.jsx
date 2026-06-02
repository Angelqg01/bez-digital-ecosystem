import React, { useState } from 'react';
import { ExternalLink, DollarSign } from 'lucide-react';

const AdComment = ({ onAdClick }) => {
    const [clicked, setClicked] = useState(false);

    const handleClick = () => {
        if (!clicked) {
            setClicked(true);
            // Simulamos un valor aleatorio entre 10 y 20 centavos
            const revenue = (Math.random() * (0.20 - 0.10) + 0.10).toFixed(2);
            onAdClick(revenue);
        }
    };

    return (
        <div className="my-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-100 dark:border-blue-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg font-bold">
                PUBLICIDAD
            </div>

            <div className="flex gap-3 items-start">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-500">AD</span>
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Crypto Exchange Pro
                        <ExternalLink size={12} className="text-gray-400" />
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        ¡Opera con las comisiones más bajas del mercado! Regístrate hoy y obtén 100 tokens gratis.
                    </p>

                    <button
                        onClick={handleClick}
                        disabled={clicked}
                        className={`mt-2 text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1 ${clicked
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                            }`}
                    >
                        {clicked ? (
                            <>
                                <DollarSign size={12} />
                                <span>Recompensa generada</span>
                            </>
                        ) : (
                            'Visitar Sitio'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdComment;
