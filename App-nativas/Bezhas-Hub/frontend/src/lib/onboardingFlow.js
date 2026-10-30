/**
 * Cuestionario guiado del chat: pasos y reglas. Los valores son los enumerados que acepta la API
 * (api/services/onboardingGuided.js); no hay texto libre, así que no hay dónde escribir un secreto.
 *
 * Orden: 4 preguntas del descubrimiento → email (con consentimiento) → 2 preguntas de arquitectura →
 * recomendación → pantalla segura (contraseña, KYB, custodia, DPA…), que NUNCA se pide aquí.
 */

const opt = (value, label) => ({ value, label });

export const STEPS = [
    {
        id: 'cargo', kind: 'single', title: '¿Qué papel tienes en la empresa?',
        hint: 'Así sabemos si puedes contratar o solo evaluar.',
        options: [
            opt('direccion', 'Dirección / CEO'), opt('ti', 'TI / CTO'), opt('finanzas', 'Finanzas'),
            opt('operaciones', 'Operaciones'), opt('cumplimiento', 'Cumplimiento'),
            opt('desarrollo', 'Desarrollo / integración'), opt('otro', 'Otro'),
        ],
    },
    {
        id: 'estructura', kind: 'single', title: '¿Cómo está organizada tu empresa?',
        options: [opt('unica', 'Una sola sociedad'), opt('filial', 'Filial de un grupo'), opt('holding', 'Holding'), opt('grupo', 'Grupo multinacional')],
    },
    {
        id: 'empresa', kind: 'group', title: 'Cuéntanos de tu empresa',
        fields: [
            {
                id: 'sector', label: 'Sector', options: [
                    opt('logistica', 'Logística y transporte'), opt('aduanas', 'Aduanas'), opt('energia', 'Energía'),
                    opt('industria', 'Industria'), opt('inmobiliario', 'Inmobiliario'), opt('fintech', 'Fintech'),
                    opt('legal', 'Legal'), opt('agroalimentario', 'Agroalimentario'), opt('seguros', 'Seguros'),
                    opt('salud', 'Salud'), opt('publico', 'Sector público'), opt('otro', 'Otro'),
                ],
            },
            { id: 'empleados', label: 'Trabajadores', options: ['1-10', '11-50', '51-250', '251-1000', '1000+'].map((v) => opt(v, v)) },
            {
                id: 'facturacion', label: 'Facturación anual', options: [
                    opt('<250k', 'Menos de 250 mil €'), opt('250k-1m', '250 mil – 1 M€'), opt('1m-5m', '1 – 5 M€'),
                    opt('5m-20m', '5 – 20 M€'), opt('20m-100m', '20 – 100 M€'), opt('100m+', 'Más de 100 M€'),
                ],
            },
            {
                id: 'documentos', label: 'Documentos u operaciones al mes', options: [
                    opt('<1k', 'Menos de 1.000'), opt('1k-10k', '1.000 – 10.000'), opt('10k-100k', '10.000 – 100.000'), opt('100k+', 'Más de 100.000'),
                ],
            },
        ],
    },
    {
        id: 'caso', kind: 'single', title: '¿Qué quieres resolver primero?',
        hint: 'Empieza por un proceso piloto; el resto viene después.',
        options: [
            opt('documentos', 'Automatizar documentos'), opt('trazabilidad', 'Trazabilidad de operaciones'), opt('pagos', 'Pagos y cobros'),
            opt('tokenizar', 'Tokenizar activos'), opt('calidad', 'Certificar calidad'), opt('energia', 'Energía y certificados'),
            opt('agentes_ia', 'Conectar agentes de IA'), opt('evidencias', 'Compartir evidencias con terceros'),
        ],
    },
    // ── aquí se pide el email (fase 'email') ──
    {
        id: 'integraciones', kind: 'multi', title: '¿Cómo quieres integrar BeZhas?', hint: 'Puedes elegir varias.',
        options: [opt('erp', 'Conectar mi ERP'), opt('sdk', 'SDK'), opt('api', 'API REST'), opt('mcp', 'Agentes de IA (MCP)')],
    },
    {
        id: 'erp', kind: 'single', title: '¿Qué ERP usas?', when: (a) => (a.integraciones || []).includes('erp'),
        options: [
            opt('sap_b1', 'SAP Business One'), opt('sap_s4hana', 'SAP S/4HANA'), opt('netsuite', 'Oracle NetSuite'),
            opt('dynamics', 'Microsoft Dynamics 365'), opt('odoo', 'Odoo'),
        ],
    },
    {
        id: 'participacion', kind: 'single', title: '¿Qué papel quieres tener en la blockchain?',
        options: [
            opt('lectura', 'Solo consultar y verificar'), opt('escritura', 'Registrar evidencias'),
            opt('firma', 'Firmar operaciones'), opt('validacion', 'Validar en la red'),
        ],
    },
];

/** Pasos que se hacen antes del email. */
export const STEPS_BEFORE_EMAIL = 4;

/** Siguiente paso visible a partir de `from` (salta los que no aplican). -1 si no quedan. */
export function nextIndex(from, answers) {
    for (let i = from + 1; i < STEPS.length; i++) {
        if (!STEPS[i].when || STEPS[i].when(answers)) return i;
    }
    return -1;
}

/** Aplana las respuestas del paso `group` al perfil que espera la API. */
export function toProfile(answers) {
    const p = {
        cargo: answers.cargo, estructura: answers.estructura, sector: answers.sector, empleados: answers.empleados,
        facturacion: answers.facturacion, documentos: answers.documentos, caso: answers.caso,
    };
    if (answers.integraciones && answers.integraciones.length) p.integraciones = answers.integraciones;
    if (answers.erp && (answers.integraciones || []).includes('erp')) p.erp = answers.erp;
    if (answers.participacion) p.participacion = answers.participacion;
    return p;
}

export const isEmail = (v) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(String(v).trim());

export const labelOf = (stepId, value) => {
    for (const s of STEPS) {
        const lists = s.kind === 'group' ? s.fields.map((f) => f.options) : [s.options];
        if (s.id === stepId || (s.kind === 'group' && s.fields.some((f) => f.id === stepId))) {
            for (const l of lists) { const o = l.find((x) => x.value === value); if (o) return o.label; }
        }
    }
    return String(value);
};
