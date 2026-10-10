'use strict';

/**
 * config/public-kb.js — base de conocimiento del chat PÚBLICO.
 *
 * Todo lo que hay aquí ya es público (landing, /mcp, tarifas publicadas, dirección
 * del contrato en cadena). NO se indexa docs/ para esto: ahí hay material interno
 * (márgenes, planes de financiación, guías de despliegue). Añadir una entrada es
 * decidir que cualquiera en internet puede leerla.
 */

const SUBAPPS = 'https://bezhas.com/#apps';

const ENTRADAS = [
    {
        titulo: 'Qué es BeZhas',
        texto: 'BeZhas es infraestructura blockchain empresarial B2B: pagos, trazabilidad, tokenización de activos reales (RWA), '
            + 'oráculo de calidad y automatización de gestión, consumible desde tu propia IA mediante un conector MCP.',
        enlace: 'https://bezhas.com',
    },
    {
        titulo: 'Planes y precios',
        texto: 'Starter 0 EUR (autónomos y startups, pago por uso). Creator Pro 99 EUR/mes (pymes y creadores). '
            + 'Business 499 EUR/mes (empresas en crecimiento). Enterprise VIP 2.499 EUR/mes (holdings e instituciones). '
            + 'Pagando con BEZ-Coin hay un 20% de ahorro. Los precios no incluyen IVA.',
        enlace: 'https://bezhas.com/enterprise',
    },
    {
        titulo: 'Token BEZ-Coin',
        texto: 'BEZ-Coin es el token nativo de BeZhas, un ERC-20 desplegado en Polygon en la dirección '
            + '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8. Se usa para gas fees, staking, gobernanza DAO y pagos. '
            + 'No está desplegado en BNB Chain: un bridge a BNB Chain está pendiente. No es un producto de inversión.',
        enlace: 'https://bezhas.com/token',
    },
    {
        titulo: 'Conector MCP: cómo conectar tu IA',
        texto: 'Puedes conectar Claude, ChatGPT, Cursor, Antigravity o un agente propio al servidor MCP de BeZhas. '
            + 'El alta asistida está en https://mcp.bezhas.com/mcp/onboarding y no requiere clave previa. '
            + 'Los clientes con cuenta usan el servidor https://mcp.bezhas.com/mcp con su api-key. '
            + 'El agente nunca firma transacciones ni mueve fondos por su cuenta.',
        enlace: 'https://bezhas.com/mcp',
    },
    {
        titulo: 'Desarrolladores, API y SDK',
        texto: 'El portal de desarrolladores tiene la documentación de la API, el SDK y la referencia de RPC y nodos. '
            + 'La API pública está en api.bezhas.com.',
        enlace: 'https://bezhas.com/developers',
    },
    {
        titulo: 'SubApp BeZhas-Hub',
        texto: 'BeZhas-Hub es el centro social y marketplace: perfiles, comunidad, comercio, contenido y experiencia VIP. '
            + 'Es la puerta de entrada pública al ecosistema.',
        enlace: SUBAPPS,
    },
    {
        titulo: 'SubApp BeZhas-DeFi',
        texto: 'BeZhas-DeFi es la suite financiera descentralizada: staking, farming, bridge, wallet, DAO y liquidez conectadas al token BEZ.',
        enlace: SUBAPPS,
    },
    {
        titulo: 'SubApp BZ PureScan',
        texto: 'BZ PureScan ofrece verificación con IA y visión artificial: escaneo, firmas SIFT, Food Oracle y gemelos digitales '
            + 'de activos RWA inmutables.',
        enlace: SUBAPPS,
    },
    {
        titulo: 'SubApp BEZ-Energy',
        texto: 'BEZ-Energy tokeniza energía: certificados CAE, créditos de carbono, oráculos ESG y mercados P2P de energía on-chain.',
        enlace: SUBAPPS,
    },
    {
        titulo: 'SubApp BZ-CargoLink',
        texto: 'BZ-CargoLink es logística y aduanas on-chain: seguimiento de cargas, NFTs de envío, escrow de entrega y despacho '
            + 'aduanero verificable. Es el caso de uso de RWA para transporte.',
        enlace: SUBAPPS,
    },
    {
        titulo: 'Sectores objetivo',
        texto: 'BeZhas se orienta a logística, aduanas, energía, industria, inmobiliario, fintech, legal, agroalimentario, seguros, salud y sector público.',
        enlace: 'https://bezhas.com/solutions',
    },
    {
        titulo: 'Seguridad y límites del agente',
        texto: 'Un agente conectado por MCP no puede firmar transacciones, aceptar condiciones contractuales en tu nombre ni manejar '
            + 'tu IBAN, contraseñas o claves privadas. Las operaciones con fondos las firma siempre una persona.',
        enlace: 'https://bezhas.com/mcp',
    },
    {
        titulo: 'Soporte y contacto',
        texto: 'Para ayuda escribe a info.bezcoin@bezhas.com, abre el centro de ayuda o usa el bot de Telegram @BeZhasBot.',
        enlace: 'https://bezhas.com/support',
    },
];

module.exports = { ENTRADAS };
