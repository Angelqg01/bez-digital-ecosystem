import { useState, useEffect } from 'react';
import {
    Box, ShoppingBag, Hexagon, ShieldCheck, Cpu
} from 'lucide-react';

const LogoScroll = () => {
    const logos = [
        { name: 'MAERSK', icon: Box, color: 'text-purple-500' },
        { name: 'SHOPIFY', icon: ShoppingBag, color: 'text-green-500' },
        { name: 'POLYGON', icon: Hexagon, color: 'text-blue-500' },
        { name: 'CHAINLINK', icon: ShieldCheck, color: 'text-blue-400' },
        { name: 'OPENAI', icon: Cpu, color: 'text-red-500' },
    ];

    return (
        <section className="py-10 border-y border-white/5 bg-black/40 backdrop-blur-sm overflow-hidden relative z-10">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#010105] to-transparent z-10"></div>
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#010105] to-transparent z-10"></div>

            <div className="flex gap-16 items-center opacity-70 hover:opacity-100 transition-opacity duration-500 animate-scroll">
                {/* Primera instancia */}
                {logos.map((logo, idx) => (
                    <div key={`first-${idx}`} className="flex items-center gap-2 text-xl font-display font-bold text-white whitespace-nowrap">
                        <logo.icon className={`w-6 h-6 ${logo.color}`} />
                        {logo.name}
                    </div>
                ))}

                {/* Segunda instancia para loop infinito */}
                {logos.map((logo, idx) => (
                    <div key={`second-${idx}`} className="flex items-center gap-2 text-xl font-display font-bold text-white whitespace-nowrap">
                        <logo.icon className={`w-6 h-6 ${logo.color}`} />
                        {logo.name}
                    </div>
                ))}
            </div>

            <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        
        .animate-scroll {
          display: flex;
          animation: scroll 20s linear infinite;
          width: max-content;
        }
      `}</style>
        </section>
    );
};

export default LogoScroll;
