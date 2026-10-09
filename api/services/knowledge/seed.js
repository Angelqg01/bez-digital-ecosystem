'use strict';

/**
 * Conocimiento público de la plataforma (global, PUBLIC). Idempotente: un
 * documento que ya existe con el mismo contenido no se reindexa.
 *
 * Los datos salen de la configuración real (config/plans.js, config/bez-price.js,
 * routes/webhooks.js, deploy/gcp/config.env). Si cambian allí, cambiar aquí:
 * el asistente responde con esto y no debe inventar precios ni direcciones.
 */
const crypto = require('crypto');
const { PLANS } = require('../../config/plans');

const eur = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const planes = PLANS.map((p) => (p.priceEUR === 0
    ? `- ${p.name} (${p.profile}): sin cuota fija, pago por uso (coste real + 25 %), hasta ${p.aiActions} acciones de IA al mes; ${p.trialDays || 0} días de prueba.`
    : `- ${p.name} (${p.profile}): ${eur(p.priceEUR)} €/mes + IVA o ${eur(p.yearlyEUR)} €/año + IVA (2 meses gratis); ${p.aiActions ? `${eur(p.aiActions)} acciones de IA` : 'acciones de IA ilimitadas'}, ${p.gasSubsidy}% de subvención de gas.`)).join('\n');

const DOCS = [
    ['bz_que_es', 'Qué es BeZhas',
        'BeZhas es una red B2B firmada que conecta el ERP de una empresa con puertos, aduanas, bancos y clientes de cualquier país. '
        + 'Cada operación se prueba con un hash: los datos comerciales se quedan en la empresa, el pago se libera cuando la contraparte '
        + 'acepta y ningún intermediario decide por ti. BeZhas no sustituye el ERP: lo ancla mediante el Edge Node de cada cliente.'],
    ['bz_planes', 'Planes y precios',
        `BeZhas ofrece cuatro planes. Los precios no incluyen IVA (21 % en España), que se suma en el pago:\n${planes}\n`
        + 'Pagando la suscripción con BEZ hay un 20 % de descuento. Los planes se contratan desde la web con tarjeta (Stripe) '
        + 'y se activan en la app del cliente. Para comparar planes, abre la sección de planes de la plataforma.'],
    ['bz_ia_consumo', 'Uso del asistente BeZhas AI',
        'Cada mensaje al asistente BeZhas AI con sesión iniciada consume una acción de IA del plan de tu organización. '
        + 'En Creator Pro, Business y Enterprise VIP sale de las acciones incluidas en la cuota mensual; en Starter se factura '
        + 'por su coste real (modelo de IA y cómputo) + 25 %, en créditos de 0,001 € al mes. Si se agotan las acciones del mes, '
        + 'hay que mejorar el plan. Sin plan activo el asistente no está disponible. Sin sesión, cada visitante tiene una '
        + 'pregunta gratis respondida con fragmentos de la documentación pública.'],
    ['bz_token', 'BEZ-Coin',
        'BEZ-Coin (BEZ) vive en Polygon (cadena 137). Contrato oficial: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8. '
        + 'En la fase semilla el precio es fijo: 0,0075 USD por BEZ. Comprueba siempre la dirección del contrato antes de operar.'],
    ['bz_comprar_bez', 'Cómo comprar BEZ',
        'Se puede comprar BEZ con tarjeta (Stripe) o por transferencia bancaria SEPA desde la página del token. '
        + 'Con tarjeta, la compra queda retenida hasta que el banco confirma el cobro (normalmente pocos días hábiles) '
        + 'y después tesorería entrega los BEZ en la wallet indicada. Una disputa o un reembolso durante la retención cancela la entrega.'],
    ['bz_pagos', 'Pagos y facturación',
        'Los cobros de BeZhas se hacen con Stripe en la cuenta de BeZhas (tarjeta) y por transferencia SEPA. '
        + 'Los planes se renuevan automáticamente; cancelar la suscripción o un reembolso completo desactivan el plan. '
        + 'Las facturas y recibos llegan por email desde Stripe.'],
    ['bz_mcp', 'Conectar una IA a BeZhas (MCP)',
        'BeZhas publica un servidor MCP en https://mcp.bezhas.com/mcp con OAuth 2.1 y PKCE. '
        + 'Se puede conectar desde Claude, ChatGPT, Codex, Gemini, Antigravity y otros clientes compatibles. '
        + 'La página https://www.bezhas.com/mcp tiene la configuración de cada cliente. Las operaciones con coste o con fondos '
        + 'muestran antes su coste y requieren aprobación.'],
    ['bz_seguridad', 'Seguridad',
        'BeZhas nunca pide claves privadas ni frases semilla: ni este asistente, ni soporte, ni ningún formulario. '
        + 'Las operaciones sensibles pasan por la capa de seguridad transaccional (AEGIS, que falla cerrada): política, simulación '
        + 'y aprobaciones antes de ejecutar. El asistente no ejecuta transacciones; solo abre la pantalla donde el usuario firma.'],
    ['bz_edge', 'Edge Node',
        'Cada empresa ejecuta su propio Edge Node: los eventos de su ERP salen por él, se anonimizan y solo se publica su prueba (hash). '
        + 'Los datos comerciales no salen de la empresa. El alta del nodo se hace desde el onboarding de la plataforma.'],
    ['bz_tokenizacion', 'Tokenizar activos reales (RWA)',
        'BeZhas permite tokenizar un activo real en fracciones con un contrato RWAFactory en Polygon. Hay dos fábricas: «activos» '
        + '(inmuebles, hoteles, locales, vehículos, barcos, helicópteros y objetos) e «industrial» (plantas, maquinaria, lotes y materia prima). '
        + 'Hace falta el CID de IPFS de la documentación legal del activo (se sube en www.bezhas.com/rwa), el número de fracciones '
        + '(hasta 100.000.000), la valoración en USD, el precio por fracción en BEZ y el rendimiento anual estimado. BeZhas lee la comisión '
        + 'vigente del contrato y prepara las dos transacciones sin firmar (aprobar BEZ y tokenizar); las firma el titular con su wallet. '
        + 'BeZhas no firma ni envía nada por ti. Desde una IA, la herramienta MCP bezhas_tokenize_prepare (plan Creator Pro o superior) hace esa preparación.'],
    ['bz_nominas', 'Pagar nóminas y pagos a empleados',
        'Los pagos de nómina se preparan como operaciones con propósito «payroll»: transferencia cripto (BEZ, USDC o USDT en la red elegida) '
        + 'o conversión y salida a cuenta bancaria. BeZhas NO mueve fondos al preparar: el motor de políticas evalúa los límites por operación '
        + 'y diarios de tu plan, el nivel de verificación (KYC), el riesgo y si el destino es nuevo, y por encima del umbral exige una o dos '
        + 'aprobaciones humanas firmadas. Cada operación lleva una clave de idempotencia: repetirla no duplica el pago. El origen debe ser '
        + 'una wallet tuya, nunca una dirección custodiada por BeZhas. Los asientos contables de la nómina se leen del ERP conectado.'],
    ['bz_erp', 'Conectar tu ERP o software contable',
        'BeZhas se conecta al ERP del cliente: SAP S/4HANA, SAP Business One, Odoo, Microsoft Dynamics y NetSuite. Por defecto es de solo lectura: '
        + 'facturas, pedidos, albaranes, activos fijos y asientos contables, con filtros acotados. La conexión nace desactivada y solo se '
        + 'activa con el DPA firmado y una prueba de conexión correcta. Las credenciales del ERP se guardan cifradas y nunca se devuelven. '
        + 'Escribir en el ERP exige autorizar cada tipo de documento, una clave de idempotencia y la aprobación correspondiente. '
        + 'El ERP debe estar publicado en internet con https: BeZhas no se conecta a direcciones internas. Desde una IA, las herramientas '
        + 'bezhas_erp_connections, bezhas_erp_documents y bezhas_erp_document (plan Business o superior) leen esos datos.'],
    ['bz_contabilidad', 'Contabilidad con BeZhas',
        'BeZhas no sustituye tu ERP ni tu contabilidad: los ancla. El Edge Node de la empresa anonimiza los eventos del ERP y publica solo su hash, '
        + 'de modo que cada operación queda probada sin sacar los datos comerciales de la empresa. Los cobros con BEZ-Pay (tarjeta, SEPA o BEZ) '
        + 'y los pagos preparados quedan registrados y se pueden conciliar con el ERP leyendo facturas y asientos. Antes de automatizar, '
        + 'la herramienta bezhas_cost_estimate calcula el coste mensual de tus llamadas de API, acciones de IA, envíos on-chain y tareas de OPERANT '
        + '(departamentos como Finanzas o RRHH) con tu plan, sin consumir créditos.'],
    ['bz_cumplimiento', 'Normativa y cumplimiento',
        'BeZhas opera pensando en el marco español y europeo: AEAT, MiCA, SEPA y DAC8. Las operaciones con fondos exigen verificación (KYC) '
        + 'según su importe, límites por plan y aprobación humana firmada por encima del umbral; nada se ejecuta por una IA sin esa firma. '
        + 'BeZhas no ofrece asesoramiento fiscal ni jurídico: para el tratamiento contable y fiscal de la tokenización, las nóminas o los cobros '
        + 'en BEZ, consulta con tu asesor. Para dudas de cumplimiento escribe a info.bezcoin@bezhas.com.'],
    ['bz_api_integracion', 'Integrar BeZhas con otra plataforma por API',
        'Hay tres vías. 1) API REST del Gateway con una api-key en la cabecera x-api-key y permisos por ámbito (token, contratos, wallet, pagos, KYC): '
        + 'consulta de precio y token, pagos, estado KYC y más. 2) Servidor MCP en https://mcp.bezhas.com/mcp para conectar Claude, ChatGPT, Cursor o un '
        + 'agente propio, con herramientas de lectura y de preparación (nunca de firma). 3) Conexión gestionada con tu ERP. Todas se miden contra tu plan '
        + 'y tienen límites de tasa. La documentación está en www.bezhas.com/developers y www.bezhas.com/docs.'],
];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function seedPublicKnowledge(service) {
    const admin = { userId: 'system', tenantId: 'system', roles: ['ADMIN', 'USER'], plan: 'enterprise_vip' };
    let added = 0;
    for (const [id, title, content] of DOCS) {
        const existing = await service.store.getDoc(id);
        if (existing && existing.checksum === `sha256:${sha(content)}`) continue;
        await service.ingest(admin, { id, title, content, classification: 'PUBLIC', global: true, source: 'platform_docs' });
        added++;
    }
    return added;
}

module.exports = { seedPublicKnowledge, DOCS };
