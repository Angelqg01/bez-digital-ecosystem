import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Zap,
    Building2,
    Car,
    Trash2,
    Leaf,
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
    Wind,
    Sun,
    Gauge,
    Lock,
    Server,
    Binary
} from 'lucide-react';

/**
 * EnergiaSmartCitiesFundPage - Detailed explanation of the Energy & Smart Cities Development Fund
 * This page explains how the DAO fund will be used to develop Energy & Smart Cities solutions
 */
const EnergiaSmartCitiesFundPage = () => {
    // Development areas data
    const developmentAreas = [
        {
            name: 'Smart Grids Híbridas',
            type: 'I+D en estabilización de suministro y respaldo',
            scalability: 'Puntos de conexión únicos a la red para maximizar eficiencia',
            cost: '$500,000 - $2,500,000+',
            timeline: '12-24 meses',
            keyFocus: 'Hibridación de plantas eólicas con ciclo combinado',
            icon: Zap,
            color: 'from-yellow-500 to-amber-500'
        },
        {
            name: 'Trading de Energía P2P',
            type: 'Blockchain para mercados descentralizados',
            scalability: 'ZK-Rollups para comprimir miles de micro-transacciones',
            cost: '$150,000 - $600,000',
            timeline: '6-12 meses',
            keyFocus: 'Liquidación instantánea T+0 para prosumidores',
            icon: Network,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            name: 'Movilidad Urbana Inteligente',
            type: 'IoT / Edge AI para gestión de tráfico y flotas',
            scalability: 'Latencia <0.3s mediante procesamiento perimetral',
            cost: '$200,000 - $850,000',
            timeline: '8-14 meses',
            keyFocus: 'Optimización de señales en milisegundos basada en flujo real',
            icon: Car,
            color: 'from-purple-500 to-indigo-500'
        },
        {
            name: 'Gestión de Recursos y Residuos',
            type: 'IoT / Sensores de red distribuida',
            scalability: 'Gateway nodes que agregan paquetes para reducir ancho de banda',
            cost: '$40,000 - $180,000 (Piloto)',
            timeline: '4-7 meses',
            keyFocus: 'Monitoreo en tiempo real de niveles de residuos y fugas',
            icon: Trash2,
            color: 'from-green-500 to-emerald-500'
        },
        {
            name: 'Tokenización de Carbono (ESG)',
            type: 'RWA / Auditoría Inmutable',
            scalability: 'Estándares ERC-3643 para cumplimiento normativo automático',
            cost: '$100,000 - $350,000',
            timeline: '5-10 meses',
            keyFocus: 'Trazabilidad de Net Zero y prevención de doble conteo',
            icon: Leaf,
            color: 'from-teal-500 to-green-500'
        }
    ];

    // Deep dive sections
    const deepDiveSections = [
        {
            title: 'El "Trillón de Euros" en Infraestructura',
            icon: Building2,
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/10',
            content: [
                {
                    subtitle: 'Red Europea y Descentralización',
                    points: [
                        'Inversión masiva para adaptar sistemas a modelos descentralizados',
                        'Gestión de "multi-moléculas": electricidad + corredores de hidrógeno',
                        'Integración de fuentes renovables distribuidas',
                        'Conexión de centros de datos masivos con energía renovable'
                    ]
                },
                {
                    subtitle: 'Gemelos Digitales Planetarios',
                    points: [
                        'Proyectos como "Destination Earth" para simular impacto climático',
                        'Modelado de demanda de energía urbana pre-inversión',
                        'Reducción de riesgos en inversiones de infraestructura',
                        'Predicción de cuellos de botella en la red'
                    ]
                }
            ]
        },
        {
            title: 'IoT y 6G: Conectividad Crítica',
            icon: Wifi,
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            content: [
                {
                    subtitle: 'Transición hacia 6G',
                    points: [
                        'Redes que gestionan consumo energético de forma autónoma',
                        'Latencia casi nula para decisiones en tiempo real',
                        'Demanda eléctrica de centros de datos IA: +17% anual hasta 2026',
                        'Capacidad para millones de dispositivos por km²'
                    ]
                },
                {
                    subtitle: 'IA Agéntica en la Red',
                    points: [
                        'Sensores que ejecutan decisiones de equilibrio de carga localmente',
                        'Prevención autónoma de apagones',
                        'Edge Computing para procesamiento distribuido',
                        'Optimización predictiva de consumo'
                    ]
                }
            ]
        },
        {
            title: 'Arquitectura Modular Blockchain',
            icon: Binary,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            content: [
                {
                    subtitle: 'Separación de Capas',
                    points: [
                        'Ejecución, liquidación, disponibilidad de datos y consenso independientes',
                        'Rendimiento superior a 10,000 TPS',
                        'Costos marginales de $0.001 por operación',
                        'Optimización individual de cada componente'
                    ]
                },
                {
                    subtitle: 'Estándares y Cumplimiento',
                    points: [
                        'ERC-3643 para tokens con lógica de cumplimiento integrada',
                        'Auditoría inmutable para certificaciones ESG',
                        'Smart contracts para liquidación automática',
                        'Interoperabilidad entre cadenas'
                    ]
                }
            ]
        },
        {
            title: 'Seguridad Zero Trust',
            icon: Shield,
            color: 'text-red-400',
            bgColor: 'bg-red-500/10',
            content: [
                {
                    subtitle: 'Infraestructura Crítica',
                    points: [
                        'Smart Cities gestionan infraestructura crítica nacional',
                        'Verificación continua de cada dispositivo conectado',
                        'Prevención proactiva de ciberataques',
                        'Segmentación de red para aislar amenazas'
                    ]
                },
                {
                    subtitle: 'DevSecOps en Blockchain',
                    points: [
                        'CI/CD adaptado para contratos inteligentes',
                        'Pruebas automatizadas con Hardhat/Truffle',
                        'Análisis de seguridad con Slither/Mythril',
                        'Auditorías pre-producción obligatorias'
                    ]
                }
            ]
        }
    ];

    // Key statistics
    const keyStats = [
        { label: 'Inversión Total', value: '$1M - $4.5M+', icon: Euro },
        { label: 'Ciclo Desarrollo', value: '4-24 meses', icon: Clock },
        { label: 'Áreas de Desarrollo', value: '5 proyectos', icon: Target },
        { label: 'Demanda IA/DC', value: '+17% anual', icon: TrendingUp }
    ];

    // Megatrends
    const megatrends = [
        {
            title: 'Digitalización',
            description: 'Infraestructura de red como "cerebro" conectando centros de datos con energía renovable',
            icon: Cpu,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            title: 'Seguridad',
            description: 'Zero Trust y verificación continua para infraestructura crítica urbana',
            icon: Lock,
            color: 'from-red-500 to-pink-500'
        },
        {
            title: 'Descarbonización',
            description: 'Tokenización de carbono y trazabilidad Net Zero para objetivos ESG',
            icon: Leaf,
            color: 'from-green-500 to-emerald-500'
        }
    ];

    // Technology stack
    const techStack = [
        { name: 'ZK-Rollups', description: 'Compresión de micro-transacciones', icon: Binary },
        { name: 'Edge AI', description: 'Procesamiento en <0.3s', icon: Cpu },
        { name: 'Smart Grids', description: 'Redes eléctricas inteligentes', icon: Zap },
        { name: 'Digital Twins', description: 'Simulación planetaria', icon: Globe },
        { name: 'IoT Sensors', description: 'Red distribuida de sensores', icon: Activity },
        { name: '6G Networks', description: 'Latencia casi nula', icon: Wifi }
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
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 mb-6">
                        <Zap className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Fondo de Desarrollo
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                            Energía y Smart Cities
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-4xl mx-auto">
                        Hacia la infraestructura predictiva: convergencia de SDKs especializados en tokenización RWA,
                        IoT e IA que transforman la base de la infraestructura financiera y operativa de las ciudades del futuro.
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
                            <stat.icon className="w-6 h-6 mx-auto mb-2 text-green-400" />
                            <div className="text-2xl font-bold text-white">{stat.value}</div>
                            <div className="text-sm text-gray-400">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>

                {/* Megatrends */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-green-400" />
                        Tres Megatendencias 2026
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        {megatrends.map((trend, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + idx * 0.1 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6"
                            >
                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${trend.color} flex items-center justify-center mb-4`}>
                                    <trend.icon className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{trend.title}</h3>
                                <p className="text-gray-400">{trend.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Development Areas Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Building2 className="w-6 h-6 text-green-400" />
                        Áreas de Desarrollo - Proyección 2026
                    </h2>

                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden">
                        {/* Table Header - Desktop */}
                        <div className="hidden lg:grid lg:grid-cols-6 gap-4 p-4 bg-gray-900/50 border-b border-gray-700/50 text-sm font-semibold text-gray-400">
                            <div>Área de Desarrollo</div>
                            <div>Tipo de Desarrollo</div>
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
                                        <div className="text-green-400 font-medium">{area.cost}</div>
                                        <div className="text-gray-300">{area.timeline}</div>
                                        <div className="text-emerald-400 text-sm">{area.keyFocus}</div>
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
                        <Server className="w-6 h-6 text-green-400" />
                        Stack Tecnológico
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {techStack.map((tech, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.55 + idx * 0.05 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center hover:border-green-500/50 transition-colors"
                            >
                                <tech.icon className="w-8 h-8 mx-auto mb-2 text-green-400" />
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
                        <Gauge className="w-6 h-6 text-green-400" />
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
                                        <h4 className="text-sm font-semibold text-green-400 mb-2">
                                            {subsection.subtitle}
                                        </h4>
                                        <ul className="space-y-2">
                                            {subsection.points.map((point, pointIdx) => (
                                                <li key={pointIdx} className="flex items-start gap-2 text-sm text-gray-300">
                                                    <span className="text-green-400 mt-1">•</span>
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

                {/* Cost of Inaction Warning */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="mb-16 bg-gradient-to-r from-amber-500/10 to-red-500/10 border border-amber-500/30 rounded-2xl p-6"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <Activity className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2">Costo de la Inacción</h3>
                            <p className="text-gray-300">
                                Las redes que no invierten en digitalización enfrentan cuellos de botella que impiden el crecimiento
                                de centros de datos de IA, cuya demanda eléctrica crecerá un <span className="text-amber-400 font-bold">17% anual</span> hasta 2026.
                                La transición hacia arquitecturas modulares y sistemas descentralizados no es opcional:
                                es requisito para participar en la economía digital del futuro.
                            </p>
                        </div>
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
                        <Globe className="w-6 h-6 text-green-400" />
                        Sectores Relacionados
                    </h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <Link to="/dao/salud-biotecnologia" className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-red-500/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-red-400 transition-colors">Salud y Biotecnología</div>
                                    <div className="text-sm text-gray-400">Datos verificables y ensayos digitales</div>
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
                                    <div className="text-sm text-gray-400">Fábricas inteligentes y mantenimiento predictivo</div>
                                </div>
                            </div>
                        </Link>
                        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white">Banca y Fintech</div>
                                    <div className="text-sm text-gray-400">Mercados de capitales programables</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Call to Action */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="text-center bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-2xl p-8"
                >
                    <h2 className="text-2xl font-bold mb-4">¿Listo para construir ciudades del futuro?</h2>
                    <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                        Tu voto y contribución ayudan a financiar la infraestructura predictiva que transformará
                        la gestión energética, la movilidad urbana y la sostenibilidad de nuestras ciudades.
                    </p>
                    <Link
                        to="/dao-page"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-semibold text-white hover:from-green-600 hover:to-emerald-600 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Volver a votar
                    </Link>
                </motion.div>
            </div>
        </div>
    );
};

export default EnergiaSmartCitiesFundPage;
