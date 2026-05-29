import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Definición centralizada del "Journey" para cada ruta de la plataforma
const JOURNEYS = {
    '/': {
        title: "Inicio: Tu Panel Central",
        content: "Bienvenido a BeZhas. Aquí verás la actividad reciente y sugerencias de acciones. Interactúa, publica y gana $BEZ.",
        rules: ["No hagas spam o serás penalizado.", "Publica contenido de calidad para ganar interacción."]
    },
    '/vip': {
        title: "Club VIP BeZhas",
        content: "Potencia tu presencia. Cada nivel te otorga beneficios como $BEZ recurrentes, descuentos en marketplace, y acceso a herramientas de IA.",
        rules: ["Los beneficios se asignan mensualmente.", "El ROI es estimado según tu actividad."]
    },
    '/marketplace': {
        title: "Marketplace Web3",
        content: "Compra y vende activos usando dinero Fiat o $BEZ. Al usar $BEZ tienes descuentos automáticos gracias al ecosistema.",
        rules: ["Revisa la reputación del vendedor.", "Usa métodos nativos para ahorrar gas."]
    },
    '/wallet': {
        title: "Tu Billetera Digital",
        content: "Gestiona tu capital, retira ganancias o recarga fondos para interactuar con contratos inteligentes de BeZhas.",
        rules: ["Mantén parte de tu saldo para transacciones (gas).", "No compartas tu frase semilla jamás."]
    },
    '/defi': {
        title: "BeZhas DeFi Hub",
        content: "Pon a trabajar tus tokens haciendo Staking o proveyendo liquidez al pool. Multiplica tus ahorros pasivamente.",
        rules: ["Existen plazos de bloqueo según el pool.", "El APY es dinámico basado en la red."]
    },
    '/shop': {
        title: "Comercios BeZhas",
        content: "Explora las tiendas asociadas y utiliza tus tokens BEZ o euros para obtener productos únicos con beneficios exclusivos.",
        rules: ["Todas las transacciones son finales una vez en la blockchain.", "Usa nuestro escrow para pagos seguros."]
    },
    '/create': {
        title: "Centro de Creación",
        content: "Utiliza nuestras potentes IAs para generar contenido o acuña NFTs únicos que podrás vender a tu audiencia.",
        rules: ["Todo contenido originado aquí te pertenece.", "Costo en créditos o $BEZ dependiendo de tu plan VIP."]
    },
    '/dao': {
        title: "Gobernanza de BeZhas",
        content: "Como holder de $BEZ, tienes derecho a voto. Decide las próximas funcionalidades de la plataforma aportando al consenso.",
        rules: ["1 Token = 1 Poder de voto.", "Las propuestas requieren quorum para ser aplicadas."]
    },
    '/rwa': {
        title: "Activos del Mundo Real (RWA)",
        content: "Invierte en bienes físicos fraccionados mediante tokens on-chain, desde propiedades hasta obras de arte. Diversifica fuera de lo digital.",
        rules: ["El historial legal del activo es auditable on-chain.", "Liquida tus fracciones rápidamente en nuestro PoS (Punto de Venta)."]
    },
    '/real-estate': {
        title: "BeZhas Real Estate Game",
        content: "Gamificación inmobiliaria Web3. Aprende gestión de capital adquiriendo, alquilando y comerciando dominios comerciales virtuales con rédito en la vida real.",
        rules: ["Compra terrenos en zonas de alto tráfico.", "Usa tus tokens $BEZ ganados para escalar."]
    },
    '/logistics': {
        title: "Logística B2B y Trazabilidad",
        content: "Supervisa envíos y mercancías conectadas mediante IoT y Oráculos en tiempo real. Máxima transparencia en la cadena de suministro.",
        rules: ["Revisa KPIs para optimizar rutas.", "Cualquier disputa recurre a registros inmutables pasados."]
    },
    '/ad-center': {
        title: "Gestor de Anuncios Web3",
        content: "Lanza campañas de publicidad a nuestra audiencia altamente segmentada. Coste por impacto programático. Ajusta tu presupuesto y paga de manera automatizada.",
        rules: ["Aprovecha el pago en $BEZ para menor coste/impresión.", "Monitorea constantemente el CTR de conversión."]
    },
    '/chat': {
        title: "Comunicaciones y Soporte IA",
        content: "Centro de mensajería cifrada. Chatea con otros inversores o usa tu Asistente IA para consejos en inversiones, legalidad y soporte técnico 24/7.",
        rules: ["Mantén el decoro, el acoso está penalizado.", "El Asistente de IA no asume responsabilidad financiera legal."]
    },
    '/oracle': {
        title: "Oráculos de Calidad",
        content: "Obtén flujos de datos puros. Datos de precio en tiempo real, validación de APIs, o reputación comercial extraída y sincronizada para tus Smart Contracts.",
        rules: ["Aporta fuentes y obtén recompensas de validación.", "Consumir data intensamente requiere saldo $BEZ."]
    },
    '/profile': {
        title: "Tu Reputación y Estatus",
        content: "El centro personal donde la cadena de bloques almacena tu Karma, NFTs y métricas empresariales. Mantén un perfil reluciente.",
        rules: ["Conecta tus cuentas reales (LinkedIn, etc.) para +Trust Score.", "Sube de nivel participando y ganando misiones diarias."]
    },
    '/buy-tokens': {
        title: "Comprar $BEZ y Liquidez",
        content: "Rampa directa desde dinero fiat hacia Web3. Adquiere el pulmón del ecosistema directamente usando tarjetas de crédito, Google Pay o SEPA.",
        rules: ["Transacciones mayores requieren KYC rutinario.", "El precio del gas lo marca directamente la red, sin markup de BeZhas."]
    },
    '/admin': {
        title: "Centro de Control",
        content: "Panel de administración para la gestión métrica e inteligencia artificial (OpenClaw) desplegada en el entorno BeZhas.",
        rules: ["Los despliegues de módulos son auditados.", "Usa un rol autorizado para cambios permanentes."]
    }
};

const DEFAULT_JOURNEY = {
    title: "Explorando BeZhas",
    content: "Navega por las secciones para descubrir todas las herramientas de IA, Web3 y Finanzas descentralizadas que BeZhas tiene para ti.",
    rules: ["Sigue las guías comunitarias.", "Diviértete aportando valor."]
};

const JourneyOverlay = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [currentJourney, setCurrentJourney] = useState(DEFAULT_JOURNEY);

    useEffect(() => {
        // Encontrar si tenemos información configurada para esta ruta
        // Eliminamos trailing slashes o queries para emparejar
        const path = location.pathname.split('?')[0];
        
        let foundJourney = null;
        for (const [key, value] of Object.entries(JOURNEYS)) {
            if (path === key || (key !== '/' && path.startsWith(key))) {
                foundJourney = value;
                break;
            }
        }
        
        setCurrentJourney(foundJourney || DEFAULT_JOURNEY);
        
        // Auto-abrir ligeramente al cambiar de página por primera vez (opcional, lo dejamos cerrado por UX sin interrupciones severas, o mostrar un ping)
        // setIsOpen(true);
        // const t = setTimeout(() => setIsOpen(false), 5000);
        // return () => clearTimeout(t);
    }, [location.pathname]);

    return (
        <>
            {/* Botón flotante para abrir la ayuda */}
            <motion.button 
                className="fixed bottom-6 right-6 z-50 bg-[#0f1016] text-[#df00ffff] border border-[#df00ffff]/30 shadow-[0_0_15px_rgba(223,0,255,0.3)] rounded-full w-14 h-14 flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Guía de uso de la página"
            >
                <i className={`fas ${isOpen ? 'fa-times' : 'fa-lightbulb'} text-xl`}></i>
            </motion.button>

            {/* Modal/Overlay flotante de información de la página actual */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        transition={{ type: "spring", bounce: 0.4 }}
                        className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl"
                    >
                        <div className="absolute top-0 right-0 p-3" onClick={() => setIsOpen(false)}>
                            <i className="fas fa-times text-gray-400 hover:text-white cursor-pointer transition-colors"></i>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#df00ffff] to-[#00f2fe] flex items-center justify-center p-[2px]">
                                <div className="w-full h-full bg-black rounded-full flex items-center justify-center">
                                    <i className="fas fa-map-marked-alt text-transparent bg-clip-text bg-gradient-to-tr from-[#df00ffff] to-[#00f2fe]"></i>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-white tracking-wide">
                                {currentJourney.title}
                            </h3>
                        </div>

                        <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                            {currentJourney.content}
                        </p>

                        <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <i className="fas fa-shield-alt text-[#df00ffff]"></i> Reglas y Consejos
                            </h4>
                            <ul className="space-y-2 mt-2">
                                {currentJourney.rules.map((rule, idx) => (
                                    <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                        <i className="fas fa-check-circle text-green-400 mt-1 text-[10px]"></i>
                                        <span>{rule}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default JourneyOverlay;
