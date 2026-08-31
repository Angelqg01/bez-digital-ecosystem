'use strict';

/**
 * toolCatalog — puente entre los conectores (Capa 6) y el tool-use del modelo.
 *
 * Dos responsabilidades:
 *  1. buildToolDefinitions(tools): convierte los conectores de un agente en
 *     definiciones de herramientas (formato Anthropic) que el modelo puede
 *     invocar. Una herramienta por conector: { method, args } — la misma firma
 *     que connector.execute(method, args), así CUALQUIER conector funciona.
 *  2. categoryForToolCall(tool, method, args): asigna a cada invocación del
 *     modelo la categoría que evalúan PolicyEngine/RedLines. Esta función es
 *     seguridad, no conveniencia: es lo que garantiza que una llamada nacida
 *     del modelo pasa por las MISMAS líneas rojas que el código de los agentes.
 */

// Descripción y métodos de los conectores conocidos. Un conector que no esté
// aquí sigue siendo utilizable: recibe una entrada genérica.
const CATALOG = {
  email: {
    description: 'Enviar correos electrónicos.',
    methods: {
      send: 'Envía un email. args: { to, subject, body, html?, cold? (true si es primer contacto en frío), recipientCount? }',
    },
  },
  runtime: {
    description: 'Herramientas del runtime de BeZhas: validadores, puente L1<->L2, gas y estado de la cadena. Solo consulta.',
    methods: {
      'validator-status': 'Salud de un validador. args: { operator }',
      'bridge-health': 'Estado del puente L1<->L2. args: {}',
      'gas-analytics': 'Consumo y precio del gas. args: { window? }',
      'blockchain-validator': 'Integridad de la cadena. args: {}',
      'sector-query': 'Datos de un sector del ecosistema. args: { sector, query }',
      'incident-report': 'Parte de incidencias. args: { since? }',
    },
  },
  crm: {
    description: 'CRM (Twenty): gestionar leads y oportunidades.',
    methods: {
      upsertLead: 'Crea o actualiza un lead. args: { companyName, contactName, role?, fitScore? }',
      updateDealStage: 'Mueve una oportunidad de etapa. args: { leadId, stage }',
      listLeads: 'Lista los leads existentes. args: {}',
    },
  },
  calendar: {
    description: 'Calendario del equipo: disponibilidad y reuniones.',
    methods: {
      getAvailability: 'Consulta huecos libres. args: { date? }',
      scheduleMeeting: 'Agenda una reunión. args: { with, when, subject }',
    },
  },
  stripe: {
    description: 'Cobros: enlaces de pago, facturas y suscripciones (solo lectura/emisión; nunca mueve fondos).',
    methods: {
      createPaymentLink: 'Genera un enlace de pago. args: { amount, concept }',
      getInvoice: 'Consulta una factura. args: { id }',
      checkSubscription: 'Consulta el estado de una suscripción. args: { customerId }',
    },
  },
  fs: {
    description: 'Archivos locales en carpetas autorizadas (sandbox).',
    methods: {
      list: 'Lista archivos. args: { path }',
      read: 'Lee un archivo. args: { path }',
      stat: 'Metadatos de un archivo. args: { path }',
      write: 'Crea/escribe un archivo NUEVO. args: { path, content }',
      move: 'Mueve un archivo (irreversible → aprobación humana). args: { from, to }',
      remove: 'Borra un archivo (irreversible → aprobación humana). args: { path }',
    },
  },
  storage: {
    description: 'Almacén de objetos del tenant (S3/MinIO).',
    methods: {
      put: 'Sube un objeto. args: { key, content }',
      get: 'Descarga un objeto. args: { key }',
      list: 'Lista objetos. args: { prefix? }',
      remove: 'Borra un objeto. args: { key }',
    },
  },
  vectordb: {
    description: 'Base de conocimiento vectorial del tenant (RAG).',
    methods: {
      upsert: 'Indexa un documento. args: { id, text, metadata? }',
      search: 'Busca por similitud semántica. args: { query, k? }',
    },
  },
  sysmon: {
    description: 'Métricas del sistema local (RAM, disco, latencias).',
    methods: {
      getSystemMetrics: 'Lee las métricas actuales. args: {}',
    },
  },
  automation: {
    description: 'Automatizaciones propias (n8n): dispara workflows que conectan sistemas. '
      + 'Un workflow puede hacer cualquier cosa (enviar, publicar, cobrar), así que disparar '
      + 'uno NO es inocuo: puede requerir aprobación humana según la política del cliente.',
    methods: {
      listWorkflows: 'Lista los workflows disponibles. args: {}',
      trigger: 'Dispara un workflow por su webhook. args: { workflow, payload? }',
      run: 'Ejecuta un workflow por id. args: { workflowId, payload? }',
      getExecution: 'Consulta el resultado de una ejecución. args: { id }',
    },
  },
};

/**
 * Convierte los conectores de un agente en definiciones de herramientas
 * (formato Anthropic: { name, description, input_schema }).
 *
 * Conectores dinámicos (MCP): si el conector implementa describeTools(),
 * se le preguntan sus herramientas reales y sus esquemas — así el modelo ve
 * exactamente lo que el servidor MCP ofrece, sin catálogo manual.
 *
 * @param {object} tools - { connectorName: connector } (agent.tools)
 * @param {string[]} [only] - limitar a estos conectores (p.ej. los del agente)
 */
async function buildToolDefinitions(tools = {}, only = null) {
  const names = Object.keys(tools).filter((n) => !only || only.includes(n));
  const defs = [];
  for (const name of names) {
    const connector = tools[name];

    if (typeof connector?.describeTools === 'function') {
      // Conector dinámico (MCP): una herramienta por método real del servidor.
      try {
        const mcpTools = await connector.describeTools();
        const methodDocs = mcpTools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
        defs.push({
          name,
          description: `Conector ${name} (servidor MCP).\nMétodos disponibles:\n${methodDocs}`,
          input_schema: {
            type: 'object',
            properties: {
              method: { type: 'string', enum: mcpTools.map((t) => t.name), description: 'Herramienta MCP a invocar' },
              args: { type: 'object', description: 'Argumentos según el esquema de la herramienta (ver descripción)' },
            },
            required: ['method'],
          },
        });
        continue;
      } catch (err) {
        console.warn(`[toolCatalog] ${name}: describeTools falló (${err.message}); se omite`);
        continue;
      }
    }

    const entry = CATALOG[name];
    const methods = entry ? Object.keys(entry.methods) : [];
    const methodDocs = entry
      ? Object.entries(entry.methods).map(([m, doc]) => `- ${m}: ${doc}`).join('\n')
      : 'Consulta la documentación del conector.';
    defs.push({
      name,
      description: `${entry?.description || `Conector ${name}.`}\nMétodos disponibles:\n${methodDocs}`,
      input_schema: {
        type: 'object',
        properties: {
          method: methods.length
            ? { type: 'string', enum: methods, description: 'Método del conector a invocar' }
            : { type: 'string', description: 'Método del conector a invocar' },
          args: { type: 'object', description: 'Argumentos del método (ver descripción)' },
        },
        required: ['method'],
      },
    });
  }
  return defs;
}

/**
 * Traduce una invocación del modelo a la acción que evalúan PolicyEngine y
 * RedLines. Aquí se decide qué categoría (y banderas) lleva cada llamada:
 * si el mapeo es incorrecto, el guardrail no salta — mantener alineado con
 * guardrails/RedLines.js.
 */
function categoryForToolCall(tool, method, args = {}) {
  if (tool === 'email' && method === 'send') {
    return {
      category: 'outbound',
      cold: args.cold === true,
      recipientCount: Number(args.recipientCount || 1),
    };
  }
  if (tool === 'stripe') {
    // Emitir enlaces/consultar es 'billing'; cualquier método que mueva fondos
    // (si algún día existe) debe caer en 'payment' → línea roja money_movement.
    const moves = ['pay', 'transfer', 'refund', 'payout', 'disburse'];
    return { category: moves.includes(method) ? 'payment' : 'billing' };
  }
  if (tool === 'fs') {
    return { category: 'filesystem' }; // RedLines bloquea move/remove por método
  }
  if (tool === 'storage') {
    return { category: 'storage' };
  }
  if (tool === 'automation') {
    // Un workflow de n8n es poder arbitrario: leer se separa de ejecutar para que
    // el tenant pueda dejar consultar sin dejar disparar
    // (PUT /tenants/:id/policies/automation → always_approve).
    const reads = ['listWorkflows', 'getExecution'];
    return { category: reads.includes(method) ? 'automation_read' : 'automation' };
  }
  if (tool === 'linkedin') {
    // Publicar en LinkedIn es comunicación pública → HITL vía RedLine `public_post`.
    return { category: method === 'me' ? 'external_read' : 'public_post', audience: 'public' };
  }
  if (tool === 'runtime') {
    // Infraestructura de la cadena. Hoy la lista blanca del conector solo deja
    // consultas, así que `infra_read`: un tenant puede endurecerla, y si algún
    // día entra una tool que despliegue o firme, tiene que salir de aquí con
    // categoría propia para que RedLines la vea (contract_deploy / crypto_*).
    const escriben = ['deploy-check', 'incident-report'];
    return { category: escriben.includes(method) ? 'infra_write' : 'infra_read' };
  }
  if (tool === 'crm') return { category: 'crm' };
  if (tool === 'calendar') return { category: 'calendar' };
  if (tool === 'vectordb') return { category: 'knowledge' };
  if (tool === 'sysmon') return { category: 'ops' };
  // Conector desconocido: su nombre es la categoría (el tenant puede endurecerla
  // con overrides siempre; lo desconocido nunca esquiva el PolicyEngine).
  return { category: tool };
}

/**
 * Métodos de SOLO LECTURA por conector. Consultar no deja rastro fuera del
 * sistema, así que una tarea que solo ha leído puede reintentarse sin peligro.
 *
 * Todo lo que NO esté aquí se considera con efecto (enviar, escribir, borrar,
 * cobrar, disparar un workflow…). El default conservador es deliberado: si
 * mañana alguien añade un método y olvida clasificarlo, el sistema se vuelve
 * MÁS cauto (no reintenta), nunca menos — el fallo cae del lado seguro.
 */
const READ_ONLY_METHODS = {
  crm: ['listLeads'],
  calendar: ['getAvailability'],
  stripe: ['getInvoice', 'checkSubscription'],
  fs: ['list', 'read', 'stat'],
  storage: ['get', 'list'],
  vectordb: ['search'],
  sysmon: ['getSystemMetrics'],
  automation: ['listWorkflows', 'getExecution'],
  blockchain: ['balance'],
  // BeZhasCoreConnector es de solo lectura por diseño (no expone escritura).
  'bezhas-core': ['chainOverview', 'validatorStats', 'treasuryStats', 'gasStatus', 'governanceProposals'],
  // LinkedIn: `me` es OIDC userinfo (solo lectura). `share` publica y va por HITL.
  linkedin: ['me'],
};

/**
 * ¿Esta invocación deja huella fuera del sistema?
 * Se usa para decidir si una tarea fallida puede reintentarse automáticamente:
 * reintentar algo que ya envió un email lo enviaría dos veces.
 */
function hasSideEffect(tool, method) {
  const reads = READ_ONLY_METHODS[tool];
  if (!reads) return true;              // conector desconocido → asumimos efecto
  return !reads.includes(method);
}

/**
 * Variante con acceso al conector: los dinámicos (MCP) declaran su propia
 * categoría de política (config.policyCategory, def. 'external') para que el
 * tenant pueda endurecer TODO lo externo con un solo override.
 */
function categoryForConnectorCall(connector, tool, method, args = {}) {
  if (connector && typeof connector.describeTools === 'function') {
    return { category: connector.policyCategory || 'external' };
  }
  return categoryForToolCall(tool, method, args);
}

module.exports = {
  CATALOG, READ_ONLY_METHODS,
  buildToolDefinitions, categoryForToolCall, categoryForConnectorCall, hasSideEffect,
};
