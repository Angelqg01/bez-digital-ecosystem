import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Building2,
    Wallet,
    Bot,
    Fingerprint,
    CreditCard,
    Banknote,
    TrendingUp,
    Clock,
    Euro,
    Target,
    Cpu,
    Wifi,
    Shield,
    Database,
    Activity,
    Globe,
    Network,
    Lock,
    Server,
    Binary,
    Users,
    FileCheck,
    Zap,
    Eye,
    BarChart3,
    Coins,
    ArrowRightLeft,
    Scan
} from 'lucide-react';

/**
 * BancaFintechFundPage - Detailed explanation of the Banking & Fintech Development Fund
 * This page explains how the DAO fund will be used to develop Banking & Fintech solutions
 */
const BancaFintechFundPage = () => {
    // Development areas data
    const developmentAreas = [
        {
            name: 'Wholesale RWA Settlement',
            type: 'I+D / Tokenización de Bonos y Fondos MMF',
            scalability: 'ZK-Rollups en Ethereum/Solana para liquidación T+0',
            cost: '$300,000 - $1,500,000+',
            timeline: '8-15 meses',
            keyFocus: 'Estándares ERC-3643 con reglas de cumplimiento integradas',
            icon: Coins,
            color: 'from-blue-500 to-indigo-500'
        },
        {
            name: 'Agentes de Gestión de Patrimonio',
            type: 'IA I+D / Wealth Management Autónomo',
            scalability: 'Sistemas Multi-Agente (MAS) coordinados por orquestadores',
            cost: '$150,000 - $600,000',
            timeline: '6-10 meses',
            keyFocus: 'Do-Bots que ejecutan reequilibrio de carteras mediante intents',
            icon: Bot,
            color: 'from-purple-500 to-pink-500'
        },
        {
            name: 'Pagos Biométricos e IoT',
            type: 'IoT / Rieles de pago "Invisibles"',
            scalability: 'Autenticación Zero-Trust y Edge AI para latencia <10ms',
            cost: '$80,000 - $250,000 (por región)',
            timeline: '4-8 meses',
            keyFocus: 'QR-Pay y Face-ID con vinculación a Stablecoins',
            icon: Fingerprint,
            color: 'from-green-500 to-emerald-500'
        },
        {
            name: 'Scoring de Crédito Programable',
            type: 'IA I+D / Verificabilidad On-chain',
            scalability: 'Account Abstraction (ERC-4337) para historial unificado',
            cost: '$100,000 - $450,000',
            timeline: '5-9 meses',
            keyFocus: 'ZK-Proofs para probar solvencia sin revelar balances',
            icon: BarChart3,
            color: 'from-cyan-500 to-blue-500'
        },
        {
            name: 'PayFi (Payments meets Finance)',
            type: 'I+D / Stablecoins como capa de pago',
            scalability: 'Sharding y protocolos de interoperabilidad (IBC/CCIP)',
            cost: '$100,000 - $350,000',
            timeline: '4-7 meses',
            keyFocus: 'Automatización de flujos B2B mediante agentes de IA',
            icon: ArrowRightLeft,
            color: 'from-amber-500 to-orange-500'
        }
    ];

    // Deep dive sections
    const deepDiveSections = [
        {
            title: 'Agentic Banking: El Auge de los Do-Bots',
            icon: Bot,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            content: [
                {
                    subtitle: 'De Chatbots a Agentes de Ejecución',
                    points: [
                        'Transición de consulta a ejecución autónoma de operaciones',
                        'Negociación automática de préstamos puente en mercados tokenizados',
                        'Reequilibrio de carteras mediante intents programables',
                        'Orquestación de múltiples agentes especializados'
                    ]
                },
                {
                    subtitle: 'Impacto Medible',
                    points: [
                        '55% de mejora en eficiencia operativa',
                        '35% de reducción en costos de procesamiento',
                        'ROI de $3.50 por cada $1 invertido en IA agéntica',
                        'Liquidación instantánea sobre rieles de blockchain'
                    ]
                }
            ]
        },
        {
            title: 'Pagos Invisibles y Biometría',
            icon: Fingerprint,
            color: 'text-green-400',
            bgColor: 'bg-green-500/10',
            content: [
                {
                    subtitle: 'Hardware-as-a-Service (HaaS)',
                    points: [
                        'Componentes modulares y reciclables para puntos de venta',
                        'Integración nativa con rieles de stablecoins',
                        'Eliminación de la fricción del checkout tradicional',
                        'Wearables y dispositivos personales como terminales de pago'
                    ]
                },
                {
                    subtitle: 'Detección de Fraude en Tiempo Real',
                    points: [
                        'Oráculos de IA monitoreando sensores de dispositivos',
                        'Detección de anomalías físicas y lógicas en milisegundos',
                        '91% de reducción de fraude en Trade Finance',
                        'Zero-Trust continuo para cada transacción'
                    ]
                }
            ]
        },
        {
            title: 'Tokenización de Activos (RWA)',
            icon: Coins,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            content: [
                {
                    subtitle: 'Wholesale Settlement',
                    points: [
                        'Liquidación T+0 para bonos y fondos del mercado monetario',
                        'Estándares ERC-3643 con cumplimiento integrado',
                        'ZK-Rollups para >10,000 TPS con costos de $0.001',
                        'Interoperabilidad entre cadenas (IBC/CCIP)'
                    ]
                },
                {
                    subtitle: 'Mercados de Capitales Programables',
                    points: [
                        'Bonos tokenizados con lógica de cumplimiento on-chain',
                        'Crédito privado tokenizado para acceso democratizado',
                        'Fondos MMF con liquidez instantánea',
                        'Derivados programables con liquidación automática'
                    ]
                }
            ]
        },
        {
            title: 'DevOps Financiero y Seguridad',
            icon: Shield,
            color: 'text-red-400',
            bgColor: 'bg-red-500/10',
            content: [
                {
                    subtitle: 'CI/CD para Smart Contracts',
                    points: [
                        'Auditorías automáticas con Slither/Mythril',
                        'Pruebas de carga para >10,000 TPS sin degradación',
                        'Infraestructura como Código (IaC) con Terraform',
                        'Nodos en centros de datos soberanos con cumplimiento by design'
                    ]
                },
                {
                    subtitle: 'Arquitectura Modular',
                    points: [
                        'Separación de ejecución, liquidación, datos y consenso',
                        'Optimización individual de cada componente',
                        'Rendimiento de 10,000+ TPS con $0.001/operación',
                        'Escalabilidad horizontal sin límites técnicos'
                    ]
                }
            ]
        }
    ];

    // Key statistics
    const keyStats = [
        { label: 'Inversión Total', value: '$730K - $3.15M+', icon: Euro },
        { label: 'Ciclo Desarrollo', value: '4-15 meses', icon: Clock },
        { label: 'Áreas de Desarrollo', value: '5 proyectos', icon: Target },
        { label: 'ROI IA Agéntica', value: '$3.50 x $1', icon: TrendingUp }
    ];

    // Key benefits
    const benefits = [
        {
            title: 'Eficiencia Operativa',
            description: 'Mejora mediante agentes de IA autónomos',
            icon: Activity,
            stat: '+55%'
        },
        {
            title: 'Costos de Procesamiento',
            description: 'Reducción con automatización blockchain',
            icon: Banknote,
            stat: '-35%'
        },
        {
            title: 'Fraude Trade Finance',
            description: 'Reducción con oráculos de IA en tiempo real',
            icon: Shield,
            stat: '-91%'
        },
        {
            title: 'Latencia de Pagos',
            description: 'Con Edge AI y autenticación Zero-Trust',
            icon: Zap,
            stat: '<10ms'
        }
    ];

    // Banca AI-First pillars
    const bancaPillars = [
        {
            title: 'Do-Bots (Agentes de Ejecución)',
            description: 'IA que no solo informa, sino que ejecuta operaciones financieras autónomamente',
            icon: Bot,
            color: 'from-purple-500 to-pink-500'
        },
        {
            title: 'Rieles de Blockchain',
            description: 'Liquidación instantánea T+0 sobre infraestructura tokenizada',
            icon: Binary,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            title: 'Pagos Invisibles',
            description: 'Biometría y IoT para eliminar la fricción del checkout',
            icon: Fingerprint,
            color: 'from-green-500 to-emerald-500'
        }
    ];

    // Technology stack
    const techStack = [
        { name: 'ZK-Rollups', description: 'Escalabilidad L2', icon: Binary },
        { name: 'ERC-3643', description: 'Tokens con cumplimiento', icon: FileCheck },
        { name: 'Multi-Agent Systems', description: 'IA coordinada', icon: Bot },
        { name: 'Edge AI', description: 'Latencia <10ms', icon: Cpu },
        { name: 'Account Abstraction', description: 'ERC-4337', icon: Wallet },
        { name: 'Stablecoins', description: 'Capa de pago', icon: Coins }
    ];

    // Use cases
    const useCases = [
        {
            title: 'Gestión de Patrimonio',
            description: 'Agentes que reequilibran carteras y negocian préstamos automáticamente',
            icon: BarChart3,
            color: 'from-purple-500 to-indigo-500'
        },
        {
            title: 'Trade Finance',
            description: 'Liquidación instantánea con detección de fraude en tiempo real',
            icon: ArrowRightLeft,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            title: 'Crédito Tokenizado',
            description: 'Scoring programable con ZK-Proofs para privacidad',
            icon: CreditCard,
            color: 'from-green-500 to-emerald-500'
        },
        {
            title: 'Pagos B2B',
            description: 'Flujos automatizados mediante agentes de IA sobre stablecoins',
            icon: Banknote,
            color: 'from-amber-500 to-orange-500'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
            {/* Header with back button */}
            <div className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-lg border-b border-gray-700/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <Link
                        to="/dao-page"
                        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span>Volver a DAO</span>
                    </Link>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-6">
                        <Building2 className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Fondo de Desarrollo
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                            Banca y Fintech
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-4xl mx-auto">
                        De la Digitalización a las Finanzas Agénticas: donde los "Do-Bots" operan sobre rieles de blockchain
                        para liquidación instantánea, transformando procesos manuales en infraestructura financiera
                        líquida, programable y global.
                    </p>
                </motion.div>

                {/* Key Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
                >
                    {keyStats.map((stat, idx) => (
                        <div key={idx} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
                            <stat.icon className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                            <div className="text-2xl font-bold text-white">{stat.value}</div>
                            <div className="text-sm text-gray-400">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>

                {/* Banca AI-First Pillars */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Cpu className="w-6 h-6 text-blue-400" />
                        Modelo "Banca AI-First" 2026
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        {bancaPillars.map((pillar, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + idx * 0.1 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6"
                            >
                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${pillar.color} flex items-center justify-center mb-4`}>
                                    <pillar.icon className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{pillar.title}</h3>
                                <p className="text-gray-400">{pillar.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Benefits Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-blue-400" />
                        Impacto Esperado
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {benefits.map((benefit, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 + idx * 0.05 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <benefit.icon className="w-8 h-8 text-blue-400" />
                                    <span className="text-2xl font-bold text-green-400">{benefit.stat}</span>
                                </div>
                                <h3 className="font-semibold text-white mb-1">{benefit.title}</h3>
                                <p className="text-sm text-gray-400">{benefit.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Development Areas Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Building2 className="w-6 h-6 text-blue-400" />
                        Áreas de Desarrollo - Proyección 2026
                    </h2>

                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden">
                        {/* Table Header - Desktop */}
                        <div className="hidden lg:grid lg:grid-cols-6 gap-4 p-4 bg-gray-900/50 border-b border-gray-700/50 text-sm font-semibold text-gray-400">
                            <div>Área de Desarrollo</div>
                            <div>Tipo de I+D</div>
                            <div>Estrategia de Escalabilidad</div>
                            <div>Costo Estimado</div>
                            <div>Tiempo</div>
                            <div>Enfoque Clave</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-gray-700/50">
                            {developmentAreas.map((area, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + idx * 0.1 }}
                                    className="p-4 hover:bg-gray-700/20 transition-colors"
                                >
                                    {/* Mobile Layout */}
                                    <div className="lg:hidden space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${area.color} flex items-center justify-center`}>
                                                <area.icon className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white">{area.name}</div>
                                                <div className="text-sm text-gray-400">{area.type}</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="bg-gray-700/30 rounded-lg p-2">
                                                <div className="text-gray-400 text-xs">Costo</div>
                                                <div className="text-white font-medium">{area.cost}</div>
                                            </div>
                                            <div className="bg-gray-700/30 rounded-lg p-2">
                                                <div className="text-gray-400 text-xs">Tiempo</div>
                                                <div className="text-white font-medium">{area.timeline}</div>
                                            </div>
                                        </div>
                                        <div className="text-sm">
                                            <span className="text-gray-400">Escalabilidad:</span>
                                            <span className="text-white ml-2">{area.scalability}</span>
                                        </div>
                                        <div className="text-sm text-green-400">
                                            ✓ {area.keyFocus}
                                        </div>
                                    </div>

                                    {/* Desktop Layout */}
                                    <div className="hidden lg:grid lg:grid-cols-6 gap-4 items-center">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${area.color} flex items-center justify-center flex-shrink-0`}>
                                                <area.icon className="w-5 h-5 text-white" />
                                            </div>
                                            <span className="font-semibold text-white">{area.name}</span>
                                        </div>
                                        <div className="text-gray-300 text-sm">{area.type}</div>
                                        <div className="text-sm text-gray-400">{area.scalability}</div>
                                        <div className="text-blue-400 font-medium">{area.cost}</div>
                                        <div className="text-gray-300">{area.timeline}</div>
                                        <div className="text-green-400 text-sm">{area.keyFocus}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Use Cases */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Globe className="w-6 h-6 text-blue-400" />
                        Casos de Uso Clave
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {useCases.map((useCase, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.55 + idx * 0.05 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5"
                            >
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${useCase.color} flex items-center justify-center mb-4`}>
                                    <useCase.icon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="font-semibold text-white mb-2">{useCase.title}</h3>
                                <p className="text-sm text-gray-400">{useCase.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Technology Stack */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Server className="w-6 h-6 text-blue-400" />
                        Stack Tecnológico
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {techStack.map((tech, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.65 + idx * 0.05 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center hover:border-blue-500/50 transition-colors"
                            >
                                <tech.icon className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                                <div className="font-semibold text-white text-sm">{tech.name}</div>
                                <div className="text-xs text-gray-400">{tech.description}</div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Deep Dive Sections */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-blue-400" />
                        Profundización Técnica
                    </h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        {deepDiveSections.map((section, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.75 + idx * 0.1 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-12 h-12 rounded-xl ${section.bgColor} flex items-center justify-center`}>
                                        <section.icon className={`w-6 h-6 ${section.color}`} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">{section.title}</h3>
                                </div>

                                {section.content.map((subsection, subIdx) => (
                                    <div key={subIdx} className="mb-4 last:mb-0">
                                        <h4 className="text-sm font-semibold text-blue-400 mb-2">
                                            {subsection.subtitle}
                                        </h4>
                                        <ul className="space-y-2">
                                            {subsection.points.map((point, pointIdx) => (
                                                <li key={pointIdx} className="flex items-start gap-2 text-sm text-gray-300">
                                                    <span className="text-blue-400 mt-1">•</span>
                                                    <span>{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Related Sectors */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.85 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Network className="w-6 h-6 text-blue-400" />
                        Sectores Relacionados
                    </h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <Link to="/dao/gobierno-gobernanza" className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-slate-500/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-500 to-zinc-500 flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-slate-400 transition-colors">Gobierno y Gobernanza</div>
                                    <div className="text-sm text-gray-400">Identidad digital y IA soberana</div>
                                </div>
                            </div>
                        </Link>
                        <Link to="/dao/logistica-supply-chain" className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-orange-500/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-orange-400 transition-colors">Logística y Supply Chain</div>
                                    <div className="text-sm text-gray-400">Trade Finance y trazabilidad</div>
                                </div>
                            </div>
                        </Link>
                        <Link to="/dao/industria-4-0" className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-purple-500/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                                    <Cpu className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-purple-400 transition-colors">Industria 4.0</div>
                                    <div className="text-sm text-gray-400">Financiamiento de activos industriales</div>
                                </div>
                            </div>
                        </Link>
                    </div>
                </motion.div>

                {/* Call to Action */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="text-center bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-2xl p-8"
                >
                    <h2 className="text-2xl font-bold mb-4">¿Listo para las finanzas del futuro?</h2>
                    <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                        Tu voto y contribución ayudan a financiar la infraestructura que transformará
                        los procesos financieros manuales en capital líquido, programable y global,
                        operado por agentes de IA autónomos sobre rieles de blockchain.
                    </p>
                    <Link
                        to="/dao-page"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl font-semibold text-white hover:from-blue-600 hover:to-cyan-600 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Volver a votar
                    </Link>
                </motion.div>
            </div>
        </div>
    );
};

export default BancaFintechFundPage;
