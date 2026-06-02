import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Code, FileText, GraduationCap, Shield, Cpu, Globe } from 'lucide-react';

const DocsHub = () => {
    const navigate = useNavigate();

    const sections = [
        {
            id: 'whitepaper',
            title: 'Whitepaper & Tokenomics',
            icon: <FileText size={32} className="text-blue-500" />,
            description: 'BEZ Token ERC-20, staking, farming, DAO y economía de la plataforma.',
            path: '/docs/whitepaper'
        },
        {
            id: 'developers',
            title: 'Developer Console',
            icon: <Code size={32} className="text-purple-500" />,
            description: 'API Keys, SDK, Smart Contracts (DAO, Marketplace, NFTs, Staking, Escrow).',
            path: '/developer-console'
        },
        {
            id: 'guides',
            title: 'Guías de Usuario',
            icon: <BookOpen size={32} className="text-green-500" />,
            description: 'Cómo comprar BEZ, usar Marketplace, crear NFTs, votar en DAO, VIP.',
            path: '/docs/guides'
        },
        {
            id: 'toolbez',
            title: 'ToolBez Enterprise',
            icon: <GraduationCap size={32} className="text-yellow-500" />,
            description: '13 verticales: Real Estate, Healthcare, Automotive, Manufacturing, Energy, etc.',
            path: '/developer-console?tab=toolbez'
        },
        {
            id: 'security',
            title: 'Seguridad & Auditoría',
            icon: <Shield size={32} className="text-red-500" />,
            description: 'Contratos verificados en PolygonScan, Quality Oracle, Admin Registry.',
            path: '/docs/security'
        },
        {
            id: 'ai',
            title: 'AI & Moderación',
            icon: <Cpu size={32} className="text-cyan-500" />,
            description: 'Gemini AI, OpenAI, DeepSeek. Moderación de contenido y traducción.',
            path: '/docs/ai-engine'
        },
        {
            id: 'payments',
            title: 'Pagos Híbridos',
            icon: <Globe size={32} className="text-orange-500" />,
            description: 'Stripe (tarjeta), transferencia bancaria, USDC, MATIC, BTC, BEZ.',
            path: '/docs/payments'
        },
        {
            id: 'vip',
            title: 'Suscripciones VIP',
            icon: <Code size={32} className="text-indigo-500" />,
            description: 'Bronze ($14.99), Silver ($29.99), Gold ($69.99), Platinum ($149.99).',
            path: '/vip'
        }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4 text-gray-100">Centro de Conocimiento BeZhas</h1>
                <p className="text-xl text-gray-400">Documentación completa de la plataforma Web3 más versátil del ecosistema.</p>
                <p className="text-sm text-gray-500 mt-2">Smart Contracts | API REST | SDK | Enterprise Solutions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sections.map((section) => (
                    <div
                        key={section.id}
                        onClick={() => navigate(section.path)}
                        className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:bg-gray-800 hover:border-blue-500/50 transition-all cursor-pointer group"
                    >
                        <div className="flex items-start space-x-4">
                            <div className="p-3 bg-gray-900 rounded-lg group-hover:scale-110 transition-transform">
                                {section.icon}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">{section.title}</h3>
                                <p className="text-gray-400">{section.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DocsHub;
