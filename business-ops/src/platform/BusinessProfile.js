'use strict';

const fs = require('fs');
const path = require('path');

/**
 * BusinessProfile — el "quién somos y cómo vendemos" de un tenant.
 *
 * Convierte un perfil de negocio (config/business/<id>.json o un fact del
 * tenant) en:
 *   - un PREÁMBULO de sistema que se antepone al prompt de cada agente, para
 *     que hablen como la empresa, con su lenguaje y sus reglas de honestidad;
 *   - utilidades de negocio: cuentas excluidas, segmentación y guía de scoring.
 *
 * Es la pieza que hace que "grounding en un negocio real" sea multi-tenant:
 * cada empresa cliente define su perfil y su ejército de agentes lo respeta.
 * Las restricciones duras (cuentas excluidas, cripto en frío, C-level) se
 * aplican además en los guardrails; el preámbulo es la primera línea de defensa.
 */
class BusinessProfile {
  /** Etiqueta legible de cada departamento, para el nombre visible del remitente. */
  static DEPARTMENT_LABELS = {
    sales: 'Ventas',
    support: 'Soporte',
    marketing: 'Marketing',
    finance: 'Facturación',
    hr: 'RR.HH.',
    operations: 'Operaciones',
    blockchain: 'Infraestructura',
    legal: 'Legal',
    treasury: 'Tesorería',
    fundraising: 'Inversores',
  };

  constructor(data = {}) {
    this.data = data;
  }

  static fromFile(id) {
    const file = path.join(__dirname, '../../config/business', `${id}.json`);
    if (!fs.existsSync(file)) return null;
    return new BusinessProfile(JSON.parse(fs.readFileSync(file, 'utf8')));
  }

  get id() { return this.data.id; }
  get company() { return this.data.company; }
  get signature() { return this.data.signature || ''; }

  /** ¿La cuenta está vetada (Acuerdo V1, partner confirmado, exclusión explícita)? */
  isExcluded({ company = '', tags = [] } = {}) {
    const c = String(company).toLowerCase().trim();
    if (c && (this.data.excludedAccounts || []).some((x) => c.includes(x))) return true;
    const t = tags.map((x) => String(x).toLowerCase());
    return t.some((tag) => (this.data.excludedTags || []).includes(tag));
  }

  /**
   * Segmento del prospecto por coincidencia de términos (o 'sin_clasificar').
   *
   * Compara por PALABRA COMPLETA, no por subcadena. Con `includes()` la palabra
   * clave "port" casaba dentro de "exportador" e "importador", así que un
   * exportador de perecederos se clasificaba como puerto y recibía el discurso
   * equivocado. El mismo problema con "aduana"/"aduanas" o "seguro"/"seguros"
   * queda cubierto por los plurales del propio listado, no por casar a trozos.
   */
  segmentOf({ company = '', role = '', notes = '' } = {}) {
    const hay = `${company} ${role} ${notes}`.toLowerCase();
    for (const s of this.data.segments || []) {
      if ((s.keywords || []).some((k) => BusinessProfile._mentions(hay, k))) return s.key;
    }
    return 'sin_clasificar';
  }

  /** ¿El texto menciona el término como palabra (o expresión) completa? */
  static _mentions(haystack, keyword) {
    const term = String(keyword).toLowerCase().trim();
    if (!term) return false;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // \p{L}\p{N} en vez de \b: \b es ASCII y trataría la tilde de "logística"
    // como frontera de palabra, partiendo términos en castellano por la mitad.
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(haystack);
  }

  /** Guía de scoring (para el prompt del Lead Scorer). */
  scoringGuide() {
    return (this.data.scoringBands || [])
      .map((b) => `- ${b.min}-${b.max}: ${b.criterio}`)
      .join('\n');
  }

  /**
   * Preámbulo de sistema. mode:
   *   'cold'  → primer contacto: reglas estrictas (sin cripto, sin enlaces de pago).
   *   'warm'  → cliente que ya escribió o conversación avanzada.
   *   'base'  → contexto general (managers, scoring).
   */
  preamble(mode = 'base') {
    const d = this.data;
    const lines = [
      `EMPRESA: ${d.company}. ${d.oneLiner || ''}`,
      d.valueProps?.length ? `PROPUESTA DE VALOR:\n${d.valueProps.map((v) => `- ${v}`).join('\n')}` : '',
    ];

    if (d.translationLayer?.length) {
      lines.push(
        'LENGUAJE (traduce SIEMPRE la tecnología a beneficio de negocio):\n' +
        d.translationLayer.map((t) => `- "${t.de}" → "${t.a}" (${t.impacto})`).join('\n')
      );
    }
    if (d.honestyRules?.length) {
      lines.push('REGLAS DE HONESTIDAD:\n' + d.honestyRules.map((r) => `- ${r}`).join('\n'));
    }
    if (d.markets?.length) {
      lines.push(`MERCADOS OBJETIVO: ${d.markets.join(', ')}.`);
    }
    if (mode === 'cold' && d.coldCopyRules?.length) {
      lines.push('REGLAS DE PRIMER CONTACTO EN FRÍO:\n' + d.coldCopyRules.map((r) => `- ${r}`).join('\n'));
    }
    // Las plantillas solo en frío: es donde se usan. Meterlas en el preámbulo de
    // los 60 agentes gastaría contexto en los 59 que no redactan prospección —
    // y con un modelo local pequeño, el contexto que sobra es el que estorba.
    if (mode === 'cold' && d.outreachTemplates?.length) {
      lines.push(
        'ÁNGULOS DE REFERENCIA POR TIPO DE CUENTA (son una guía, NO un texto para copiar: ' +
        'dos prospectos no pueden recibir el mismo correo):\n' +
        d.outreachTemplates.map((t) => `- ${t.para} → asunto tipo "${t.asunto}". ${t.angulo}`).join('\n')
      );
    }
    if (mode !== 'base' && d.channelPolicy?.rules?.length) {
      lines.push(
        `CANAL: principal ${d.channelPolicy.primary}` +
        (d.channelPolicy.escalation?.length ? `, alternativas ${d.channelPolicy.escalation.join(', ')}` : '') +
        '.\n' + d.channelPolicy.rules.map((r) => `- ${r}`).join('\n')
      );
    }
    if (d.humanEscalation?.length) {
      lines.push('REQUIERE APROBACIÓN HUMANA:\n' + d.humanEscalation.map((r) => `- ${r}`).join('\n'));
    }
    if (d.onchainAssets?.length) {
      lines.push(
        'ACTIVOS ON-CHAIN REALES (nunca autorices ni sugieras mover esto sin aprobación humana explícita):\n' +
        d.onchainAssets.map((a) => `- ${a.label} (${a.network}): ${a.address}`).join('\n')
      );
    }
    if (mode !== 'cold' && d.glassPipe) {
      lines.push(`ANALOGÍA DISPONIBLE (Tubería de Cristal): ${d.glassPipe}`);
    }
    return lines.filter(Boolean).join('\n\n');
  }

  /**
   * Remitente del departamento, listo para la cabecera From.
   *
   * Cada departamento habla desde su propio buzón (ventas@, soporte@,
   * facturacion@…) en vez de todos desde un `no-reply@` genérico. No es
   * cosmético: quien recibe responde a un buzón que alguien lee, y el que abre
   * el correo sabe con qué área está hablando.
   *
   * Devuelve `null` si el perfil no declara correo — quien llame debe caer al
   * remitente global (MAIL_FROM), nunca inventarse una dirección.
   *
   * @param {string} department  clave del departamento (sales, support…)
   * @returns {string|null} `BeZhas · Ventas <ventas@bez.digital>` o null
   */
  senderFor(department) {
    const cfg = this.data.email;
    if (!cfg) return null;
    const propio = department ? cfg.byDepartment?.[department] : null;
    const address = propio || cfg.default;
    if (!address) return null;

    // El dominio del remitente tiene que ser el que autorizan SPF/DKIM: enviar
    // desde otro dominio hace que DMARC lo rechace. Un buzón mal escrito en el
    // perfil no debe traducirse en correos que no llegan y nadie sabe por qué.
    if (cfg.domain && !address.toLowerCase().endsWith(`@${String(cfg.domain).toLowerCase()}`)) {
      return null;
    }

    // La etiqueta del departamento solo si el buzón es SUYO. Si se ha caído al
    // general, poner "BeZhas · Legal" delante de hola@ engaña a quien recibe:
    // cree que escribe a Legal y su respuesta acaba en otra bandeja.
    const etiqueta = propio ? BusinessProfile.DEPARTMENT_LABELS[department] : null;
    const nombre = [cfg.displayName, etiqueta].filter(Boolean).join(' · ');
    return nombre ? `${nombre} <${address}>` : address;
  }

  /** Buzones declarados, para verificar que existen en el servidor de correo. */
  mailboxes() {
    const cfg = this.data.email;
    if (!cfg) return [];
    const todos = [...Object.values(cfg.byDepartment || {}), cfg.default].filter(Boolean);
    return [...new Set(todos)];
  }

  /** Objeto plano para persistir como fact del tenant. */
  toJSON() { return this.data; }
}

module.exports = BusinessProfile;
