'use strict';

/**
 * Guía del chat: añade a cada respuesta el SIGUIENTE PASO concreto (y, cuando toca, el plan que lo desbloquea) y un
 * consejo de seguridad del tema. Es texto fijo decidido por el servidor a partir del mensaje del usuario y de su plan:
 * nunca sale del modelo ni de los documentos, así que un documento envenenado no puede meter enlaces ni ofertas.
 *
 * Es venta honesta: sólo se propone un plan cuando la función que el usuario está preguntando de verdad lo exige
 * (mismo mínimo que usa el MCP en config/mcp-tools.js), y se dice cuál es y cuál es su plan actual.
 */

const { PLANS } = require('../../config/plans');

const RANGO = { none: 0, starter: 1, creator_pro: 2, business: 3, enterprise_vip: 4 };
const NOMBRE = Object.fromEntries(PLANS.map((p) => [p.id, p.name]));

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Temas que la plataforma ofrece y el plan mínimo que los habilita. */
const TEMAS = [
    { id: 'erp', re: /\b(erp|sap|odoo|dynamics|netsuite|conciliar|conciliacion|asientos|facturas? de proveedor)/, minimo: 'business',
      paso: 'conecta tu ERP (solo lectura, con DPA firmado) y tu IA podrá consultar facturas, activos y asientos por MCP con `bezhas_erp_documents`.' },
    { id: 'tokenizacion', re: /\b(tokeniz|rwa|fraccion)/, minimo: 'creator_pro',
      paso: 'sube la documentación legal del activo a IPFS (www.bezhas.com/rwa) y prepara la tokenización con `bezhas_tokenize_prepare`; la firmas tú con tu wallet.' },
    { id: 'cobros', re: /\b(cobr|bez-?pay|checkout|cliente.{0,20}(pagar|tarjeta|sepa))/, minimo: 'creator_pro',
      paso: 'crea la orden de cobro con `bezhas_checkout_prepare` y comparte el enlace de pago con tu cliente; el cobro ocurre cuando él paga.' },
    { id: 'nominas', re: /\b(nomina|payroll|salari|pagar a (?:proveedores|empleados))/, minimo: 'creator_pro',
      paso: 'prepara el pago con `bezhas_tx_prepare` (propósito «payroll»): verás la decisión de la política y las aprobaciones que hacen falta antes de firmar.' },
    { id: 'operant', re: /\boperant\b|departamentos? (?:de )?ia|automatiz\w* (?:ventas|soporte|finanzas|rrhh)/, minimo: 'creator_pro',
      paso: 'activa los departamentos que te convienen (Ventas y Soporte en Starter; Finanzas desde Creator Pro; hasta 10 en Enterprise VIP).' },
    { id: 'automatizar', re: /\b(api|sdk|mcp|webhook|integrar|integracion|automatiz|claude|chatgpt|cursor)/, minimo: 'starter',
      paso: '1) crea tu api-key con los permisos mínimos, 2) pruébala con `GET /api/gateway/v1/token/price` (cabecera `x-api-key`), 3) conecta tu IA a `https://mcp.bezhas.com/mcp` o instala el SDK con `pnpm add @bezhas/sdk`.' },
    { id: 'comprar_bez', re: /\b(comprar bez|compro bez|adquirir bez|comprar tokens|buy bez)\b|\bcomprar\b.{0,12}\bbez\b/, minimo: null,
      paso: 'abre «Comprar BEZ», paga con tarjeta o SEPA y recibirás los BEZ en tu wallet cuando el banco confirme el cobro (normalmente en pocos días hábiles).' },
];

const INTENCION_COMPRA = /\b(contrat|suscrib|comprar|compro|precio|cuesta|cuanto vale|plan(?:es)?\b|upgrade|subir de plan|probar)/;

/** Un consejo de seguridad por tema (rota por el hash del mensaje para no repetir siempre el mismo). */
const CONSEJOS = {
    erp: [
        'usa en el ERP un usuario de servicio de solo lectura y rota su clave de API cada trimestre; BeZhas no devuelve nunca las credenciales que guardas.',
        'firma el DPA antes de activar la conexión y limita los campos que BeZhas puede ver con el alcance de campos.',
    ],
    tokenizacion: [
        'comprueba siempre en la wallet qué vas a firmar: BeZhas prepara las dos transacciones, pero la firma es tuya. Usa un Safe multifirma para activos de valor.',
        'verifica el CID de la documentación legal antes de tokenizar: una vez emitida la fracción, el contenido enlazado no se puede cambiar.',
    ],
    cobros: [
        'usa una clave de idempotencia distinta por cobro y verifica la firma HMAC de los webhooks que recibas antes de dar un pedido por pagado.',
        'confirma por un canal independiente el IBAN o la wallet de destino antes de enviar enlaces de pago a clientes nuevos.',
    ],
    nominas: [
        'activa la doble aprobación para los lotes de nómina y no uses nunca una wallet compartida como origen: usa un Safe de la empresa.',
        'nunca pegues claves privadas ni frases semilla en el chat ni en tickets: BeZhas no las pide y las eliminaría del mensaje.',
    ],
    operant: [
        'empieza con autonomía «asistida» y revisa el registro de auditoría antes de pasar a automatizar Finanzas o RRHH.',
    ],
    automatizar: [
        'crea una api-key por integración con el menor número de permisos, guárdala en un gestor de secretos (no en el código ni en el repositorio) y rótala si dudas de ella.',
        'limita desde qué orígenes y direcciones puede operar cada clave, y revisa periódicamente el uso en tu panel.',
    ],
    comprar_bez: [
        'compra siempre desde www.bezhas.com o los enlaces que te da este chat; BeZhas nunca te pedirá BEZ por mensaje directo ni por Telegram.',
    ],
    general: [
        'usa una contraseña larga y única, y no compartas nunca tu api-key, tu frase semilla ni tu clave privada con nadie, tampoco con este asistente.',
        'desconfía de cualquier mensaje que te pida «validar» tu wallet o tu api-key: es la técnica de phishing más común contra cuentas empresariales.',
    ],
};

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const elegir = (lista, semilla) => lista[hash(semilla) % lista.length];

function nombrePlan(id) { return NOMBRE[id] || id; }

/**
 * @param {{plan?:string}} principal
 * @param {string} mensaje   mensaje (ya redactado) del usuario
 * @returns {{texto:string, tema:string|null, requierePlan:string|null}}
 */
function siguientePaso(principal, mensaje) {
    const t = norm(mensaje);
    const plan = RANGO[principal?.plan] !== undefined ? principal.plan : 'none';
    const tema = TEMAS.find((x) => x.re.test(t)) || null;
    const lineas = [];
    let requierePlan = null;

    if (tema) {
        if (tema.minimo && RANGO[plan] < RANGO[tema.minimo]) {
            requierePlan = tema.minimo;
            const actual = plan === 'none' ? 'ninguno' : nombrePlan(plan);
            lineas.push(`**Siguiente paso:** esto requiere el plan **${nombrePlan(tema.minimo)}** o superior (tu plan: ${actual}). Ábrelo en «Suscribirme a un plan»: pagas con tarjeta, el IVA se suma aparte y se activa en cuanto Stripe lo confirma. Después: ${tema.paso}`);
        } else {
            lineas.push(`**Siguiente paso:** ${tema.paso}`);
        }
    } else if (plan === 'none' && INTENCION_COMPRA.test(t)) {
        lineas.push('**Siguiente paso:** para usar BeZhas AI y las herramientas de tu IA necesitas un plan. Starter es de pago por uso con 15 días de prueba; los demás son de cuota mensual o anual. Abre «Suscribirme a un plan» y elige el que encaje.');
    } else if (plan === 'none') {
        lineas.push('**Siguiente paso:** para seguir con BeZhas AI contrata un plan (Starter, de pago por uso, incluye 15 días de prueba): abre «Suscribirme a un plan».');
    }

    const claveConsejo = tema?.id && CONSEJOS[tema.id] ? tema.id : 'general';
    lineas.push(`**Consejo de seguridad:** ${elegir(CONSEJOS[claveConsejo], t)}`);

    return { texto: `\n\n${lineas.join('\n\n')}`, tema: tema?.id || null, requierePlan };
}

module.exports = { siguientePaso, TEMAS, CONSEJOS };
