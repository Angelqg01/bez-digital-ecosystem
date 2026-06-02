import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Landmark,
    Fingerprint,
    MapPin,
    Vote,
    Brain,
    Building2,
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
    Scale
} from 'lucide-react';

/**
 * GobiernoGobernanzaFundPage - Detailed explanation of the Government & Governance Development Fund
 * This page explains how the DAO fund will be used to develop Government & Governance solutions
 */
const GobiernoGobernanzaFundPage = () => {
    // Development areas data
    const developmentAreas = [
        {
            name: 'Identidad Digital Soberana (SSI)',
            type: 'I+D / Criptografía ZK',
            scalability: 'ZK-Rollups para validación masiva sin revelar datos privados',
            cost: '$200,000 - $800,000+',
            timeline: '6-12 meses',
            keyFocus: 'Eliminación de bases de datos centralizadas "honeypots"',
            icon: Fingerprint,
            color: 'from-purple-500 to-indigo-500'
        },
        {
            name: 'Registro de Tierras e Inmuebles',
            type: 'I+D / Blockchain Inmutable',
            scalability: 'Arquitecturas de consorcio para sincronización multi-agencia',
            cost: '$150,000 - $500,000',
            timeline: '8-18 meses',
            keyFocus: 'Reducción de tiempos de registro de 3 meses a minutos',
            icon: MapPin,
            color: 'from-green-500 to-emerald-500'
        },
        {
            name: 'Voto Electrónico Verificable',
            type: 'I+D / ZKP',
            scalability: 'Sharding para manejar picos de tráfico nacional en tiempo real',
            cost: '$500,000 - $1,500,000+',
            timeline: '12-24 meses',
            keyFocus: 'Verificabilidad total manteniendo anonimato del ciudadano',
            icon: Vote,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            name: 'IA Soberana Nacional',
            type: 'IA I+D / LLMs Locales',
            scalability: 'Despliegue en nube soberana y Edge',
            cost: '$500,000 - $3,000,000+',
            timeline: '10-20 meses',
            keyFocus: 'Modelos entrenados bajo leyes locales para seguridad nacional',
            icon: Brain,
            color: 'from-pink-500 to-rose-500'
        },
        {
            name: 'Gestión de Infraestructura Urbana',
            type: 'IoT / Smart Grid',
            scalability: 'Nodos gateway distribuidos para resiliencia',
            cost: '$40,000 - $180,000 (Piloto)',
            timeline: '4-7 meses',
            keyFocus: 'Monitoreo de recursos y mantenimiento predictivo',
            icon: Building2,
            color: 'from-amber-500 to-orange-500'
        }
    ];

    // Deep dive sections
    const deepDiveSections = [
        {
            title: 'ZKP y la Confianza en el Código',
            icon: Lock,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            content: [
                {
                    subtitle: 'Pruebas de Conocimiento Cero',
                    points: [
                        'Demostrar mayoría de edad sin revelar fecha de nacimiento',
                        'Verificar residencia sin exponer dirección exacta',
                        'Cumplimiento automático con EU AI Act y NIS2',
                        'Reemplazo de confianza en personas por confianza en procesos verificables'
                    ]
                },
                {
                    subtitle: 'Identidad Auto-Soberana',
                    points: [
                        'Ciudadanos controlan sus propios datos de identidad',
                        'Eliminación de "honeypots" centralizados',
                        'Credenciales verificables sin autoridad central',
                        'Interoperabilidad entre jurisdicciones'
                    ]
                }
            ]
        },
        {
            title: 'Gobernanza mediante DAOs',
            icon: Users,
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            content: [
                {
                    subtitle: 'Presupuestos Participativos',
                    points: [
                        'Propuestas votadas por ciudadanos en blockchain',
                        'Ejecución automática mediante smart contracts',
                        'Quórum verificable y transparente',
                        'Trazabilidad completa de fondos públicos'
                    ]
                },
                {
                    subtitle: 'Gobierno Agéntico',
                    points: [
                        'IA soberana que elimina burocracia manual',
                        'Registros inmutables para auditoría permanente',
                        'Automatización de procesos administrativos',
                        'Reducción de tiempos de respuesta de semanas a minutos'
                    ]
                }
            ]
        },
        {
            title: 'Smart Cities: La Ciudad Predictiva',
            icon: Building2,
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
            content: [
                {
                    subtitle: 'Caso Dubai',
                    points: [
                        'Digitalización del 100% de documentos gubernamentales',
                        'Ahorro de aproximadamente $1.1 mil millones anuales',
                        'Blockchain para servicios públicos integrados',
                        'Modelo replicable para otras jurisdicciones'
                    ]
                },
                {
                    subtitle: 'Gestión de Residuos y Tráfico',
                    points: [
                        'Sensores distribuidos para optimización de rutas',
                        'Edge AI para sincronización de semáforos en milisegundos',
                        'Reducción de congestión en un 30%',
                        'Mantenimiento predictivo de infraestructura'
                    ]
                }
            ]
        },
        {
            title: 'Seguridad y Soberanía Digital',
            icon: Shield,
            color: 'text-red-400',
            bgColor: 'bg-red-500/10',
            content: [
                {
                    subtitle: 'Zero Trust en Infraestructura Crítica',
                    points: [
                        'Verificación continua de cada dispositivo conectado',
                        'Prevención de ciberataques a infraestructura gubernamental',
                        'Segmentación de redes para aislar amenazas',
                        'Auditorías automáticas de seguridad'
                    ]
                },
                {
                    subtitle: 'DevOps Soberano',
                    points: [
                        'CI/CD para Smart Contracts con auditorías Slither/Mythril',
                        'Infraestructura como Código (IaC) para replicación segura',
                        'Resiliencia ante desastres garantizada',
                        'Datos sensibles bajo jurisdicción nacional'
                    ]
                }
            ]
        }
    ];

    // Key statistics
    const keyStats = [
        { label: 'Inversión Total', value: '$1.4M - $6M+', icon: Euro },
        { label: 'Ciclo Desarrollo', value: '4-24 meses', icon: Clock },
        { label: 'Áreas de Desarrollo', value: '5 proyectos', icon: Target },
        { label: 'Ahorro Dubai', value: '$1.1B/año', icon: TrendingUp }
    ];

    // Core principles
    const corePrinciples = [
        {
            title: 'Soberanía de Datos',
            description: 'Información sensible bajo jurisdicción nacional y protegida por criptografía',
            icon: Database,
            color: 'from-purple-500 to-indigo-500'
        },
        {
            title: 'Transparencia Radical',
            description: 'Registros inmutables para auditoría permanente de fondos y decisiones',
            icon: Eye,
            color: 'from-cyan-500 to-blue-500'
        },
        {
            title: 'Privacidad Ciudadana',
            description: 'ZKP permite verificación sin exposición de datos personales',
            icon: Lock,
            color: 'from-green-500 to-emerald-500'
        }
    ];

    // Benefits
    const benefits = [
        {
            title: 'Registro de Tierras',
            description: 'Reducción de tiempo de registro',
            icon: MapPin,
            stat: '3 meses → minutos'
        },
        {
            title: 'Congestión Urbana',
            description: 'Reducción mediante Edge AI y IoT',
            icon: Activity,
            stat: '-30%'
        },
        {
            title: 'Costos Documentos',
            description: 'Ahorro por digitalización total',
            icon: FileCheck,
            stat: '$1.1B/año'
        },
        {
            title: 'Burocracia',
            description: 'Automatización con IA soberana',
            icon: Zap,
            stat: '-80%'
        }
    ];

    // Technology stack
    const techStack = [
        { name: 'Zero-Knowledge Proofs', description: 'Privacidad verificable', icon: Lock },
        { name: 'DAOs', description: 'Gobernanza descentralizada', icon: Users },
        { name: 'Smart Contracts', description: 'Ejecución automática', icon: FileCheck },
        { name: 'Edge AI', description: 'Decisiones locales', icon: Cpu },
        { name: 'IoT Urbano', description: 'Sensores distribuidos', icon: Wifi },
        { name: 'Blockchain', description: 'Registros inmutables', icon: Binary }
    ];

    // Compliance frameworks
    const complianceFrameworks = [
        { name: 'EU AI Act', description: 'Regulación europea de IA' },
        { name: 'NIS2', description: 'Directiva de ciberseguridad' },
        { name: 'GDPR', description: 'Protección de datos' },
        { name: 'eIDAS 2.0', description: 'Identidad digital europea' }
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
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-500 to-zinc-600 mb-6">
                        <Landmark className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Fondo de Desarrollo
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-zinc-400">
                            Gobierno y Gobernanza
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-4xl mx-auto">
                        Hacia la Soberanía Digital y Transparencia Radical: donde la IA soberana y los registros inmutables
                        eliminan la burocracia, garantizando que la información sensible de los ciudadanos permanezca
                        bajo jurisdicción nacional y protegida por criptografía avanzada.
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
                            <stat.icon className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                            <div className="text-2xl font-bold text-white">{stat.value}</div>
                            <div className="text-sm text-gray-400">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>

                {/* Core Principles */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Scale className="w-6 h-6 text-slate-400" />
                        Principios Fundamentales
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        {corePrinciples.map((principle, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + idx * 0.1 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6"
                            >
                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${principle.color} flex items-center justify-center mb-4`}>
                                    <principle.icon className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{principle.title}</h3>
                                <p className="text-gray-400">{principle.description}</p>
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
                        <TrendingUp className="w-6 h-6 text-slate-400" />
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
                                    <benefit.icon className="w-8 h-8 text-slate-400" />
                                    <span className="text-lg font-bold text-green-400">{benefit.stat}</span>
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
                        <Landmark className="w-6 h-6 text-slate-400" />
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
                                        <div className="text-slate-400 font-medium">{area.cost}</div>
                                        <div className="text-gray-300">{area.timeline}</div>
                                        <div className="text-green-400 text-sm">{area.keyFocus}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Technology Stack */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Server className="w-6 h-6 text-slate-400" />
                        Stack Tecnológico
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {techStack.map((tech, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.55 + idx * 0.05 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center hover:border-slate-500/50 transition-colors"
                            >
                                <tech.icon className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                <div className="font-semibold text-white text-sm">{tech.name}</div>
                                <div className="text-xs text-gray-400">{tech.description}</div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Compliance Frameworks */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <FileCheck className="w-6 h-6 text-slate-400" />
                        Marcos Regulatorios Soportados
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {complianceFrameworks.map((framework, idx) => (
                            <div key={idx} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                                <div className="font-semibold text-white mb-1">{framework.name}</div>
                                <div className="text-sm text-gray-400">{framework.description}</div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Deep Dive Sections */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Globe className="w-6 h-6 text-slate-400" />
                        Profundización Técnica
                    </h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        {deepDiveSections.map((section, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 + idx * 0.1 }}
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
                                        <h4 className="text-sm font-semibold text-slate-400 mb-2">
                                            {subsection.subtitle}
                                        </h4>
                                        <ul className="space-y-2">
                                            {subsection.points.map((point, pointIdx) => (
                                                <li key={pointIdx} className="flex items-start gap-2 text-sm text-gray-300">
                                                    <span className="text-slate-400 mt-1">•</span>
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
                    transition={{ delay: 0.8 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Network className="w-6 h-6 text-slate-400" />
                        Sectores Relacionados
                    </h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <Link to="/dao/energia-smart-cities" className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-green-500/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-green-400 transition-colors">Energía y Smart Cities</div>
                                    <div className="text-sm text-gray-400">Smart Grids y gemelos digitales urbanos</div>
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
                                    <div className="text-sm text-gray-400">Trazabilidad y redes agénticas</div>
                                </div>
                            </div>
                        </Link>
                        <Link to="/dao/salud-biotecnologia" className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-red-500/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-red-400 transition-colors">Salud y Biotecnología</div>
                                    <div className="text-sm text-gray-400">Tokenización de datos clínicos</div>
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
                    className="text-center bg-gradient-to-r from-slate-500/20 to-zinc-500/20 border border-slate-500/30 rounded-2xl p-8"
                >
                    <h2 className="text-2xl font-bold mb-4">¿Listo para construir el gobierno del futuro?</h2>
                    <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                        Tu voto y contribución ayudan a financiar la infraestructura que garantizará
                        la soberanía digital, la transparencia radical y la privacidad de los ciudadanos
                        en la gobernanza del mañana.
                    </p>
                    <Link
                        to="/dao-page"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-500 to-zinc-500 rounded-xl font-semibold text-white hover:from-slate-600 hover:to-zinc-600 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Volver a votar
                    </Link>
                </motion.div>
            </div>
        </div>
    );
};

export default GobiernoGobernanzaFundPage;
