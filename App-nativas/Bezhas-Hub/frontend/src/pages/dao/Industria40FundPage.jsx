import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Factory,
    Cpu,
    Cloud,
    Box,
    Wrench,
    Link2,
    TrendingUp,
    Clock,
    Euro,
    Target,
    Layers,
    Brain,
    Wifi,
    Server,
    Shield
} from 'lucide-react';

/**
 * Industria40FundPage - Detailed explanation of the Industry 4.0 Development Fund
 * This page explains how the DAO fund will be used to develop Industry 4.0 solutions
 */
const Industria40FundPage = () => {
    // Development areas data
    const developmentAreas = [
        {
            name: 'Self-Healing Factory',
            type: 'Mantenimiento Predictivo + Automatización',
            scalability: 'Microservicios modulares para distintas líneas de producción',
            cost: '€8M - €12M',
            timeline: '24-36 meses',
            roi: 'Reducción 40-60% downtime no planificado',
            icon: Factory,
            color: 'from-orange-500 to-red-500'
        },
        {
            name: 'Edge-to-Cloud Data Pipeline',
            type: 'Infraestructura IoT',
            scalability: 'Arquitectura fog computing escalable por zona geográfica',
            cost: '€5M - €8M',
            timeline: '18-24 meses',
            roi: 'Latencia <10ms para decisiones en tiempo real',
            icon: Cloud,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            name: 'Digital Twin Platform',
            type: 'Simulación y Optimización',
            scalability: 'Gemelos digitales federados por planta/unidad de negocio',
            cost: '€6M - €10M',
            timeline: '24-30 meses',
            roi: 'Reducción 25-35% costes de prototipado',
            icon: Box,
            color: 'from-purple-500 to-pink-500'
        },
        {
            name: 'Predictive Quality Control',
            type: 'ML para Control de Calidad',
            scalability: 'Modelos federados que aprenden de múltiples líneas',
            cost: '€4M - €7M',
            timeline: '18-24 meses',
            roi: 'Reducción 50-70% defectos en producción',
            icon: Wrench,
            color: 'from-green-500 to-emerald-500'
        },
        {
            name: 'Blockchain + RPA Integration',
            type: 'Trazabilidad + Automatización',
            scalability: 'Smart contracts modulares por caso de uso industrial',
            cost: '€3M - €5M',
            timeline: '12-18 meses',
            roi: 'Trazabilidad 100% + reducción 60% tareas manuales',
            icon: Link2,
            color: 'from-indigo-500 to-violet-500'
        }
    ];

    // Deep dive sections
    const deepDiveSections = [
        {
            title: 'Inteligencia Artificial Industrial',
            icon: Brain,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            content: [
                {
                    subtitle: 'Machine Learning para Predicción',
                    points: [
                        'Modelos de series temporales para predecir fallos de maquinaria',
                        'Redes neuronales convolucionales para inspección visual automatizada',
                        'Reinforcement Learning para optimización de procesos en tiempo real',
                        'Transfer Learning para reutilizar modelos entre diferentes plantas'
                    ]
                },
                {
                    subtitle: 'Procesamiento de Lenguaje Natural',
                    points: [
                        'Análisis automático de reportes de mantenimiento y incidencias',
                        'Asistentes virtuales para operarios de planta',
                        'Extracción de conocimiento de manuales técnicos legacy'
                    ]
                }
            ]
        },
        {
            title: 'Internet of Things (IoT) Industrial',
            icon: Wifi,
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            content: [
                {
                    subtitle: 'Infraestructura de Sensores',
                    points: [
                        'Sensores de vibración, temperatura, presión y humedad',
                        'Gateways industriales con procesamiento edge',
                        'Protocolos OPC-UA, MQTT y Modbus para interoperabilidad',
                        'Redes LoRaWAN y 5G privado para conectividad robusta'
                    ]
                },
                {
                    subtitle: 'Edge Computing',
                    points: [
                        'Procesamiento local para decisiones en milisegundos',
                        'Reducción de ancho de banda hacia la nube',
                        'Autonomía operativa ante pérdidas de conectividad'
                    ]
                }
            ]
        },
        {
            title: 'Gemelos Digitales',
            icon: Layers,
            color: 'text-pink-400',
            bgColor: 'bg-pink-500/10',
            content: [
                {
                    subtitle: 'Modelado y Simulación',
                    points: [
                        'Réplicas virtuales de líneas de producción completas',
                        'Simulación de escenarios "what-if" sin riesgo',
                        'Optimización de layouts y flujos de materiales',
                        'Entrenamiento de operarios en entornos virtuales seguros'
                    ]
                },
                {
                    subtitle: 'Sincronización en Tiempo Real',
                    points: [
                        'Actualización continua desde sensores IoT',
                        'Visualización 3D interactiva del estado de planta',
                        'Detección temprana de desviaciones del comportamiento esperado'
                    ]
                }
            ]
        },
        {
            title: 'Blockchain Industrial',
            icon: Shield,
            color: 'text-indigo-400',
            bgColor: 'bg-indigo-500/10',
            content: [
                {
                    subtitle: 'Trazabilidad de Cadena de Suministro',
                    points: [
                        'Registro inmutable de proveniencia de materias primas',
                        'Certificación automática de cumplimiento normativo',
                        'Tokenización de activos industriales (maquinaria, inventario)',
                        'Smart contracts para pagos automáticos entre proveedores'
                    ]
                },
                {
                    subtitle: 'Gobernanza Descentralizada',
                    points: [
                        'DAOs para gestión colaborativa de ecosistemas industriales',
                        'Votaciones transparentes sobre estándares y protocolos',
                        'Distribución equitativa de incentivos por contribución'
                    ]
                }
            ]
        }
    ];

    // Timeline phases
    const timelinePhases = [
        {
            phase: 'Fase 1: Fundamentos',
            duration: '0-12 meses',
            budget: '€8M',
            activities: [
                'Infraestructura IoT base y edge computing',
                'Primeros pilotos de mantenimiento predictivo',
                'Integración blockchain para trazabilidad básica'
            ]
        },
        {
            phase: 'Fase 2: Escalado',
            duration: '12-24 meses',
            budget: '€12M',
            activities: [
                'Despliegue de gemelos digitales por planta',
                'Control de calidad con visión por computador',
                'Expansión de red de sensores'
            ]
        },
        {
            phase: 'Fase 3: Optimización',
            duration: '24-36 meses',
            budget: '€10M',
            activities: [
                'Self-healing factory completa',
                'IA avanzada para optimización autónoma',
                'Federación de modelos entre plantas'
            ]
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
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 mb-6">
                        <Factory className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Fondo de Desarrollo
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                            Industria 4.0
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        Transformando la manufactura española mediante tecnologías de vanguardia:
                        IA, IoT, Gemelos Digitales y Blockchain Industrial.
                    </p>
                </motion.div>

                {/* Key Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
                >
                    {[
                        { label: 'Inversión Total', value: '€26M - €42M', icon: Euro },
                        { label: 'Duración', value: '36 meses', icon: Clock },
                        { label: 'Áreas de Desarrollo', value: '5 proyectos', icon: Target },
                        { label: 'ROI Esperado', value: '40-70%', icon: TrendingUp }
                    ].map((stat, idx) => (
                        <div key={idx} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
                            <stat.icon className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                            <div className="text-2xl font-bold text-white">{stat.value}</div>
                            <div className="text-sm text-gray-400">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>

                {/* Development Areas Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Cpu className="w-6 h-6 text-orange-400" />
                        Áreas de Desarrollo
                    </h2>

                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden">
                        {/* Table Header - Desktop */}
                        <div className="hidden lg:grid lg:grid-cols-6 gap-4 p-4 bg-gray-900/50 border-b border-gray-700/50 text-sm font-semibold text-gray-400">
                            <div>Proyecto</div>
                            <div>Tipo</div>
                            <div>Estrategia de Escalabilidad</div>
                            <div>Inversión</div>
                            <div>Timeline</div>
                            <div>ROI Esperado</div>
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
                                                <div className="text-gray-400 text-xs">Inversión</div>
                                                <div className="text-white font-medium">{area.cost}</div>
                                            </div>
                                            <div className="bg-gray-700/30 rounded-lg p-2">
                                                <div className="text-gray-400 text-xs">Timeline</div>
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
                                        <div className="text-gray-300">{area.type}</div>
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

                {/* Deep Dive Sections */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Server className="w-6 h-6 text-orange-400" />
                        Tecnologías en Profundidad
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

                {/* Implementation Timeline */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mb-16"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Clock className="w-6 h-6 text-orange-400" />
                        Cronograma de Implementación
                    </h2>

                    <div className="grid md:grid-cols-3 gap-6">
                        {timelinePhases.map((phase, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.7 + idx * 0.1 }}
                                className="relative bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6"
                            >
                                {/* Phase number badge */}
                                <div className="absolute -top-3 left-6 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-sm font-bold">
                                    {idx + 1}
                                </div>

                                <h3 className="text-lg font-bold text-white mt-2 mb-1">{phase.phase}</h3>
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="text-sm text-gray-400 flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {phase.duration}
                                    </span>
                                    <span className="text-sm text-orange-400 flex items-center gap-1">
                                        <Euro className="w-4 h-4" />
                                        {phase.budget}
                                    </span>
                                </div>

                                <ul className="space-y-2">
                                    {phase.activities.map((activity, actIdx) => (
                                        <li key={actIdx} className="flex items-start gap-2 text-sm text-gray-300">
                                            <span className="text-green-400 mt-0.5">✓</span>
                                            <span>{activity}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Call to Action */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="text-center bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-2xl p-8"
                >
                    <h2 className="text-2xl font-bold mb-4">¿Listo para transformar la industria?</h2>
                    <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                        Tu voto y contribución ayudan a financiar el desarrollo de estas tecnologías
                        que revolucionarán la manufactura en España y Latinoamérica.
                    </p>
                    <Link
                        to="/dao-page"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl font-semibold text-white hover:from-orange-600 hover:to-red-600 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Volver a votar
                    </Link>
                </motion.div>
            </div>
        </div>
    );
};

export default Industria40FundPage;
