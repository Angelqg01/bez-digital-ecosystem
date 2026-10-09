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
const { getEntitlements } = require('../../config/plan-entitlements');

const eur = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const planes = PLANS.map((p) => (p.priceEUR === 0
    ? `- ${p.name} (${p.profile}): sin cuota fija, pago por uso (coste real + 25 %), hasta ${p.aiActions} acciones de IA al mes; ${p.trialDays || 0} días de prueba.`
    : `- ${p.name} (${p.profile}): ${eur(p.priceEUR)} €/mes + IVA o ${eur(p.yearlyEUR)} €/año + IVA (2 meses gratis); ${p.aiActions ? `${eur(p.aiActions)} acciones de IA` : 'acciones de IA ilimitadas'}, ${p.gasSubsidy}% de subvención de gas.`)).join('\n');

const CARRILES = { crypto_transfer: 'transferencia cripto', fiat_to_crypto: 'euros → cripto', crypto_to_fiat: 'cripto → euros', fiat_to_fiat: 'euros → euros' };
const limitesPorPlan = PLANS.filter((p) => p.id !== 'starter').map((p) => {
    const ops = getEntitlements(p.id).operaciones || {};
    const lineas = Object.entries(ops.rails || {}).map(([carril, l]) =>
        `${CARRILES[carril] || carril}: hasta ${eur(l.porOperacionEur)} € por operación, ${eur(l.diarioEur)} €/día y ${eur(l.mensualEur)} €/mes, con aprobación humana desde ${eur(l.aprobacionDesdeEur)} €`);
    return `- ${p.name}: ${lineas.join('; ')}${ops.dobleAprobacionDesdeEur ? `; doble aprobación desde ${eur(ops.dobleAprobacionDesdeEur)} €` : ''}.`;
}).join('\n');

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
    ['bz_alta', 'Alta de la empresa en BeZhas',
        'El alta de una empresa son seis pasos. 1) Crear la cuenta del responsable: con una wallet (firmando un mensaje, sin contraseña) o con email y '
        + 'contraseña (mínimo 8 caracteres). 2) Crear la organización con el nombre de la empresa. 3) Completar los datos legales y fiscales: razón social, '
        + 'identificador fiscal, país, domicilio fiscal y representante legal. 4) Subir la documentación y enviar la empresa a verificación KYB. '
        + '5) Contratar un plan. 6) Asignar el plan a una app de la organización y obtener su api-key para integrar BeZhas. '
        + 'También hay un alta guiada con entorno de pruebas y sin coste, que puede abrir tu IA con las herramientas bezhas_signup_start y bezhas_connect_start '
        + 'del servidor MCP público, o desde www.bezhas.com/onboarding.'],
    ['bz_kyb', 'Verificación de la empresa (KYB)',
        'Para verificar a la empresa hacen falta sus datos legales completos (razón social, identificador fiscal, domicilio fiscal y nombre e identificación del '
        + 'representante legal) y documentación. Tipos admitidos: certificado de constitución, justificante del identificador fiscal, identificación del '
        + 'representante legal, justificante de domicilio y otros. Cada documento se registra con su nombre de archivo, la URL donde está almacenado y su hash '
        + 'SHA-256. Si faltan datos, el envío a verificación se rechaza y dice cuáles. La revisión la hace un administrador de BeZhas: la propia empresa no puede '
        + 'aprobarse a sí misma.'],
    ['bz_equipo', 'Equipo y roles de la organización',
        'Cada organización tiene miembros con un rol propio dentro de ella: owner, admin, developer, auditor, financial y operator. Se añaden por email. '
        + 'El owner y el admin pueden editar la organización, gestionar el equipo y la parte técnica; el auditor es de solo lectura (no puede editar la '
        + 'organización ni reclamar planes). Los roles son por organización: la misma persona puede ser owner en una y auditor en otra. '
        + 'Quien no es miembro no ve nada de la organización.'],
    ['bz_facturacion_empresa', 'Facturación de la empresa',
        'En el panel de la organización se configura la facturación: el email de facturación, la facturación electrónica (Facturae, SII u otro formato), '
        + 'los contactos administrativo, técnico y de seguridad, y el método de pago con tarjeta mediante Stripe. Se puede consultar el listado de facturas. '
        + 'Si el plan se contrató con un Payment Link, se asigna a una app de la organización reclamándolo con el identificador de la sesión de Stripe '
        + '(cs_…) que llega en la URL de vuelta tras pagar; solo pueden hacerlo los roles con permiso de facturación.'],
    ['bz_cobros', 'Cobrar a tus clientes (BEZ-Pay)',
        'BEZ-Pay abre una orden de cobro con el importe neto en USD (mínimo 1) y devuelve un enlace de pago. El cliente paga con tarjeta (Stripe), transferencia '
        + 'SEPA o BEZ on-chain, y los BEZ se entregan en la wallet de destino que indica el cliente. La comisión de plataforma es del 2,5 % y se suma aparte. '
        + 'Preparar la orden no cobra: el cobro ocurre cuando el cliente paga. Cada orden lleva una clave de idempotencia única, de modo que repetir la llamada '
        + 'devuelve la misma orden y nunca otra. Los cobros con tarjeta quedan retenidos hasta que el banco confirma los fondos. Desde una IA, la herramienta '
        + 'MCP bezhas_checkout_prepare (plan Creator Pro o superior) prepara la orden.'],
    ['bz_wallets_tesoreria', 'Wallets y tesorería de la empresa',
        'La organización registra sus wallets con la dirección, la red, el tipo (EOA, multifirma o Safe) y una etiqueta. Para la tesorería se recomienda un Safe '
        + 'multifirma. Las cuentas creadas con email reciben una wallet gestionada cuando está disponible; sin una wallet real no se puede comprar BEZ, porque '
        + 'no habría a dónde entregarlo. BeZhas nunca firma por ti, y las direcciones custodiadas por BeZhas (tesorería y hot wallet) no pueden usarse como origen '
        + 'de un pago de un cliente.'],
    ['bz_limites', 'Límites y aprobaciones de pagos por plan',
        `Cada plan fija cuánto se puede mover y cuándo hace falta una persona. Starter no incluye carriles de pago. En los demás planes, los límites vigentes son:\n${limitesPorPlan}\n`
        + 'Por encima del umbral, la operación queda a la espera de una o dos aprobaciones humanas firmadas. Además se aplican la verificación KYC, el nivel de '
        + 'riesgo y si el destino es nuevo, que puede denegar o frenar la operación aunque esté dentro del límite.'],
    ['bz_cargolink', 'CargoLink: logística y aduanas on-chain',
        'CargoLink sigue cada envío como una transacción con un identificador B-UID que recorre un único ciclo: CREATED, GATE_IN, CUSTOMS_CLEARED, STOWED, '
        + 'GATE_OUT, DEPARTED, IN_TRANSIT y DELIVERED. Los actores (aduanas, naviera, logística industrial, última milla y el punto de venta del cliente) tienen '
        + 'claves ligadas a su BeZhas_ID y cada uno solo puede hacer su propia transición. Cada cambio de estado dispara un webhook firmado con HMAC-SHA256 a '
        + 'quien esté suscrito. El pago se asegura con un escrow en BEZ (sin bloquear, bloqueado o liberado) y se libera cuando la contraparte acepta. '
        + 'Hay cadena de custodia entre actores y registros de carbono y de factura asociados al envío.'],
    ['bz_operant', 'OPERANT: departamentos de gestión empresarial con IA',
        'OPERANT automatiza departamentos de una empresa con agentes de IA: Ventas, Soporte, Marketing, Finanzas (facturación y cobros, previsión de tesorería, '
        + 'categorización de gasto, conciliación bancaria y desembolso en BEZ), RRHH (cribado de CV con redacción de datos personales, agenda de entrevistas, '
        + 'onboarding y asesoría laboral), Operaciones, Legal, Blockchain, Tesorería y Fundraising. Finanzas y RRHH llevan salvaguardas adicionales. '
        + 'Por plan: Starter 2 departamentos (Ventas y Soporte) con respuestas en borrador y pago por uso; Creator Pro 4 departamentos, 300 tareas al mes y '
        + 'autonomía asistida; Business 8 departamentos, 2.000 tareas al mes y autonomía total; Enterprise VIP los 10 departamentos, 9.000 tareas al mes y '
        + 'autonomía gobernada. Pasada la cuota se factura por uso. Una tarea no es una llamada: la ejecutan un responsable y especialistas con memoria y registro de auditoría.'],
    ['bz_staking', 'Staking y apps financieras (DeFi)',
        'La app DeFi de BeZhas (BZ Capital) agrupa staking, farming, bridge, wallet, DAO y liquidez conectados al token BEZ. Para hacer staking se abre la '
        + 'aplicación, se conecta la wallet, se aprueba BEZ para el contrato de staking y se deposita la cantidad deseada; las recompensas dependen de la '
        + 'participación total y son variables. Cada operación la firma tu wallet: el asistente no ejecuta transacciones, solo abre la pantalla.'],
    ['bz_apps', 'Apps del ecosistema BeZhas',
        'El ecosistema son varias apps conectadas por SSO: Hub (centro social y marketplace), DeFi, Wallet (billetera de BEZ-Coin sobre la L2), Gas Tank Manager, '
        + 'Edge Node Manager, CargoLink (logística), PureScan (trazabilidad alimentaria con IA de visión y pasaportes digitales de producto), Energy (gestión '
        + 'energética e IoT) y Vision Scan. El Gas Tank (paymaster) abstrae el coste de gas de las transacciones corporativas: una empresa recarga con fiat '
        + '(Stripe), el importe se convierte en gas y se consulta el historial de consumo.'],
    ['bz_privacidad', 'Privacidad y datos',
        'Los datos comerciales de la empresa no salen de ella: el Edge Node anonimiza los eventos del ERP y solo se publica su hash. Las credenciales del ERP '
        + 'se guardan cifradas y nunca se devuelven. Para conectar un ERP hace falta un DPA firmado. Puedes consultar, exportar y borrar la telemetría de uso '
        + 'asociada a tu api-key. Las conversaciones y los documentos que subes al asistente son privados de tu organización: otras empresas no pueden '
        + 'recuperarlos, y un documento con instrucciones sospechosas queda en cuarentena y no se indexa.'],
    ['bz_soporte', 'Soporte y contacto',
        'Para ayuda escribe a info.bezcoin@bezhas.com, abre el centro de ayuda en www.bezhas.com/support o usa el bot de Telegram @BeZhasBot. La documentación '
        + 'técnica está en www.bezhas.com/developers y www.bezhas.com/docs.'],
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
