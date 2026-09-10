'use strict';

/**
 * config/mcp-onboarding-tools.js — catálogo del MCP de alta y despliegue.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTE CATÁLOGO ESTÁ SEPARADO DEL DE CLIENTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * config/mcp-tools.js es de solo lectura y exige api-key. Estas herramientas ni
 * una cosa ni la otra: escriben una fila y algunas las llama gente que todavía
 * no es cliente. Mezclarlas en un mismo catálogo obligaría a que cada control
 * de aquel fichero llevase una excepción, y una excepción en un control de
 * acceso es cómo se acaba sirviendo por error una herramienta de cliente a un
 * desconocido.
 *
 * Dos ficheros, dos routers, dos límites de tasa. Aburrido y separado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LO QUE ESTAS HERRAMIENTAS NO HACEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ninguna da de alta a nadie, instala nada, escribe en el ERP de nadie ni toca
 * un dato bancario. Crean una sesión y devuelven una URL. Lo que decide una
 * persona lo sigue decidiendo una persona, en una pantalla, con los datos
 * delante.
 *
 * Concretamente, y por si mañana alguien tiene la tentación:
 *
 *   · Ninguna acepta IBAN, tarjeta, contraseña, api-key ni clave privada. El
 *     servicio rechaza el prefill que las lleve (PREFILL_PROHIBIDO), porque el
 *     modelo del cliente INTENTARÁ pasárnoslas si su usuario se las dicta: es
 *     exactamente lo que se le ha pedido que haga.
 *   · Ninguna acepta condiciones contractuales. Aceptar es un acto jurídico y
 *     un agente no es parte del contrato.
 *   · Ninguna ejecuta un comando en la máquina del cliente. Devolvemos el plan
 *     verificable; ejecuta su agente, en su equipo, con su permiso.
 */

const { z } = require('zod');
const { PLANS, getPlan, calculateSubscription } = require('./plans');
const { PERFILES, getPerfil, planPermite, provisionAsistido } = require('./node-profiles');
const onboarding = require('../services/onboardingSession');

const MAX_RESPUESTA_CHARS = parseInt(process.env.MCP_MAX_RESPONSE_CHARS || '24000', 10);

/** Versión del SDK que se recomienda instalar. Espejo de sdk/package.json. */
const SDK_PAQUETE = '@bezhas/sdk';
const SDK_VERSION = process.env.SDK_VERSION_RECOMENDADA || '3.0.0';

/** ERPs con plan de integración descrito. Lo que no está, se responde honestamente. */
const ERPS = {
    sap_s4hana: { nombre: 'SAP S/4HANA Cloud', via: 'OData v4 vía BTP Destination', modos: ['agente', 'gestionado'] },
    sap_b1: { nombre: 'SAP Business One', via: 'Service Layer (REST)', modos: ['agente', 'gestionado'] },
    odoo: { nombre: 'Odoo', via: 'JSON-RPC', modos: ['agente', 'gestionado'] },
    dynamics: { nombre: 'Microsoft Dynamics 365', via: 'Dataverse Web API', modos: ['agente', 'gestionado'] },
    netsuite: { nombre: 'Oracle NetSuite', via: 'SuiteQL / REST', modos: ['agente'] },
};

/** Sectores con SubApp que encaja. Alimenta la recomendación de plan. */
const SECTORES = {
    logistica: { subapps: ['cargolink', 'pay'], plan: 'business' },
    aduanas: { subapps: ['cargolink'], plan: 'business' },
    energia: { subapps: ['energy', 'gas'], plan: 'business' },
    industria: { subapps: ['purescan'], plan: 'business' },
    inmobiliario: { subapps: ['capital', 'prestige'], plan: 'business' },
    fintech: { subapps: ['pay', 'capital'], plan: 'business' },
    legal: { subapps: ['prestige'], plan: 'creator_pro' },
    agroalimentario: { subapps: ['purescan', 'cargolink'], plan: 'business' },
    seguros: { subapps: ['prestige', 'purescan'], plan: 'business' },
    salud: { subapps: ['purescan'], plan: 'enterprise_vip' },
    publico: { subapps: ['genesis'], plan: 'enterprise_vip' },
    otro: { subapps: ['hub', 'wallet'], plan: 'creator_pro' },
};

const ORDEN_PLANES = ['starter', 'creator_pro', 'business', 'enterprise_vip'];

/** Sube el plan al mayor de los dos. */
const planMayor = (a, b) =>
    ORDEN_PLANES.indexOf(a) >= ORDEN_PLANES.indexOf(b) ? a : b;

const perfilSchema = {
    sector: z.enum(Object.keys(SECTORES)).describe('Sector de la empresa'),
    empleados: z.number().int().positive().max(1000000).optional()
        .describe('Número aproximado de empleados'),
    pais: z.string().length(2).optional()
        .describe('Código ISO de país (ES, PT, FR…). Determina IVA y qué DPA se firma.'),
    erp: z.enum(Object.keys(ERPS)).optional().describe('Plataforma de gestión que ya usa'),
    caso_de_uso: z.string().max(500).optional()
        .describe('Qué quiere conseguir, en sus palabras'),
    razon_social: z.string().max(200).optional().describe('Nombre de la empresa'),
};

/**
 * Catálogo.
 *
 *   anonimo — true si se puede llamar SIN api-key. Es la propiedad que decide
 *             qué ve un desconocido, así que se lee en el router y no se
 *             deduce de ninguna otra cosa.
 */
const TOOLS = [
    // ── Anónimas: quien todavía no es cliente ────────────────────────────────
    {
        name: 'bezhas_intro',
        anonimo: true,
        title: 'Qué es BeZhas',
        description: 'Qué hace la plataforma, qué SubApps existen y qué se puede probar sin ser cliente. '
            + 'Llama a esto antes de describir BeZhas para no improvisar la propuesta de valor.',
        handler: async () => ({
            queEs: 'Infraestructura blockchain empresarial B2B: pagos, trazabilidad, tokenización de activos '
                + 'reales, oráculo de calidad y automatización de gestión, consumible desde tu propia IA.',
            comoSeUsa: 'Un conector MCP en tu IA (Claude, ChatGPT, Cursor, Antigravity o un agente propio). '
                + 'No hay que aprender un panel nuevo ni salir del chat.',
            sinSerCliente: [
                'Consultar qué plan encaja con tu perfil (bezhas_recommend_plan).',
                'Abrir un alta guiada, con entorno de pruebas y sin coste (bezhas_signup_start).',
            ],
            siYaEresCliente: 'bezhas_connect_start abre el inicio de sesión para conectar esta IA '
                + 'con tu cuenta. No hace falta darse de alta otra vez.',
            sectores: Object.keys(SECTORES),
            loQueNuncaHaceElAgente: [
                'Firmar una transacción o mover fondos por su cuenta.',
                'Aceptar condiciones contractuales en tu nombre.',
                'Manejar tu IBAN, contraseñas o claves privadas.',
            ],
            planes: PLANS.map((p) => ({ id: p.id, nombre: p.name, perfil: p.profile, precioEUR: p.priceEUR })),
        }),
    },
    {
        name: 'bezhas_recommend_plan',
        anonimo: true,
        title: 'Qué plan encaja con este perfil',
        description: 'Recomienda plan, SubApps y permisos a partir del perfil de la empresa. '
            + 'NO crea nada ni compromete a nada: es una consulta.',
        inputSchema: perfilSchema,
        handler: async ({ args }) => {
            const sector = SECTORES[args.sector] || SECTORES.otro;
            let planId = sector.plan;

            // El tamaño sube el plan, nunca lo baja: un sector exigente con
            // pocos empleados sigue necesitando lo que necesita.
            if (args.empleados >= 250) planId = planMayor(planId, 'enterprise_vip');
            else if (args.empleados >= 50) planId = planMayor(planId, 'business');

            // Conectar el ERP de forma gestionada es Business en adelante.
            if (args.erp) planId = planMayor(planId, 'business');

            const plan = getPlan(planId);
            const coste = calculateSubscription({ planId, annual: false, payWithBez: false });

            return {
                planRecomendado: { id: plan.id, nombre: plan.name, perfil: plan.profile },
                porQue: [
                    `Sector ${args.sector}: encaja con ${sector.subapps.join(', ')}.`,
                    args.empleados ? `Tamaño (${args.empleados} personas) y volumen esperado.` : null,
                    args.erp ? `Conectar ${ERPS[args.erp].nombre} de forma gestionada exige Business o superior.` : null,
                ].filter(Boolean),
                subappsSugeridas: sector.subapps,
                scopesNecesarios: ['token', 'contracts', 'wallet'],
                coste: {
                    mensualEUR: coste.base,
                    conIvaEUR: coste.total,
                    ahorroPagandoConBez: '20%',
                    nota: 'Precio de tarifa. El consumo por agente se mide en créditos aparte.',
                },
                requisitos: [
                    'Verificación de empresa (KYB) antes de operar en producción.',
                    args.erp ? 'Contrato de encargado de tratamiento (DPA) firmado antes de conectar el ERP.' : null,
                    'Entorno de pruebas disponible desde el minuto uno, sin verificación y sin coste.',
                ].filter(Boolean),
                siguientePaso: 'bezhas_signup_start para abrir el alta guiada. Nada se contrata sin que una persona lo acepte.',
            };
        },
    },
    {
        name: 'bezhas_signup_start',
        anonimo: true,
        title: 'Abrir el alta guiada',
        description: 'Crea una sesión de alta y devuelve un enlace a la pantalla segura de BeZhas, '
            + 'ya rellena con lo que sepas del perfil. NO da de alta a nadie: la persona revisa, corrige y acepta. '
            + 'No mandes datos bancarios ni credenciales: se rechaza la petición entera.',
        inputSchema: perfilSchema,
        handler: async ({ args, contexto }) => {
            const sector = SECTORES[args.sector] || SECTORES.otro;
            const sesion = await onboarding.crear({
                kind: 'signup',
                prefill: {
                    sector: args.sector,
                    empleados: args.empleados ?? null,
                    pais: args.pais ?? null,
                    erp: args.erp ?? null,
                    razonSocial: args.razon_social ?? null,
                    casoDeUso: args.caso_de_uso ?? null,
                    subappsSugeridas: sector.subapps,
                },
                appId: contexto.appId,
                ip: contexto.ip,
                userAgent: contexto.userAgent,
            });
            return {
                onboardingId: sesion.id,
                url: sesion.url,
                caduca: sesion.expiresAt,
                pasos: [
                    'Revisar y corregir los datos de la empresa (ya vienen puestos).',
                    'Aceptar condiciones — lo hace una persona, no el agente.',
                    'Verificar el correo.',
                    'Recoger las credenciales de pruebas en la propia pantalla.',
                ],
                comoContarlo: 'Abre este enlace: es una pantalla de BeZhas con tus datos ya rellenos. '
                    + 'Caduca en unos minutos por seguridad; si se pasa, pides otro y sale al momento.',
            };
        },
    },
    {
        name: 'bezhas_connect_start',
        anonimo: true,
        title: 'Conectar una IA a una cuenta existente',
        description: 'Para quien YA es cliente y sólo tiene que identificarse desde una IA nueva. '
            + 'Abre la pantalla de inicio de sesión de BeZhas y devuelve el enlace. '
            + 'No pidas usuario ni contraseña por el chat: se escriben en la pantalla.',
        inputSchema: {
            entorno: z.enum(['sandbox', 'produccion']).default('sandbox')
                .describe('Con qué entorno va a trabajar el asistente'),
            organizacion: z.string().max(200).optional()
                .describe('Nombre de la organización, si el usuario lo menciona. Se usa sólo para '
                    + 'preseleccionarla en la pantalla; quién puede entrar lo decide el login.'),
        },
        handler: async ({ args, contexto }) => {
            const sesion = await onboarding.crear({
                kind: 'connect',
                prefill: { entorno: args.entorno, organizacion: args.organizacion ?? null },
                appId: contexto.appId,
                ip: contexto.ip,
                userAgent: contexto.userAgent,
            });
            return {
                onboardingId: sesion.id,
                url: sesion.url,
                caduca: sesion.expiresAt,
                entorno: args.entorno,
                pasos: [
                    'Iniciar sesión con tu cuenta de BeZhas.',
                    'Elegir organización y entorno.',
                    'Autorizar el conector para esta IA.',
                    'Guardar la credencial en tu gestor de secretos.',
                ],
                // Es la propiedad que sostiene todo el flujo: si la clave
                // volviera por aquí, acabaría en el contexto del modelo y en el
                // historial del chat, y daría igual lo bien hecho que estuviera
                // el resto. El agente sabe que terminó; no sabe con qué.
                loQueNoVuelvePorElChat: 'La credencial se muestra y se copia en la pantalla. '
                    + 'Este canal sólo llega a saber si la conexión se completó.',
                siSeCierra: 'Si cierras la pantalla a medias, pide otro enlace: se genera al momento.',
                comoContarlo: 'Abre este enlace e inicia sesión con tu cuenta de BeZhas. '
                    + 'Cuando termines, vuelve aquí y sigo.',
            };
        },
    },
    {
        name: 'bezhas_onboarding_status',
        anonimo: true,
        title: 'Estado de un alta o despliegue',
        description: 'Estado de una sesión abierta antes, por su identificador. '
            + 'Devuelve en qué paso va y qué falta. No devuelve datos de la empresa.',
        inputSchema: {
            onboarding_id: z.string().uuid().describe('Identificador devuelto al abrir la sesión'),
        },
        handler: async ({ args }) => {
            const sesion = await onboarding.porId(args.onboarding_id);
            if (!sesion) {
                return { encontrada: false, nota: 'No hay ninguna sesión con ese identificador. Puede haber caducado y desaparecido.' };
            }
            return { encontrada: true, ...onboarding.estadoPublico(sesion) };
        },
    },

    // ── Con api-key: ya es cliente ───────────────────────────────────────────
    {
        name: 'bezhas_sdk_install_plan',
        anonimo: false,
        title: 'Plan de instalación del SDK',
        description: 'Cómo instalar el SDK de BeZhas: paquete, versión, comando, comprobación de integridad y '
            + 'verificación posterior. La credencial NO viene aquí: se recoge en la pantalla que se enlaza.',
        inputSchema: {
            gestor: z.enum(['pnpm', 'npm', 'yarn', 'docker']).default('pnpm')
                .describe('Gestor de paquetes del cliente'),
            entorno: z.enum(['servidor', 'local', 'ci']).default('servidor')
                .describe('Dónde se instala'),
        },
        handler: async ({ args, contexto }) => {
            const comandos = {
                pnpm: `pnpm add ${SDK_PAQUETE}@${SDK_VERSION}`,
                npm: `npm install ${SDK_PAQUETE}@${SDK_VERSION}`,
                yarn: `yarn add ${SDK_PAQUETE}@${SDK_VERSION}`,
                docker: `# Añade al Dockerfile:\nRUN pnpm add ${SDK_PAQUETE}@${SDK_VERSION}`,
            };
            const sesion = await onboarding.crear({
                kind: 'sdk_install',
                prefill: { gestor: args.gestor, entorno: args.entorno, version: SDK_VERSION },
                appId: contexto.appId,
                ip: contexto.ip,
                userAgent: contexto.userAgent,
            });
            return {
                paquete: `${SDK_PAQUETE}@${SDK_VERSION}`,
                comando: comandos[args.gestor],
                // Se instala desde el registro, con versión fijada, y se
                // comprueba la integridad del artefacto. Nunca un `curl | bash`
                // apuntando a un dominio nuestro: eso convierte un compromiso de
                // nuestro servidor en ejecución remota en todos los clientes.
                verificarIntegridad: `${args.gestor === 'npm' ? 'npm' : 'pnpm'} view ${SDK_PAQUETE}@${SDK_VERSION} dist.integrity`,
                configEjemplo: {
                    BEZHAS_API_URL: 'https://api.bez.digital',
                    BEZHAS_API_KEY: '<pégala desde la pantalla, en tu gestor de secretos>',
                    BEZHAS_CHAIN: 'polygon',
                },
                verificacion: `node -e "const b=require('${SDK_PAQUETE}');b.health().then(console.log)"`,
                credencialesUrl: sesion.url,
                onboardingId: sesion.id,
                avisos: [
                    'La api-key no viaja por el chat: se recoge en la pantalla y se pega en el gestor de secretos.',
                    'Nunca la escribas en un fichero de configuración versionado.',
                    'Si tu agente tiene terminal, puede ejecutar el comando; si no, cópialo tú.',
                ],
            };
        },
    },
    {
        name: 'bezhas_erp_integration_plan',
        anonimo: false,
        title: 'Plan de integración con el ERP',
        description: 'Cómo conectar BeZhas con SAP S/4HANA, Business One, Odoo, Dynamics o NetSuite: '
            + 'objetos implicados, campos mínimos y permisos a pedir. Las credenciales del ERP no pasan por aquí.',
        inputSchema: {
            erp: z.enum(Object.keys(ERPS)).describe('Plataforma de gestión'),
            modo: z.enum(['agente', 'gestionado']).default('agente')
                .describe('agente: el pegamento vive en tu lado y BeZhas no ve credenciales. '
                    + 'gestionado: BeZhas mantiene la conexión (Business+, exige DPA).'),
            casos: z.array(z.enum(['facturas_proveedor', 'pedidos', 'albaranes', 'activos', 'asientos']))
                .min(1).describe('Qué se quiere sincronizar'),
        },
        handler: async ({ args, contexto }) => {
            const erp = ERPS[args.erp];
            if (!erp.modos.includes(args.modo)) {
                return {
                    disponible: false,
                    motivo: `Para ${erp.nombre} sólo está previsto el modo «${erp.modos.join(', ')}».`,
                };
            }
            const sesion = await onboarding.crear({
                kind: 'erp_integration',
                prefill: { erp: args.erp, modo: args.modo, casos: args.casos },
                appId: contexto.appId,
                ip: contexto.ip,
                userAgent: contexto.userAgent,
            });
            return {
                erp: erp.nombre,
                via: erp.via,
                modo: args.modo,
                objetos: args.casos,
                camposMinimos: {
                    facturas_proveedor: ['numero', 'proveedor', 'importe', 'moneda', 'vencimiento', 'estado'],
                    pedidos: ['numero', 'cliente', 'lineas', 'importe', 'fecha'],
                    albaranes: ['numero', 'pedido', 'destino', 'bultos', 'fecha'],
                    activos: ['referencia', 'descripcion', 'valoracion', 'fecha_tasacion'],
                    asientos: ['cuenta', 'debe', 'haber', 'concepto', 'fecha'],
                },
                permisosQuePedir: args.modo === 'gestionado'
                    ? ['Usuario de servicio de SOLO LECTURA sobre los objetos listados.',
                        'Alta de escritura únicamente si vas a conciliar de vuelta, y sobre un único objeto.']
                    : ['Ninguno para BeZhas: el acceso al ERP se queda en tu lado.'],
                requisitos: args.modo === 'gestionado'
                    ? ['DPA firmado ANTES de abrir el formulario de credenciales.',
                        'Plan Business o superior.',
                        'Una persona aprueba explícitamente qué campos salen del ERP.']
                    : ['Tu agente necesita el conector MCP de tu ERP además del de BeZhas.'],
                idempotencia: 'Toda escritura hacia el ERP lleva clave de idempotencia. Un agente reintenta, '
                    + 'y sin ella un reintento son dos facturas.',
                configuracionUrl: sesion.url,
                onboardingId: sesion.id,
            };
        },
    },
    {
        name: 'bezhas_node_requirements',
        anonimo: false,
        title: 'Requisitos de un nodo',
        description: 'Qué hace falta para levantar un nodo edge o enterprise de la red BeZhas: '
            + 'máquina, puertos, plan mínimo y tiempo estimado.',
        inputSchema: {
            tipo: z.enum(['edge', 'enterprise']).optional()
                .describe('Sin tipo devuelve los dos perfiles para comparar'),
        },
        handler: async ({ args }) => {
            const perfiles = args.tipo ? [getPerfil(args.tipo)] : PERFILES;
            return {
                perfiles: perfiles.map((p) => ({
                    id: p.id, nombre: p.nombre, proposito: p.proposito,
                    requisitos: p.requisitos, puertos: p.puertos,
                    planMinimo: p.planMinimo, tiempoEstimado: p.tiempoEstimado,
                })),
                garantia: 'La clave privada del nodo se genera en tu máquina y nunca sale de ella. '
                    + 'BeZhas no obtiene acceso a tu infraestructura.',
            };
        },
    },
    {
        name: 'bezhas_node_provision_start',
        anonimo: false,
        title: 'Preparar el despliegue de un nodo',
        description: 'Abre la pantalla con el token de registro del nodo y devuelve los pasos. '
            + 'No despliega nada: el contenedor lo arrancas tú, en tu infraestructura.',
        inputSchema: {
            tipo: z.enum(['edge', 'enterprise']).describe('Perfil de nodo'),
            entorno: z.enum(['sandbox', 'produccion']).default('sandbox')
                .describe('Empieza siempre por sandbox'),
        },
        handler: async ({ args, contexto }) => {
            const plan = provisionAsistido(args.tipo);
            const sesion = await onboarding.crear({
                kind: 'node_provision',
                prefill: { tipo: args.tipo, entorno: args.entorno },
                appId: contexto.appId,
                ip: contexto.ip,
                userAgent: contexto.userAgent,
            });
            return {
                ...plan,
                entorno: args.entorno,
                tokenRegistroUrl: sesion.url,
                onboardingId: sesion.id,
                nota: 'El token de registro se recoge en la pantalla, no por el chat: si viajara por aquí '
                    + 'quedaría en el historial de la conversación.',
            };
        },
    },
    {
        name: 'bezhas_bank_setup_start',
        anonimo: false,
        title: 'Configurar datos bancarios',
        description: 'Abre la pantalla segura para configurar cobros y pagos, precargada con los datos de la '
            + 'empresa. El número de cuenta lo escribe una persona ahí: no lo pidas por el chat ni lo mandes aquí.',
        inputSchema: {
            proposito: z.enum(['cobros', 'pagos', 'ambos']).describe('Para qué se configura'),
        },
        handler: async ({ args, contexto }) => {
            const sesion = await onboarding.crear({
                kind: 'bank_setup',
                prefill: { proposito: args.proposito },
                appId: contexto.appId,
                ip: contexto.ip,
                userAgent: contexto.userAgent,
            });
            return {
                url: sesion.url,
                onboardingId: sesion.id,
                caduca: sesion.expiresAt,
                metodos: ['domiciliacion_sepa', 'transferencia', 'tarjeta'],
                // El formulario del número de cuenta lo sirve el proveedor de
                // pagos, no nosotros: así el IBAN tampoco toca nuestros
                // servidores. Guardamos la referencia del mandato.
                dondeSeIntroduce: 'En la pantalla, servida por el proveedor de pagos. El IBAN no pasa por BeZhas '
                    + 'ni por ninguna IA.',
                porQueNoPorElChat: [
                    'Acabaría en el contexto del modelo, fuera del control de ambas partes.',
                    'Quedaría en el historial de chat, que se sincroniza entre dispositivos.',
                    'Quedaría en registros de petición nuestros y de intermediarios.',
                    'Un agente capaz de rellenar cuentas es un agente al que un documento manipulado '
                        + 'puede pedirle que rellene otra.',
                ],
                comoContarlo: 'Se abre desde aquí, ya con tus datos puestos. Lo único que escribes es el número '
                    + 'de cuenta, y lo escribes tú en una pantalla cifrada, porque ese dato no debe pasar por '
                    + 'ninguna IA — ni por la tuya ni por la nuestra.',
            };
        },
    },
];

const POR_NOMBRE = new Map(TOOLS.map((t) => [t.name, t]));

/**
 * Herramientas visibles según haya o no api-key.
 *
 * Un desconocido ve CUATRO. No es una comodidad: el resto describe cómo se
 * integra un cliente —qué ERPs, qué objetos, qué perfiles de nodo— y eso es
 * información competitiva que no se regala a quien pasaba por ahí.
 */
function toolsVisibles({ autenticado }) {
    return autenticado ? TOOLS : TOOLS.filter((t) => t.anonimo);
}

function getTool(name) {
    return POR_NOMBRE.get(name) || null;
}

module.exports = {
    TOOLS, toolsVisibles, getTool,
    SECTORES, ERPS, SDK_PAQUETE, SDK_VERSION, MAX_RESPUESTA_CHARS,
};
