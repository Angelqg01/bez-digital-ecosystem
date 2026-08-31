import React from 'react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { ArrowRight, Shield, Zap, Globe, Users, Coins, Layout } from 'lucide-react';

const LandingHero = () => {
    const { open } = useWeb3Modal();

    const features = [
        {
            icon: <Users className="w-6 h-6 text-purple-400" />,
            title: "Social Web3",
            description: "Conecta, comparte y monetiza tu contenido sin intermediarios."
        },
        {
            icon: <Coins className="w-6 h-6 text-pink-400" />,
            title: "DeFi Integrado",
            description: "Staking, Farming y Recompensas integradas en tu experiencia social."
        },
        {
            icon: <Shield className="w-6 h-6 text-cyan-400" />,
            title: "Identidad Soberana",
            description: "Tus datos, tu perfil y tu reputación te pertenecen al 100%."
        }
    ];

    return (
        <div className="min-h-screen bg-[#0A0E1A] text-white overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-600/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative container mx-auto px-6 pt-20 pb-12">
                {/* Hero Content */}
                <div className="text-center max-w-4xl mx-auto mb-20">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-sm font-medium text-gray-300">Web3 Social Network Live</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-pink-200 leading-tight">
                        El Futuro Social es <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Descentralizado</span>
                    </h1>

                    <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed text-center">
                        Impulsa tu empresa con la potencia de la Web3. <strong>BeZhas</strong> ofrece una suite integral para la gestión descentralizada: tokenización de activos reales, validación inmutable en blockchain y acceso a financiación global. Potencia tu capital con nuestro sistema de <strong>Staking</strong> de alto rendimiento, participa en la gobernanza a través de nuestra <strong>DAO</strong> y descubre cómo el token <strong>BEZ</strong> revoluciona la economía digital corporativa.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => open()}
                            className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-purple-500/25 flex items-center gap-2"
                        >
                            <Zap className="w-5 h-5" />
                            Conectar Wallet
                        </button>
                        <button className="px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-lg transition-all flex items-center gap-2">
                            Explorar Demo
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {features.map((feature, index) => (
                        <div key={index} className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all hover:bg-white/[0.07] group">
                            <div className="mb-6 p-4 rounded-xl bg-white/5 w-fit group-hover:scale-110 transition-transform duration-300">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
                            <p className="text-gray-400 leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Stats Section */}
                <div className="mt-20 border-t border-white/10 pt-12">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {[
                            { label: "Usuarios Activos", value: "10K+" },
                            { label: "Transacciones", value: "1M+" },
                            { label: "NFTs Creados", value: "50K+" },
                            { label: "Recompensas", value: "$2M+" }
                        ].map((stat, index) => (
                            <div key={index}>
                                <div className="text-3xl md:text-4xl font-bold text-white mb-2">{stat.value}</div>
                                <div className="text-sm text-gray-500 uppercase tracking-wider">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingHero;
