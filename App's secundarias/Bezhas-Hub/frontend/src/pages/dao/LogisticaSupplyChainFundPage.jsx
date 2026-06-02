import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Truck,
    Bot,
    FileText,
    Thermometer,
    QrCode,
    Box,
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
    Package,
    Scan,
    BarChart3,
    Layers,
    Zap,
    Binary,
    RefreshCw
} from 'lucide-react';

/**
 * LogisticaSupplyChainFundPage - Detailed explanation of the Logistics & Supply Chain Development Fund
 * This page explains how the DAO fund will be used to develop Logistics & Supply Chain solutions
 */
const LogisticaSupplyChainFundPage = () => {
    // Development areas data
    const developmentAreas = [
        {
            name: 'Redes de Suministro Agénticas',
            type: 'Agentes de IA para negociación y ruteo autónomo',
            scalability: 'Sistemas multi-agente (MAS) en capas de abstracción de cadena',
            cost: '$250,000 - $1,000,000+',
            timeline: '6-12 meses',
            roi: 'Reducción del 20% en costos de retención de inventario',
            icon: Bot,
            color: 'from-purple-500 to-indigo-500'
        },
        {
            name: 'Tokenización de Facturas e Inventario',
            type: 'RWA / Smart Contracts para PayFi y colateralización',
            scalability: 'Layer 2 y Sharding para volúmenes masivos',
            cost: '$50,000 - $150,000 (Piloto)',
            timeline: '3-6 meses',
            roi: 'Reducción del 30% en costos administrativos',
            icon: FileText,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            name: 'Monitoreo Ambiental Crítico',
            type: 'IoT / Sensores de temperatura, humedad y GPS',
            scalability: 'Arquitectura Edge-Cloud; oráculos off-chain',
            cost: '$15,000 - $60,000',
            timeline: '2-5 meses',
            roi: 'Eliminación de disputas por deterioro; pagos automáticos',
            icon: Thermometer,
            color: 'from-green-500 to-emerald-500'
        },
        {
            name: 'Trazabilidad Farm to Fork / Luxury',
            type: 'Blockchain + RFID/NFC para autenticidad',
            scalability: 'DAGs para reducir latencia de rastreo en 85%',
            cost: '$100,000 - $300,000',
            timeline: '8-18 meses',
            roi: 'Prevención de fraude ($250B mercado) y cumplimiento',
            icon: QrCode,
            color: 'from-amber-500 to-orange-500'
        },
        {
            name: 'Gemelos Digitales Logísticos',
            type: 'Simulación de interrupciones y optimización',
            scalability: 'Sincronización 5G/6G y procesamiento perimetral',
            cost: '$10k/año (SaaS) - Variable',
            timeline: '3-6 meses',
            roi: 'Mejora 20-30% en eficiencia de movimiento de carga',
            icon: Box,
            color: 'from-pink-500 to-rose-500'
        }
    ];

    // Deep dive sections
    const deepDiveSections = [
        {
            title: 'El Fin del "Resilience Premium"',
            icon: RefreshCw,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            content: [
                {
                    subtitle: 'Superioridad de la Información',
                    points: [
                        'Sustitución de redundancia física (exceso de stock) por inteligencia de datos',
                        'Conocimiento exacto de ubicación de cada unidad en tiempo real',
                        'Resiliencia sin inflar balances con inventario de seguridad',
                        'Visibilidad end-to-end de la cadena de suministro'
                    ]
                },
                {
                    subtitle: 'Contratos Inteligentes Autoejecutables',
                    points: [
                        'Pagos a proveedores liberados automáticamente',
                        'Verificación IoT de condiciones de temperatura durante trayecto',
                        'Eliminación de intermediarios y retrasos en pagos',
                        'Auditoría inmutable de cada transacción'
                    ]
                }
            ]
        },
        {
            title: 'Orquestación con RPA',
            icon: Bot,
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            content: [
                {
                    subtitle: 'Automatización Robótica de Procesos',
                    points: [
                        'Integración de RPA con blockchain para auditabilidad',
                        'Cada acción de bots logísticos a prueba de manipulación',
                        'Reducción de errores humanos en un 80%',
                        'Procesamiento automatizado de órdenes y documentos'
                    ]
                },
                {
                    subtitle: 'Empresa Agéntica',
                    points: [
                        'IA que orquesta flujos de trabajo de extremo a extremo',
                        'Blockchain proporciona la "Verdad" inmutable',
                        'IA aporta "Inteligencia" para decisiones autónomas',
                        'Negociación automática con proveedores'
                    ]
                }
            ]
        },
        {
            title: 'Escalabilidad: Sharding y DAGs',
            icon: Layers,
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
            content: [
                {
                    subtitle: 'Particionamiento de Base de Datos',
                    points: [
                        'Sharding para manejar escala global',
                        'DAGs (Directed Acyclic Graphs) para transacciones paralelas',
                        'Eliminación de cuello de botella de bloques secuenciales',
                        'Procesamiento de datos de alta frecuencia'
                    ]
                },
                {
                    subtitle: 'Arquitectura Modular',
                    points: [
                        'Separación de ejecución, liquidación, datos y consenso',
                        'Rendimiento superior a 10,000 TPS',
                        'Costos marginales de $0.001 por operación',
                        'Optimización individual de cada componente'
                    ]
                }
            ]
        },
        {
            title: 'IoT y Edge Computing',
            icon: Wifi,
            color: 'text-green-400',
            bgColor: 'bg-green-500/10',
            content: [
                {
                    subtitle: 'Sensores de Campo',
                    points: [
                        'Millones de sensores RFID/GPS conectados',
                        'Monitoreo de temperatura, humedad y vibración',
                        'Alertas automáticas ante desviaciones',
                        'Geofencing para control de rutas'
                    ]
                },
                {
                    subtitle: 'Procesamiento Perimetral',
                    points: [
                        'Edge Computing para decisiones en milisegundos',
                        'Reducción de latencia y ancho de banda',
                        'Operación autónoma ante pérdida de conectividad',
                        'Sincronización 5G/6G en tiempo real'
                    ]
                }
            ]
        }
    ];

    // Key statistics
    const keyStats = [
        { label: 'Inversión Total', value: '$425K - $1.5M+', icon: Euro },
        { label: 'Ciclo Desarrollo', value: '2-18 meses', icon: Clock },
        { label: 'Áreas de Desarrollo', value: '5 proyectos', icon: Target },
        { label: 'Reducción Costos', value: '20-30%', icon: TrendingUp }
    ];

    // Key benefits
    const benefits = [
        {
            title: 'Costos de Inventario',
            description: 'Reducción mediante visibilidad total y predicción de demanda',
            icon: Package,
            stat: '-20%'
        },
        {
            title: 'Costos Administrativos',
            description: 'Automatización de facturas y pagos con smart contracts',
            icon: FileText,
            stat: '-30%'
        },
        {
            title: 'Errores Humanos',
            description: 'Reducción mediante RPA y automatización blockchain',
            icon: RefreshCw,
            stat: '-80%'
        },
        {
            title: 'Latencia de Rastreo',
            description: 'Mejora mediante DAGs y procesamiento paralelo',
            icon: Zap,
            stat: '-85%'
        }
    ];

    // Use cases
    const useCases = [
        {
            title: 'Cadena de Frío',
            description: 'Monitoreo continuo de temperatura con pagos automáticos basados en cumplimiento',
            icon: Thermometer,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            title: 'Productos de Lujo',
            description: 'Autenticidad verificable y prevención de falsificaciones ($250B mercado)',
            icon: QrCode,
            color: 'from-purple-500 to-pink-500'
        },
        {
            title: 'Farm to Fork',
            description: 'Trazabilidad completa desde origen hasta consumidor final',
            icon: Scan,
            color: 'from-green-500 to-emerald-500'
        },
        {
            title: 'Financiamiento de Inventario',
            description: 'Tokenización de facturas para acceso a liquidez inmediata',
            icon: FileText,
            color: 'from-amber-500 to-orange-500'
        }
    ];

    // Technology stack
    const techStack = [
        { name: 'Multi-Agent Systems', description: 'IA autónoma', icon: Bot },
        { name: 'DAGs', description: 'Transacciones paralelas', icon: Network },
        { name: 'RFID/NFC', description: 'Identificación física', icon: Scan },
        { name: 'Edge Computing', description: 'Procesamiento local', icon: Cpu },
        { name: 'Smart Contracts', description: 'Pagos automáticos', icon: FileText },
        { name: '5G/6G', description: 'Conectividad crítica', icon: Wifi }
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
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 mb-6">
                        <Truck className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Fondo de Desarrollo
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                            Logística y Supply Chain
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-4xl mx-auto">
                        Hacia la "Empresa Agéntica": donde la IA orquesta flujos de trabajo de extremo a extremo,
                        blockchain proporciona la verdad inmutable, y los activos son inteligentes, líquidos y totalmente trazables.
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
                            <stat.icon className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                            <div className="text-2xl font-bold text-white">{stat.value}</div>
                            <div className="text-sm text-gray-400">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>

                {/* Benefits Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-orange-400" />
                        Impacto en ROI y Operaciones
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {benefits.map((benefit, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + idx * 0.05 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <benefit.icon className="w-8 h-8 text-orange-400" />
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
                    transition={{ delay: 0.25 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Package className="w-6 h-6 text-orange-400" />
                        Áreas de Desarrollo - Proyección 2026
                    </h2>

                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden">
                        {/* Table Header - Desktop */}
                        <div className="hidden lg:grid lg:grid-cols-6 gap-4 p-4 bg-gray-900/50 border-b border-gray-700/50 text-sm font-semibold text-gray-400">
                            <div>Área de Desarrollo</div>
                            <div>Tipo de I+D / IoT</div>
                            <div>Estrategia de Escalabilidad</div>
                            <div>Costo Estimado</div>
                            <div>Tiempo</div>
                            <div>Impacto ROI</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-gray-700/50">
                            {developmentAreas.map((area, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + idx * 0.1 }}
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
                                            ✓ {area.roi}
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
                                        <div className="text-orange-400 font-medium">{area.cost}</div>
                                        <div className="text-gray-300">{area.timeline}</div>
                                        <div className="text-green-400 text-sm">{area.roi}</div>
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
                    transition={{ delay: 0.4 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Globe className="w-6 h-6 text-orange-400" />
                        Casos de Uso Clave
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {useCases.map((useCase, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.45 + idx * 0.05 }}
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
                    transition={{ delay: 0.5 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Cpu className="w-6 h-6 text-orange-400" />
                        Stack Tecnológico
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {techStack.map((tech, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.55 + idx * 0.05 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center hover:border-orange-500/50 transition-colors"
                            >
                                <tech.icon className="w-8 h-8 mx-auto mb-2 text-orange-400" />
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
                    transition={{ delay: 0.6 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-orange-400" />
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
                                        <h4 className="text-sm font-semibold text-orange-400 mb-2">
                                            {subsection.subtitle}
                                        </h4>
                                        <ul className="space-y-2">
                                            {subsection.points.map((point, pointIdx) => (
                                                <li key={pointIdx} className="flex items-start gap-2 text-sm text-gray-300">
                                                    <span className="text-orange-400 mt-1">•</span>
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
                        <Network className="w-6 h-6 text-orange-400" />
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
                                    <div className="text-sm text-gray-400">Infraestructura predictiva y descarbonización</div>
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
                                    <div className="text-sm text-gray-400">Fábricas auto-reparables y mantenimiento predictivo</div>
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
                                    <div className="text-sm text-gray-400">Tokenización de datos clínicos y Hospital-at-Home</div>
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
                    className="text-center bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-2xl p-8"
                >
                    <h2 className="text-2xl font-bold mb-4">¿Listo para transformar la logística global?</h2>
                    <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                        Tu voto y contribución ayudan a financiar la infraestructura que hará los activos
                        inteligentes, líquidos y totalmente trazables, eliminando fricciones en la cadena de suministro global.
                    </p>
                    <Link
                        to="/dao-page"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl font-semibold text-white hover:from-orange-600 hover:to-amber-600 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Volver a votar
                    </Link>
                </motion.div>
            </div>
        </div>
    );
};

export default LogisticaSupplyChainFundPage;
