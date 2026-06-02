/**
 * Contenido de Guías Informativas para cada sección de Bezhas
 * Optimizado para resolver problemas comunes de los usuarios
 */

export const guideContent = {
    DAO: {
        title: "Gobernanza Descentralizada (DAO)",
        description: "La Organización Autónoma Descentralizada te permite participar activamente en las decisiones estratégicas de Bezhas. Cada token que posees te otorga poder de voto proporcional.",
        features: [
            "Creación y votación de propuestas on-chain con transparencia total",
            "Gestión democrática de la tesorería comunitaria",
            "Sistema de delegación de votos para usuarios ocupados",
            "Historial inmutable de todas las decisiones tomadas"
        ],
        useCases: [
            "💡 Propón nuevas funcionalidades o mejoras al ecosistema",
            "🗳️ Vota para aprobar cambios en tarifas, recompensas o parámetros",
            "💰 Solicita financiamiento para proyectos que beneficien a la comunidad",
            "🤝 Delega tu voto a expertos si no tienes tiempo de revisar propuestas",
            "📊 Consulta el estado y resultados de propuestas anteriores"
        ],
        commonIssues: [
            {
                problem: "¿No tengo suficientes tokens para votar?",
                solution: "Puedes delegar tu voto a otro miembro o acumular más tokens mediante staking o participando en quests."
            },
            {
                problem: "¿Cómo sé si una propuesta es legítima?",
                solution: "Todas las propuestas pasan por un periodo de discusión comunitaria. Revisa los comentarios y el perfil del creador."
            }
        ]
    },

    STAKING: {
        title: "Staking & Recompensas Pasivas",
        description: "Genera ingresos pasivos bloqueando tus tokens BEZHAS. Mientras contribuyes a la seguridad y liquidez de la red, acumulas recompensas diarias compuestas.",
        features: [
            "APY dinámico entre 8% - 45% según periodo de bloqueo",
            "Periodos flexibles: 7, 30, 90, 180 y 365 días",
            "Auto-compound opcional para maximizar ganancias",
            "Sin penalización en periodos cortos, bonos en largos",
            "Dashboard en tiempo real con proyección de ganancias"
        ],
        useCases: [
            "💎 Bloquea por 365 días y obtén el APY más alto + NFT exclusivo",
            "⚡ Staking de 7 días si necesitas liquidez pronto pero quieres ganar",
            "🎯 Aumenta tu poder de voto en la DAO mediante staking",
            "🏆 Accede a niveles VIP con staking acumulado superior a 10,000 BEZ",
            "📈 Reinvierte automáticamente tus recompensas diarias"
        ],
        commonIssues: [
            {
                problem: "¿Puedo retirar antes del periodo?",
                solution: "En periodos cortos (7-30 días) sí, pero pierdes las recompensas. En largos hay penalización del 5%."
            },
            {
                problem: "¿Cuándo recibo mis recompensas?",
                solution: "Se calculan cada bloque (cada ~2 seg) y puedes reclamarlas cuando quieras sin fees."
            }
        ]
    },

    RWA: {
        title: "Activos Tokenizados (RWA)",
        description: "Invierte en activos del mundo real tokenizados: bienes raíces, arte, commodities, vehículos. Accede a mercados tradicionalmente exclusivos con inversiones desde $10 USD.",
        features: [
            "Fraccionamiento: compra el % que puedas permitirte",
            "Liquidez 24/7 en mercado secundario descentralizado",
            "Documentación legal verificada por Oráculos de Calidad",
            "Dividendos automáticos proporcionales a tu participación",
            "Custodia verificable y auditoría pública"
        ],
        useCases: [
            "🏠 Invierte $100 en una propiedad de $500,000 y recibe rentas mensuales",
            "🎨 Compra 5% de una obra de arte que se revaloriza con el tiempo",
            "🚗 Tokeniza tu vehículo de lujo para obtener liquidez inmediata",
            "📦 Utiliza tus RWA como colateral en préstamos DeFi",
            "🌍 Diversifica globalmente sin intermediarios bancarios"
        ],
        commonIssues: [
            {
                problem: "¿Es legal comprar fracciones de propiedades?",
                solution: "Sí, cada RWA está respaldado por contratos legales verificados y auditados por terceros certificados."
            },
            {
                problem: "¿Cómo cobro los dividendos?",
                solution: "Se depositan automáticamente en tu wallet cada mes en USDC o BEZ según el activo."
            }
        ]
    },

    LOGISTICS: {
        title: "Trazabilidad & Supply Chain IoT",
        description: "Sistema de cadena de suministro inmutable conectado a sensores IoT. Garantiza autenticidad, calidad y transparencia total desde origen hasta destino.",
        features: [
            "Rastreo GPS en tiempo real con alertas automáticas",
            "Sensores IoT: temperatura, humedad, impactos, apertura",
            "Verificación de calidad on-chain mediante Quality Oracle",
            "Historial inmutable certificado por blockchain",
            "Liberación automática de pagos al cumplir condiciones"
        ],
        useCases: [
            "🍷 Verifica que tu vino importado mantuvo la temperatura ideal",
            "💊 Asegura que medicamentos viajaron en cadena de frío correcta",
            "👜 Confirma autenticidad de productos de lujo con certificado NFT",
            "📦 Automatiza pago a proveedores cuando GPS confirme entrega",
            "🔍 Audita toda la cadena para resolver disputas con datos verificables"
        ],
        commonIssues: [
            {
                problem: "¿Necesito hardware especial?",
                solution: "No para consultar. Para registrar envíos necesitas sensores IoT que proveemos en alquiler o venta."
            },
            {
                problem: "¿Funciona internacionalmente?",
                solution: "Sí, con cobertura global usando LoRaWAN y conectividad satelital en zonas remotas."
            }
        ]
    },

    SDK_API: {
        title: "Herramientas para Desarrolladores",
        description: "Suite completa de herramientas para integrar servicios Web3 de Bezhas en tu aplicación: autenticación, pagos, NFTs, contratos inteligentes y más.",
        features: [
            "API RESTful con documentación OpenAPI interactiva",
            "SDK oficial en JavaScript, Python, PHP y Rust",
            "Webhooks en tiempo real para eventos blockchain",
            "Sandbox con tokens de prueba ilimitados",
            "Rate limit generoso: 10,000 req/día gratis"
        ],
        useCases: [
            "🔐 Implementa 'Login con Bezhas' en tu sitio web en 5 minutos",
            "💳 Acepta pagos en crypto sin montar infraestructura blockchain",
            "🤖 Automatiza creación de NFTs cuando usuarios suben contenido",
            "📊 Lee datos de contratos inteligentes sin nodo propio",
            "⚡ Recibe notificaciones instantáneas de transacciones via webhook"
        ],
        commonIssues: [
            {
                problem: "¿Necesito saber Solidity?",
                solution: "No, nuestra API abstrae toda la complejidad. Solo necesitas JavaScript/Python básico."
            },
            {
                problem: "¿Cómo manejo las claves privadas?",
                solution: "Nunca las manejes tú. Usa nuestro sistema de API Keys con permisos granulares. Las claves de usuarios quedan en sus wallets."
            }
        ]
    },

    MARKETPLACE: {
        title: "Marketplace NFT & Digital Assets",
        description: "Compra, vende e intercambia NFTs, coleccionables digitales y servicios en un mercado descentralizado con fees ultra-bajos (0.5%) y sin intermediarios.",
        features: [
            "Colecciones verificadas con badge azul",
            "Subastas inglesas y holandesas automáticas",
            "Ofertas privadas peer-to-peer",
            "Regalías automáticas a creadores (configurable 0-10%)",
            "Integración con OpenSea y otros mercados"
        ],
        useCases: [
            "🎨 Vende tu arte digital y recibe regalías en cada reventa",
            "🎮 Compra ítems de juegos con garantía de autenticidad",
            "🎵 Colecciona música en edición limitada con acceso exclusivo",
            "📸 Monetiza tu fotografía con licencias NFT",
            "💼 Ofrece servicios profesionales tokenizados"
        ],
        commonIssues: [
            {
                problem: "¿Cómo evito NFTs falsos?",
                solution: "Solo compra colecciones verificadas (badge azul) o verifica el contrato en Polygon Scan."
            },
            {
                problem: "¿Puedo vender en otras plataformas?",
                solution: "Sí, los NFTs son estándar ERC-721/1155 compatibles con todo el ecosistema."
            }
        ]
    },

    DEFI: {
        title: "Finanzas Descentralizadas (DeFi)",
        description: "Accede a servicios financieros sin bancos: préstamos, intercambios, pools de liquidez, yield farming. Mantén siempre el control de tus fondos.",
        features: [
            "Swap instantáneo entre 500+ tokens",
            "Préstamos colateralizados con tasas competitivas",
            "Liquidity Mining con APYs de hasta 150%",
            "Farming de múltiples tokens simultáneamente",
            "Sin KYC, sin límites geográficos"
        ],
        useCases: [
            "💱 Intercambia BEZ por USDC sin crear cuenta en exchange",
            "💰 Obtén préstamo usando tus NFTs como colateral",
            "🌊 Provee liquidez a pools y gana fees de trading",
            "🚜 Haz farming con tus LP tokens para maximizar ganancias",
            "📊 Diversifica automáticamente con estrategias preset"
        ],
        commonIssues: [
            {
                problem: "¿Es seguro dejar mis tokens en pools?",
                solution: "Los contratos están auditados por CertiK y OpenZeppelin. Riesgo principal es impermanent loss (te explicamos antes de invertir)."
            },
            {
                problem: "¿Qué es el impermanent loss?",
                solution: "Pérdida temporal si el precio de tokens cambia mucho. Se compensa con fees si mantienes posición suficiente tiempo."
            }
        ]
    },

    SOCIAL: {
        title: "Red Social Web3",
        description: "Red social descentralizada donde TÚ eres dueño de tu contenido, datos y audiencia. Monetiza directamente sin intermediarios que se lleven el 70%.",
        features: [
            "Propiedad real de tu contenido (NFT certificado)",
            "Monetización directa: tips, suscripciones, contenido premium",
            "Sin censura arbitraria (moderación comunitaria DAO)",
            "Portabilidad: lleva tu perfil y seguidores a otras plataformas",
            "Recompensas por engagement de calidad"
        ],
        useCases: [
            "📸 Publica fotos y recibe tips en BEZ de tus seguidores",
            "🎥 Ofrece contenido exclusivo por suscripción mensual",
            "✍️ Vende tus artículos como NFTs coleccionables",
            "🎙️ Crea comunidades premium con acceso token-gated",
            "🏆 Gana recompensas por contenido viral validado por Oracle"
        ],
        commonIssues: [
            {
                problem: "¿Pueden borrar mi contenido?",
                solution: "Solo si viola reglas extremas votadas por DAO (ilegalidad, spam). Contenido polémico se mantiene con warnings."
            },
            {
                problem: "¿Cómo me pagan los tips?",
                solution: "Directo a tu wallet, sin intermediarios. Puedes retirar o reinvertir cuando quieras."
            }
        ]
    },

    ENTERPRISE: {
        title: "Soluciones Enterprise (ToolBEZ)",
        description: "Suite B2B para empresas: gestión de identidad descentralizada, automatización con IoT, contratos inteligentes personalizados y API dedicada.",
        features: [
            "DID (Identidad Descentralizada) para empleados y clientes",
            "Integración con SAP, Salesforce, ERPs",
            "Contratos inteligentes auditados a medida",
            "SLA garantizado 99.9% con soporte 24/7",
            "Panel de control con analytics avanzados"
        ],
        useCases: [
            "🏭 Automatiza pagos a proveedores con IoT + Smart Contracts",
            "👥 Gestiona credenciales de empleados sin servidores centrales",
            "📄 Certifica documentos legales en blockchain",
            "🔗 Tokeniza acciones de tu empresa para inversores",
            "📊 Integra trazabilidad blockchain en tu ERP existente"
        ],
        commonIssues: [
            {
                problem: "¿Es compatible con nuestra infraestructura?",
                solution: "Sí, ofrecemos conectores para los principales sistemas empresariales y APIs REST estándar."
            },
            {
                problem: "¿Necesitamos blockchain privada?",
                solution: "No necesariamente. Usamos Polygon (pública) con permisos de escritura controlados para cumplir requisitos corporativos."
            }
        ]
    },

    VIP: {
        title: "Membresía VIP & Beneficios Exclusivos",
        description: "Programa de lealtad escalonado que recompensa a usuarios activos con acceso anticipado, fees reducidos, soporte prioritario y eventos exclusivos.",
        features: [
            "5 niveles: Bronze, Silver, Gold, Platinum, Diamond",
            "Reducción progresiva de fees: hasta 90% en Diamond",
            "Acceso anticipado a nuevas funcionalidades",
            "NFTs exclusivos de cada tier con utilidad real",
            "Invitaciones a eventos presenciales y virtuales"
        ],
        useCases: [
            "💎 Alcanza Diamond y opera sin fees de trading",
            "🎟️ Recibe airdrops exclusivos de nuevos proyectos",
            "🎁 Accede a preventa de NFTs antes del lanzamiento público",
            "☎️ Soporte VIP con respuesta en menos de 2 horas",
            "🌟 Tu perfil destaca con badge animado en toda la plataforma"
        ],
        commonIssues: [
            {
                problem: "¿Cómo subo de nivel?",
                solution: "Combinación de: volumen de trading, staking acumulado, antigüedad de cuenta y participación en DAO."
            },
            {
                problem: "¿Puedo perder mi nivel VIP?",
                solution: "Solo si tu actividad cae drásticamente por 6 meses. Te notificamos antes con plan para mantenerlo."
            }
        ]
    },

    ACADEMY: {
        title: "Academia Bezhas & Educación Web3",
        description: "Centro de aprendizaje gratuito con cursos, tutoriales, webinars y certificaciones en blockchain, DeFi, NFTs y programación de Smart Contracts.",
        features: [
            "Cursos desde principiante hasta avanzado",
            "Certificaciones NFT al completar módulos",
            "Webinars semanales con expertos",
            "Sandbox para practicar sin riesgo",
            "Comunidad de aprendizaje en Discord"
        ],
        useCases: [
            "📚 Aprende qué es blockchain si eres principiante total",
            "💻 Curso de Solidity para programar tus propios contratos",
            "📈 Masterclass de trading y análisis técnico",
            "🎓 Obtén certificado NFT para tu perfil de LinkedIn",
            "🤝 Conéctate con mentores y otros estudiantes"
        ],
        commonIssues: [
            {
                problem: "¿Los cursos son realmente gratis?",
                solution: "Sí, 100% gratis. Solo las certificaciones premium opcionales tienen costo simbólico."
            },
            {
                problem: "¿Las certificaciones tienen valor?",
                solution: "Son reconocidas en el ecosistema Bezhas y muestran tu expertise públicamente on-chain."
            }
        ]
    },

    DEFAULT: {
        title: "Bienvenido a Bezhas Web3",
        description: "La primera red social descentralizada que integra IA, Blockchain y Finanzas. Tú controlas tus datos, contenido y ganancias. Únete a la revolución Web3.",
        features: [
            "🔐 Identidad soberana: tú controlas tu perfil y datos",
            "💰 Monetización directa sin intermediarios",
            "🤖 Asistente AI personal para optimizar tu experiencia",
            "🌍 Sin fronteras: acceso global sin restricciones",
            "🏛️ Gobernanza comunitaria mediante DAO"
        ],
        useCases: [
            "Explora el marketplace de NFTs y coleccionables",
            "Conecta tu wallet (MetaMask, WalletConnect, Coinbase)",
            "Participa en la DAO y gana recompensas por votar",
            "Completa quests diarios para acumular tokens BEZ",
            "Invita amigos y gana comisiones del affiliate program"
        ],
        commonIssues: [
            {
                problem: "¿Es difícil empezar si no sé de crypto?",
                solution: "No, puedes crear cuenta con Google/Facebook. Te guiamos paso a paso y la primera wallet te la creamos nosotros."
            },
            {
                problem: "¿Necesito invertir dinero?",
                solution: "No, puedes ganar tokens gratis completando quests, creando contenido o participando en la comunidad."
            }
        ]
    }
};

/**
 * Función helper para obtener el contenido según la ruta actual
 * @param {string} pathname - La ruta actual (window.location.pathname)
 * @returns {object} El contenido de guía correspondiente
 */
export const getGuideByPath = (pathname) => {
    const path = pathname.toLowerCase();

    if (path.includes('dao') || path.includes('governance')) return guideContent.DAO;
    if (path.includes('staking') || path.includes('farming')) return guideContent.STAKING;
    if (path.includes('rwa') || path.includes('real-estate')) return guideContent.RWA;
    if (path.includes('logistics') || path.includes('supply')) return guideContent.LOGISTICS;
    if (path.includes('sdk') || path.includes('api') || path.includes('developer')) return guideContent.SDK_API;
    if (path.includes('marketplace') || path.includes('nft')) return guideContent.MARKETPLACE;
    if (path.includes('defi') || path.includes('swap')) return guideContent.DEFI;
    if (path.includes('feed') || path.includes('social')) return guideContent.SOCIAL;
    if (path.includes('enterprise') || path.includes('toolbez')) return guideContent.ENTERPRISE;
    if (path.includes('vip')) return guideContent.VIP;
    if (path.includes('academy') || path.includes('learn')) return guideContent.ACADEMY;

    return guideContent.DEFAULT;
};
