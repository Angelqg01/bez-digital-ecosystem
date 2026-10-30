'use strict';

/**
 * services/onboardingGuided.js — cuestionario guiado del chat de la plataforma.
 *
 * El chat hace las preguntas NO sensibles (cargo, estructura, sector, tamaño,
 * volumen, qué quiere resolver, cómo integrar, qué papel quiere en la cadena) y
 * de ahí sale una recomendación de plan, SubApps y nivel de operación. Todo lo
 * demás —contraseña, KYB, custodia, responsables, DPA, credenciales del ERP— se
 * pide en la pantalla segura (/o/<token>), nunca aquí. Por eso este módulo no
 * acepta ningún campo fuera de los enumerados de abajo.
 *
 * Es una función pura sobre el catálogo existente (SECTORES, ERPS, planes): no
 * hay una segunda fuente de verdad que mantener.
 */

const { SECTORES, ERPS } = require('../config/mcp-onboarding-tools');
const { getPlan, calculateSubscription } = require('../config/plans');
const { getPerfil } = require('../config/node-profiles');

const ORDEN_PLANES = ['starter', 'creator_pro', 'business', 'enterprise_vip'];
const planMayor = (a, b) => (ORDEN_PLANES.indexOf(a) >= ORDEN_PLANES.indexOf(b) ? a : b);

/** SubApps que hoy están publicadas en *.bezhas.com. El resto son prototipos y no se recomiendan. */
const SUBAPPS_PUBLICADAS = ['hub', 'capital', 'purescan', 'energy', 'cargolink', 'wallet', 'pay'];

const CARGOS = ['direccion', 'ti', 'finanzas', 'operaciones', 'cumplimiento', 'desarrollo', 'otro'];
/** Quien no puede contratar evalúa; no se le dan permisos de administración. */
const CARGOS_CONTRATAN = ['direccion', 'finanzas'];

const ESTRUCTURAS = ['unica', 'filial', 'holding', 'grupo'];

/** Franjas → valor representativo que alimenta el plan. */
const EMPLEADOS = { '1-10': 5, '11-50': 30, '51-250': 120, '251-1000': 500, '1000+': 2000 };
const FACTURACION = { '<250k': 1, '250k-1m': 2, '1m-5m': 3, '5m-20m': 4, '20m-100m': 5, '100m+': 6 };
const DOCUMENTOS = { '<1k': 1, '1k-10k': 2, '10k-100k': 3, '100k+': 4 };

const CASOS = {
    documentos: ['hub', 'cargolink'],
    trazabilidad: ['cargolink', 'purescan'],
    pagos: ['pay', 'wallet'],
    tokenizar: ['capital'],
    calidad: ['purescan'],
    energia: ['energy'],
    agentes_ia: ['hub'],
    evidencias: ['purescan', 'hub'],
};

const INTEGRACIONES = ['erp', 'sdk', 'api', 'mcp'];
const PARTICIPACION = ['lectura', 'escritura', 'firma', 'validacion'];

const NIVEL_OPERACION = {
    lectura: 'lectura',
    escritura: 'preparacion',
    firma: 'ejecucion_con_aprobacion',
    validacion: 'ejecucion_con_aprobacion',
};

const enumerados = {
    cargo: CARGOS,
    estructura: ESTRUCTURAS,
    sector: Object.keys(SECTORES),
    empleados: Object.keys(EMPLEADOS),
    facturacion: Object.keys(FACTURACION),
    documentos: Object.keys(DOCUMENTOS),
    caso: Object.keys(CASOS),
    integraciones: INTEGRACIONES,
    erp: Object.keys(ERPS),
    participacion: PARTICIPACION,
};

/**
 * @param {object} p respuestas ya validadas (ver el esquema de la ruta)
 */
function recomendar(p) {
    const sector = SECTORES[p.sector] || SECTORES.otro;
    let plan = sector.plan;
    const motivos = [`Sector ${p.sector}: encaja con ${sector.subapps.filter((s) => SUBAPPS_PUBLICADAS.includes(s)).join(', ') || 'el Hub'}.`];

    const sube = (nuevo, motivo) => {
        const antes = plan;
        plan = planMayor(plan, nuevo);
        if (plan !== antes) motivos.push(motivo);
    };

    const personas = EMPLEADOS[p.empleados];
    if (personas >= 500) sube('enterprise_vip', `Tamaño (${p.empleados} personas).`);
    else if (personas >= 100) sube('business', `Tamaño (${p.empleados} personas).`);

    // La facturación dimensiona el plan, pero nunca decide permisos por sí sola.
    if (FACTURACION[p.facturacion] >= 6) sube('enterprise_vip', `Facturación (${p.facturacion} €).`);
    else if (FACTURACION[p.facturacion] >= 3) sube('business', `Facturación (${p.facturacion} €).`);

    if (DOCUMENTOS[p.documentos] >= 4) sube('enterprise_vip', `Volumen documental (${p.documentos} al mes).`);
    else if (DOCUMENTOS[p.documentos] >= 2) sube('business', `Volumen documental (${p.documentos} al mes).`);

    if (['holding', 'grupo'].includes(p.estructura)) sube('business', `Estructura (${p.estructura}): varias organizaciones y roles por sociedad.`);

    const integraciones = p.integraciones || [];
    if (integraciones.includes('erp') || p.erp) {
        sube('business', `Conectar ${p.erp ? ERPS[p.erp].nombre : 'tu ERP'} de forma gestionada exige Business o superior.`);
    }

    const nodo = getPerfil('enterprise');
    if (p.participacion === 'validacion' && nodo) {
        sube(nodo.planMinimo, 'Participar en la validación de la red requiere un nodo completo (Enterprise VIP).');
    }

    const subapps = [...new Set([...(CASOS[p.caso] || []), ...sector.subapps])]
        .filter((s) => SUBAPPS_PUBLICADAS.includes(s));
    const enPreparacion = sector.subapps.filter((s) => !SUBAPPS_PUBLICADAS.includes(s));

    const planInfo = getPlan(plan);
    const coste = calculateSubscription({ planId: plan, annual: false, payWithBez: false });
    const nivel = NIVEL_OPERACION[p.participacion] || 'lectura';

    const pendiente = [
        'Verificar el correo y crear la contraseña, con segundo factor.',
        'Verificación de empresa (KYB): razón social, NIF y titulares reales.',
        'Aceptar el contrato de encargado de tratamiento (DPA) y las condiciones.',
        'Jurisdicción, residencia de datos y requisitos de cumplimiento.',
        'Custodia de claves y firmantes autorizados.',
        'Responsables de seguridad, privacidad e incidentes.',
    ];
    if (p.erp || integraciones.includes('erp')) pendiente.push('Credenciales del ERP: se introducen en la pantalla segura, nunca en el chat.');

    return {
        planRecomendado: { id: planInfo.id, nombre: planInfo.name, perfil: planInfo.profile },
        porQue: motivos,
        subappsSugeridas: subapps,
        subappsEnPreparacion: enPreparacion,
        nivelOperacion: nivel,
        puedeContratar: CARGOS_CONTRATAN.includes(p.cargo),
        integraciones: integraciones.length ? integraciones : ['sin definir'],
        coste: { mensualEUR: coste.base, conIvaEUR: coste.total, nota: 'Precio de tarifa; el consumo de IA se mide en créditos aparte.' },
        pendientePantallaSegura: pendiente,
        siguientePaso: p.cargo && !CARGOS_CONTRATAN.includes(p.cargo)
            ? 'Puedes empezar la evaluación; para contratar hará falta que lo autorice alguien con capacidad de contratación.'
            : 'Continúa en la pantalla segura de BeZhas para crear tu cuenta. Nada se contrata sin que una persona lo acepte.',
    };
}

/** Lo que viaja a la sesión de alta: solo respuestas no sensibles y el email consentido. */
function aPrefill(p, { email, ahora = Date.now() } = {}) {
    const rec = recomendar(p);
    return {
        origen: 'chat-guiado',
        cargo: p.cargo,
        estructura: p.estructura,
        sector: p.sector,
        empleados: p.empleados,
        facturacion: p.facturacion,
        documentos: p.documentos,
        casoDeUso: p.caso,
        integraciones: p.integraciones || [],
        erp: p.erp || null,
        participacion: p.participacion || null,
        planSugerido: rec.planRecomendado.id,
        subappsSugeridas: rec.subappsSugeridas,
        email: email || null,
        consentimientoEmail: email ? new Date(ahora).toISOString() : null,
    };
}

module.exports = { recomendar, aPrefill, enumerados, SUBAPPS_PUBLICADAS, CARGOS_CONTRATAN };
