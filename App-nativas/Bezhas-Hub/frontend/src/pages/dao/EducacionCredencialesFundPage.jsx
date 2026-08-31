import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    GraduationCap,
    Award,
    Bot,
    Fingerprint,
    BookOpen,
    Users,
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
    FileCheck,
    Zap,
    Eye,
    BarChart3,
    Building2,
    Thermometer,
    Lightbulb,
    Share2,
    BadgeCheck,
    BrainCircuit,
    School,
    UserCheck,
    Landmark,
    Truck,
    HeartPulse
} from 'lucide-react';

/**
 * EducacionCredencialesFundPage - Detailed explanation of the Education & Credentials Development Fund
 * This page explains how the DAO fund will be used to develop Education & Credentials solutions
 */
const EducacionCredencialesFundPage = () => {
    // Development areas data
    const developmentAreas = [
        {
            name: 'Micro-credenciales y NFTs',
            type: 'I+D / Blockchain Verificable',
            scalability: 'Uso de Capa 2 (L2) para reducir costos de emisión en un 90%',
            cost: '$2,500 - $20,000+ (SaaS) o $40k-$150k (Custom)',
            timeline: '2-5 meses',
            keyFocus: 'Estándares W3C Verifiable Credentials y Open Badges',
            icon: Award,
            color: 'from-yellow-500 to-amber-500'
        },
        {
            name: 'Universidad Agéntica',
            type: 'IA I+D / Multi-Agent Systems',
            scalability: 'Orquestación de agentes para admisión y tutorías Socráticas',
            cost: '$150,000 - $500,000+',
            timeline: '6-12 meses',
            keyFocus: '"Do-Bots" que validan documentos internacionales en milisegundos',
            icon: Bot,
            color: 'from-purple-500 to-pink-500'
        },
        {
            name: 'Smart Campus (Mini-Ciudad)',
            type: 'IoT / Sensores de Ocupación y Energía',
            scalability: 'Arquitectura Edge-Cloud para gestión de recursos en tiempo real',
            cost: '$50,000 - $180,000 (Piloto inicial)',
            timeline: '4-8 meses',
            keyFocus: 'Control automático de HVAC/Iluminación y seguridad biométrica',
            icon: Building2,
            color: 'from-green-500 to-emerald-500'
        },
        {
            name: 'Rutas de Aprendizaje Adaptativas',
            type: 'IA I+D / Analítica Predictiva',
            scalability: 'Modelos LLM/SLM locales para personalización masiva de contenido',
            cost: '$100,000 - $350,000',
            timeline: '5-10 meses',
            keyFocus: 'Identificación predictiva de riesgo de abandono escolar',
            icon: BrainCircuit,
            color: 'from-cyan-500 to-blue-500'
        },
        {
            name: 'Identidad Digital Estudiantil (SSI)',
            type: 'I+D / Criptografía ZK',
            scalability: 'ZK-Proofs para demostrar competencias sin revelar datos privados',
            cost: '$30,000 - $80,000 (Módulo de identidad)',
            timeline: '3-6 meses',
            keyFocus: 'Soberanía de datos del estudiante (Self-Sovereign Identity)',
            icon: Fingerprint,
            color: 'from-indigo-500 to-violet-500'
        }
    ];

    // Deep dive sections
    const deepDiveSections = [
        {
            title: 'IA Agéntica: Conserjes Digitales 24/7',
            icon: Bot,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            content: [
                {
                    subtitle: 'Automatización de Admisiones',
                    points: [
                        'Agentes autónomos que verifican credenciales internacionales',
                        'Detección de fraudes documentales en milisegundos',
                        'Cálculo automático de elegibilidad de becas',
                        'Reducción del tiempo de decisión de semanas a minutos'
                    ]
                },
                {
                    subtitle: 'Tutores Socráticos Personalizados',
                    points: [
                        'Sistemas que guían mediante el diálogo, no respuestas directas',
                        'Adaptación de dificultad basada en rendimiento en tiempo real',
                        'Registro de progreso inmutable en blockchain',
                        'Intervención temprana en estudiantes en riesgo'
                    ]
                }
            ]
        },
        {
            title: 'IoT y Campus Inteligentes',
            icon: Wifi,
            color: 'text-green-400',
            bgColor: 'bg-green-500/10',
            content: [
                {
                    subtitle: 'Gestión de Energía y Sostenibilidad',
                    points: [
                        'Sensores de ocupación que ajustan temperatura y sonido',
                        'Optimización basada en presencia real de estudiantes',
                        'Control automático de HVAC e iluminación',
                        'Contribución directa a sostenibilidad institucional'
                    ]
                },
                {
                    subtitle: 'Seguridad Biométrica Integrada',
                    points: [
                        'RFID y sensores biométricos para control de acceso',
                        'Protección de áreas restringidas y laboratorios',
                        'Integración con identidad digital estudiantil on-chain',
                        'Trazabilidad completa de accesos y permisos'
                    ]
                }
            ]
        },
        {
            title: 'Credenciales Verificables',
            icon: Award,
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/10',
            content: [
                {
                    subtitle: 'Estándares Globales',
                    points: [
                        'W3C Verifiable Credentials para interoperabilidad total',
                        'Open Badges 3.0 para micro-credenciales apilables',
                        'Compatibilidad con eIDAS 2.0 para reconocimiento europeo',
                        'Portabilidad entre instituciones y países'
                    ]
                },
                {
                    subtitle: 'NFTs Académicos',
                    points: [
                        'Títulos y certificados como activos digitales únicos',
                        'Verificación instantánea por empleadores en cualquier lugar',
                        'Eliminación total de falsificación de credenciales',
                        'Historial académico inmutable y auditable'
                    ]
                }
            ]
        },
        {
            title: 'DevOps Educativo y CI/CD',
            icon: Server,
            color: 'text-red-400',
            bgColor: 'bg-red-500/10',
            content: [
                {
                    subtitle: 'CI/CD para Smart Contracts Académicos',
                    points: [
                        'Despliegue de actualizaciones sin errores en reglas de certificación',
                        'Cumplimiento automático con estándares globales (eIDAS 2.0)',
                        'Análisis estático con Slither/Mythril para seguridad',
                        'Protección de integridad de registros académicos'
                    ]
                },
                {
                    subtitle: 'Infraestructura Escalable',
                    points: [
                        'Arquitecturas modulares para crecimiento horizontal',
                        'Interoperabilidad entre LMS de nueva generación',
                        'APIs abiertas para integración con redes de talento',
                        'Monitoreo continuo de disponibilidad y rendimiento'
                    ]
                }
            ]
        }
    ];

    // Key statistics
    const keyStats = [
        { label: 'Inversión Total', value: '$332K - $1.18M+', icon: Euro },
        { label: 'Ciclo Desarrollo', value: '2-12 meses', icon: Clock },
        { label: 'Áreas de Desarrollo', value: '5 proyectos', icon: Target },
        { label: 'Reducción Costos', value: 'Hasta 90%', icon: TrendingUp }
    ];

    // ROI Benefits
    const roiBenefits = [
        {
            title: 'Reducción de Costos',
            description: 'Gastos administrativos de emisión y envío de títulos',
            icon: Euro,
            stat: '70-90%'
        },
        {
            title: 'Impacto de Marca',
            description: 'Impresiones orgánicas por cada credencial compartida',
            icon: Share2,
            stat: '1,500+'
        },
        {
            title: 'Prevención de Fraude',
            description: 'Eliminación de riesgo de falsificación de títulos',
            icon: Shield,
            stat: '100%'
        },
        {
            title: 'Tiempo de Verificación',
            description: 'De días/semanas a verificación instantánea',
            icon: Zap,
            stat: '<1s'
        }
    ];

    // University AI-First pillars
    const universityPillars = [
        {
            title: 'Micro-credenciales Apilables',
            description: 'Competencias verificables que se acumulan hacia títulos completos',
            icon: Award,
            color: 'from-yellow-500 to-amber-500'
        },
        {
            title: 'Agentes de Ciclo de Vida',
            description: 'IA que gestiona desde captación hasta inserción laboral',
            icon: Bot,
            color: 'from-purple-500 to-pink-500'
        },
        {
            title: 'Soberanía del Estudiante',
            description: 'El estudiante como dueño de su progreso y credenciales',
            icon: Fingerprint,
            color: 'from-indigo-500 to-violet-500'
        }
    ];

    // Technology stack
    const techStack = [
        { name: 'W3C VCs', description: 'Credenciales verificables', icon: BadgeCheck },
        { name: 'Open Badges', description: 'Micro-credenciales', icon: Award },
        { name: 'ZK-Proofs', description: 'Privacidad SSI', icon: Lock },
        { name: 'Multi-Agent AI', description: 'Tutores autónomos', icon: Bot },
        { name: 'Edge Computing', description: 'IoT Campus', icon: Cpu },
        { name: 'L2 Rollups', description: 'Emisión económica', icon: Binary }
    ];

    // Use cases
    const useCases = [
        {
            title: 'Admisión Autónoma',
            description: 'Agentes que verifican documentos y calculan elegibilidad en minutos',
            icon: UserCheck,
            color: 'from-purple-500 to-indigo-500'
        },
        {
            title: 'Tutorías Socráticas',
            description: 'IA que guía mediante diálogo adaptativo sin dar respuestas directas',
            icon: BookOpen,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            title: 'Campus Sostenible',
            description: 'IoT para optimizar energía y seguridad en tiempo real',
            icon: Building2,
            color: 'from-green-500 to-emerald-500'
        },
        {
            title: 'Empleabilidad Verificada',
            description: 'Credenciales compartibles que conectan con redes de talento globales',
            icon: Globe,
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
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 mb-6">
                        <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Fondo de Desarrollo
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                            Educación y Credenciales
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-4xl mx-auto">
                        Hacia la Universidad Agéntica y Soberana: donde los agentes de IA gestionan el ciclo de vida
                        del estudiante, desde la captación hasta la inserción laboral, con credenciales verificables
                        que empoderan al estudiante como dueño soberano de su progreso profesional.
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
                            <stat.icon className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                            <div className="text-2xl font-bold text-white">{stat.value}</div>
                            <div className="text-sm text-gray-400">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>

                {/* University AI-First Pillars */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <School className="w-6 h-6 text-yellow-400" />
                        Universidad Agéntica 2026
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        {universityPillars.map((pillar, idx) => (
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

                {/* ROI Benefits Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-yellow-400" />
                        Retorno de Inversión (ROI)
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {roiBenefits.map((benefit, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 + idx * 0.05 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <benefit.icon className="w-8 h-8 text-yellow-400" />
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
                        <GraduationCap className="w-6 h-6 text-yellow-400" />
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
                                        <div className="text-yellow-400 font-medium">{area.cost}</div>
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
                        <Globe className="w-6 h-6 text-yellow-400" />
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
                        <Server className="w-6 h-6 text-yellow-400" />
                        Stack Tecnológico
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {techStack.map((tech, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.65 + idx * 0.05 }}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center hover:border-yellow-500/50 transition-colors"
                            >
                                <tech.icon className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
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
                        <BarChart3 className="w-6 h-6 text-yellow-400" />
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
                                        <h4 className="text-sm font-semibold text-yellow-400 mb-2">
                                            {subsection.subtitle}
                                        </h4>
                                        <ul className="space-y-2">
                                            {subsection.points.map((point, pointIdx) => (
                                                <li key={pointIdx} className="flex items-start gap-2 text-sm text-gray-300">
                                                    <span className="text-yellow-400 mt-1">•</span>
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
                        <Network className="w-6 h-6 text-yellow-400" />
                        Sectores Relacionados
                    </h2>
                    <div className="grid md:grid-cols-4 gap-4">
                        <Link to="/dao/banca-fintech" className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-blue-500/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">Banca y Fintech</div>
                                    <div className="text-sm text-gray-400">Finanzas agénticas y scoring IA</div>
                                </div>
                            </div>
                        </Link>
                        <Link to="/dao/gobierno-gobernanza" className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-slate-500/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-500 to-zinc-500 flex items-center justify-center">
                                    <Landmark className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-slate-400 transition-colors">Gobierno y Gobernanza</div>
                                    <div className="text-sm text-gray-400">SSI y voto electrónico ZK</div>
                                </div>
                            </div>
                        </Link>
                        <Link to="/dao/logistica-supply-chain" className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-orange-500/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                                    <Truck className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-orange-400 transition-colors">Logística y Supply Chain</div>
                                    <div className="text-sm text-gray-400">DAGs y trazabilidad total</div>
                                </div>
                            </div>
                        </Link>
                        <Link to="/dao/salud-biotecnologia" className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-pink-500/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                                    <HeartPulse className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-pink-400 transition-colors">Salud y Biotecnología</div>
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
                    className="text-center bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl p-8"
                >
                    <h2 className="text-2xl font-bold mb-4">¿Listo para revolucionar la educación?</h2>
                    <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                        Tu voto y contribución ayudan a financiar la infraestructura que transformará
                        la educación tradicional en un ecosistema de aprendizaje personalizado, verificable
                        y soberano, donde el estudiante es dueño de su progreso profesional.
                    </p>
                    <Link
                        to="/dao-page"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl font-semibold text-white hover:from-yellow-600 hover:to-orange-600 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Volver a votar
                    </Link>
                </motion.div>
            </div>
        </div>
    );
};

export default EducacionCredencialesFundPage;
