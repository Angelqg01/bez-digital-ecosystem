import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    HeartPulse,
    Pill,
    Hospital,
    Coins,
    FlaskConical,
    FileCheck,
    TrendingUp,
    Clock,
    Euro,
    Target,
    Brain,
    Wifi,
    Shield,
    Database,
    Activity,
    Stethoscope,
    Microscope,
    Users,
    Lock
} from 'lucide-react';

/**
 * SaludBiotecFundPage - Detailed explanation of the Health & Biotechnology Development Fund
 * This page explains how the DAO fund will be used to develop Health & Biotech solutions
 */
const SaludBiotecFundPage = () => {
    // Development areas data
    const developmentAreas = [
        {
            name: 'Descubrimiento de Fármacos (AI-I+D)',
            type: 'Motores predictivos y simulación molecular',
            scalability: 'Supercomputadoras para simulaciones y modelos "Caja de Cristal"',
            cost: '$100,000 - $1.5M+',
            timeline: '6-18 meses (Fase preclínica)',
            keyFocus: 'Reemplazo de cribado masivo por diseño racional in silico',
            icon: Pill,
            color: 'from-purple-500 to-indigo-500'
        },
        {
            name: 'Hospital Inteligente e IoMT',
            type: 'Sensores usables y monitoreo remoto (RPM)',
            scalability: 'Arquitectura Edge-Cloud; 5G para latencia <22ms en cirugía robótica',
            cost: '$20,000 - $110,000 (por centro)',
            timeline: '3-6 meses (Piloto RPM)',
            keyFocus: 'Gemelos digitales para predecir emergencias días antes',
            icon: Hospital,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            name: 'Tokenización de Activos (RWA)',
            type: 'Fraccionalización de patentes, equipos y datos clínicos',
            scalability: 'Capa 2 (Polygon/Base) para reducir costos de gas',
            cost: '$100,000 - $450,000',
            timeline: '4-9 meses (Lanzamiento)',
            keyFocus: 'Democratización de inversión en biotecnología',
            icon: Coins,
            color: 'from-amber-500 to-orange-500'
        },
        {
            name: 'Ensayos Clínicos Digitales',
            type: '"Tokenización" de pacientes y recolección pasiva de datos',
            scalability: 'Desidentificación masiva y vinculación RWD',
            cost: '$300,000+',
            timeline: '6-12 meses',
            keyFocus: 'Monitoreo continuo no invasivo',
            icon: FlaskConical,
            color: 'from-green-500 to-emerald-500'
        },
        {
            name: 'Cumplimiento y Regulación',
            type: 'Automatización de sumisiones FDA/EMA',
            scalability: 'Policy-as-Code integrado desde el día 1',
            cost: '$26,067 (FDA 510k Standard Fee)',
            timeline: '2-4 meses',
            keyFocus: 'Respuestas regulatorias en 2 días vs semanas',
            icon: FileCheck,
            color: 'from-red-500 to-pink-500'
        }
    ];

    // Deep dive sections
    const deepDiveSections = [
        {
            title: 'IA Agéntica y el Fin del "Cribado Masivo"',
            icon: Brain,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            content: [
                {
                    subtitle: 'Diseño Racional de Fármacos',
                    points: [
                        'Agentes de IA como "detectives digitales" que modelan comportamiento de proteínas',
                        'Nominación de candidatos a fármacos en meses en lugar de años',
                        'SDKs modulares (Microsoft Agent Framework) para orquestar agentes especializados',
                        'Predicción de toxicidad y optimización de química del compuesto'
                    ]
                },
                {
                    subtitle: 'Impacto Económico',
                    points: [
                        'ROI del 20-30% al reducir capital desperdiciado',
                        'Eliminación de candidatos que fallarían en etapas tardías',
                        'Reducción de costes de desarrollo preclínico en hasta 60%'
                    ]
                }
            ]
        },
        {
            title: 'IoT y el Modelo "Hospital-at-Home"',
            icon: Wifi,
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            content: [
                {
                    subtitle: 'Monitoreo Remoto de Pacientes (RPM)',
                    points: [
                        'Fusión de telemedicina con dispositivos IoMT',
                        'Desplazamiento del cuidado del hospital al hogar',
                        'Liberación de camas para pacientes críticos',
                        'Bombas de infusión, ventiladores y camas inteligentes conectadas'
                    ]
                },
                {
                    subtitle: 'Arquitectura Zero-Trust',
                    points: [
                        'Cada sensor debe autenticarse para evitar ciberataques',
                        'Reducción del 35% en pérdidas de equipo mediante tracking real-time',
                        'Costos operativos reducidos hasta 20% en departamentos intensivos'
                    ]
                }
            ]
        },
        {
            title: 'Tokenización de Activos del Mundo Real (RWA)',
            icon: Coins,
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
            content: [
                {
                    subtitle: 'Financiación Democratizada',
                    points: [
                        'Laboratorios pueden tokenizar su Propiedad Intelectual (IP)',
                        'Venta de propiedad fraccional a miles de inversores',
                        'Alternativa a rondas de capital de riesgo de $100M',
                        'Reducción del 40% en costos administrativos'
                    ]
                },
                {
                    subtitle: 'Transparencia y Autenticidad',
                    points: [
                        'Registros inmutables combaten fraude de medicamentos falsificados',
                        'Mercado de falsificaciones valorado en $250B anuales',
                        'Autenticación desde ingredientes crudos hasta paciente final'
                    ]
                }
            ]
        },
        {
            title: 'Desafíos de Escalabilidad y Datos',
            icon: Database,
            color: 'text-red-400',
            bgColor: 'bg-red-500/10',
            content: [
                {
                    subtitle: 'Gobernanza de Datos',
                    points: [
                        '68% de fallos en IA en salud por gobernanza de datos deficiente',
                        'Inversión en "Data Lakes" escalables',
                        'Tuberías de datos en streaming para decisiones en segundos',
                        'Datos actuales vs históricos para agentes de IA'
                    ]
                },
                {
                    subtitle: 'Infraestructura Crítica',
                    points: [
                        'Transición de silos de datos a infraestructuras computacionales continuas',
                        'SDKs modulares para acelerar descubrimiento de fármacos',
                        'Gestión de pacientes basada en agentes de IA'
                    ]
                }
            ]
        }
    ];

    // Key statistics
    const keyStats = [
        { label: 'Inversión Total', value: '$600K - $2.3M+', icon: Euro },
        { label: 'Ciclo Completo', value: '6-18 meses', icon: Clock },
        { label: 'Áreas de Desarrollo', value: '5 proyectos', icon: Target },
        { label: 'ROI Esperado', value: '20-40%', icon: TrendingUp }
    ];

    // Benefits list
    const benefits = [
        {
            title: 'Reducción del Tiempo de Desarrollo',
            description: 'De años a meses en descubrimiento de fármacos gracias a IA',
            icon: Clock,
            stat: '70%'
        },
        {
            title: 'Costos Operativos',
            description: 'Reducción mediante IoMT y automatización hospitalaria',
            icon: TrendingUp,
            stat: '-20%'
        },
        {
            title: 'Pérdida de Equipos',
            description: 'Reducción mediante tracking en tiempo real',
            icon: Activity,
            stat: '-35%'
        },
        {
            title: 'Costos Administrativos',
            description: 'Reducción mediante tokenización y smart contracts',
            icon: FileCheck,
            stat: '-40%'
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
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 mb-6">
                        <HeartPulse className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Fondo de Desarrollo
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400">
                            Salud y Biotecnología
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-4xl mx-auto">
                        Transitando de experimentación a ejecución industrial: convirtiendo procesos manuales
                        y silos de datos en infraestructuras computacionales continuas con SDKs modulares
                        y agentes de IA para acelerar el descubrimiento de fármacos y la gestión de pacientes.
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
                            <stat.icon className="w-6 h-6 mx-auto mb-2 text-red-400" />
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
                        <TrendingUp className="w-6 h-6 text-red-400" />
                        Impacto Esperado
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
                                    <benefit.icon className="w-8 h-8 text-red-400" />
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
                    transition={{ delay: 0.2 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Stethoscope className="w-6 h-6 text-red-400" />
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
                                        <div className="text-red-400 font-medium">{area.cost}</div>
                                        <div className="text-gray-300">{area.timeline}</div>
                                        <div className="text-green-400 text-sm">{area.keyFocus}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Deep Dive Sections */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Microscope className="w-6 h-6 text-red-400" />
                        Profundización en I+D
                    </h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        {deepDiveSections.map((section, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 + idx * 0.1 }}
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
                                        <h4 className="text-sm font-semibold text-red-400 mb-2">
                                            {subsection.subtitle}
                                        </h4>
                                        <ul className="space-y-2">
                                            {subsection.points.map((point, pointIdx) => (
                                                <li key={pointIdx} className="flex items-start gap-2 text-sm text-gray-300">
                                                    <span className="text-red-400 mt-1">•</span>
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

                {/* Security & Compliance Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Shield className="w-6 h-6 text-red-400" />
                        Seguridad y Cumplimiento Regulatorio
                    </h2>

                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                                <Lock className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="font-semibold text-white mb-2">Zero-Trust Architecture</h3>
                            <p className="text-sm text-gray-400">
                                Cada dispositivo IoMT debe autenticarse continuamente para prevenir ciberataques
                                en infraestructura crítica de salud.
                            </p>
                        </div>

                        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
                                <FileCheck className="w-6 h-6 text-green-400" />
                            </div>
                            <h3 className="font-semibold text-white mb-2">FDA/EMA Automation</h3>
                            <p className="text-sm text-gray-400">
                                Policy-as-Code integrado desde el día 1 permite generar respuestas a consultas
                                regulatorias en 2 días en lugar de semanas.
                            </p>
                        </div>

                        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                                <Users className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="font-semibold text-white mb-2">Privacidad del Paciente</h3>
                            <p className="text-sm text-gray-400">
                                Desidentificación masiva de datos y almacenamiento descentralizado para
                                proteger información sensible de pacientes.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Call to Action */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="text-center bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-2xl p-8"
                >
                    <h2 className="text-2xl font-bold mb-4">¿Listo para revolucionar la salud?</h2>
                    <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                        Tu voto y contribución ayudan a financiar el desarrollo de tecnologías que
                        acelerarán el descubrimiento de fármacos, mejorarán la atención al paciente
                        y democratizarán la inversión en biotecnología.
                    </p>
                    <Link
                        to="/dao-page"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl font-semibold text-white hover:from-red-600 hover:to-pink-600 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Volver a votar
                    </Link>
                </motion.div>
            </div>
        </div>
    );
};

export default SaludBiotecFundPage;
