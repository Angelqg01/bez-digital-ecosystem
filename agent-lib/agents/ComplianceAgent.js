/**
 * BeZhas Agent Runtime — ComplianceAgent
 * Cumplimiento regulatorio completo para España y UE:
 *
 *   MiCA (Markets in Crypto-Assets Regulation)
 *     → Clasificación de tokens, licencias VASP, whitepaper
 *     → Límites de emisión, reservas, reporting
 *
 *   DAC8 (Directive on Administrative Cooperation 8)
 *     → Reporting automático de transacciones cripto a AEAT
 *     → Umbrales: >1.000€ y >10.000€ anuales
 *     → Intercambio de información entre estados UE
 *
 *   Modelo 720 (Bienes en el Extranjero)
 *     → Activos cripto fuera de España > 50.000€
 *     → Declaración anual obligatoria
 *
 *   AEAT Modelos específicos
 *     → Modelo 172: saldos en criptomonedas (exchanges ES)
 *     → Modelo 173: operaciones con criptomonedas
 *     → Ganancias/pérdidas patrimoniales IRPF
 *
 *   CNMV / Banco de España
 *     → Registro como VASP (Proveedor de Servicios de Activos Virtuales)
 *     → AML/KYC checks (5ª Directiva Blanqueo)
 */

'use strict';

const BaseAgent = require('../BaseAgent');

// ─── Umbrales regulatorios ─────────────────────────────────────────────────

const THRESHOLDS = {
  // DAC8 — reporting obligatorio
  dac8SingleTx:   1_000,    // €: tx individual a reportar
  dac8Annual:     10_000,   // €: suma anual a reportar por usuario
  // Modelo 720
  modelo720:      50_000,   // €: activos cripto fuera de España
  // AMLD5 — KYC obligatorio
  kycThreshold:   1_000,    // €: operación que requiere KYC completo
  amlAlert:       10_000,   // €: alerta AML automática
  // MiCA — límites de emisión stablecoins
  micaStablecoin: 200_000_000, // €: volumen diario máximo sin licencia e-money
};

// Tasas impositivas IS España (ZEC Canarias = 4%, Startup = 15%, General = 25%)
const TAX_RATES = {
  general:     0.25,
  startup:     0.15,
  zec:         0.04,
  irpf_bands:  [
    { from: 0,       to: 6_000,   rate: 0.19 },
    { from: 6_000,   to: 50_000,  rate: 0.21 },
    { from: 50_000,  to: 200_000, rate: 0.23 },
    { from: 200_000, to: Infinity, rate: 0.26 },
  ],
};

// Clasificación de tokens bajo MiCA
const MICA_TOKEN_TYPES = {
  ART:  'Asset-Referenced Token',   // referenciado a activos
  EMT:  'E-Money Token',            // referenciado a moneda fiat
  OTHER:'Other Crypto-Asset',       // tokens de utilidad (BEZ = este)
};

// ─── ComplianceAgent ──────────────────────────────────────────────────────

class ComplianceAgent extends BaseAgent {
  constructor(opts = {}) {
    super({
      id:           'compliance-agent',
      name:         'BeZhas Compliance Agent',
      capabilities: [
        'compliance:check',
        'compliance:mica',
        'compliance:dac8',
        'compliance:modelo720',
        'compliance:aeat',
        'compliance:aml',
        'compliance:kyc',
        'compliance:report',
      ],
      version: '1.0.0',
      ...opts,
    });

    this._violations     = [];
    this._reportsIssued  = 0;
    this._checkedEntities = new Map(); // address → último check
  }

  // ─── EXECUTE ─────────────────────────────────────────────────────────────

  async execute(task) {
    switch (task.type) {
      case 'compliance:check':     return this._runFullCheck(task);
      case 'compliance:mica':      return this._checkMiCA(task);
      case 'compliance:dac8':      return this._checkDAC8(task);
      case 'compliance:modelo720': return this._checkModelo720(task);
      case 'compliance:aeat':      return this._generateAEATReport(task);
      case 'compliance:aml':       return this._checkAML(task);
      case 'compliance:kyc':       return this._runKYC(task);
      case 'compliance:report':    return this._generateComplianceReport(task);
      default:
        throw new Error(`ComplianceAgent no soporta: ${task.type}`);
    }
  }

  // ─── CHECK COMPLETO ───────────────────────────────────────────────────────

  async _runFullCheck(task) {
    const { address, txAmount, annualVolume, assetsAbroad, entityType = 'empresa' } = task.payload || {};

    console.log(`[ComplianceAgent] 🔍 Check completo para ${address || 'plataforma'}`);

    const [mica, dac8, m720, aml] = await Promise.allSettled([
      this._checkMiCA({ payload: { entityType, txAmount } }),
      this._checkDAC8({ payload: { address, txAmount, annualVolume } }),
      this._checkModelo720({ payload: { address, assetsAbroad } }),
      this._checkAML({ payload: { address, txAmount } }),
    ]);

    const results = {
      address,
      timestamp:  new Date().toISOString(),
      mica:       mica.status  === 'fulfilled' ? mica.value  : { error: mica.reason?.message },
      dac8:       dac8.status  === 'fulfilled' ? dac8.value  : { error: dac8.reason?.message },
      modelo720:  m720.status  === 'fulfilled' ? m720.value  : { error: m720.reason?.message },
      aml:        aml.status   === 'fulfilled' ? aml.value   : { error: aml.reason?.message },
    };

    // Score global de compliance (0-100)
    results.complianceScore = this._calculateScore(results);
    results.status          = results.complianceScore >= 80 ? 'compliant'
                            : results.complianceScore >= 50 ? 'needs-review'
                            : 'non-compliant';

    // Análisis LLM del estado de compliance
    results.summary = await this._analyzeLLM(results);

    // Notificar resultado
    const icon = results.status === 'compliant' ? '✅' : results.status === 'needs-review' ? '⚠️' : '🔴';
    await this.notify(
      `${icon} *Compliance Check*\n` +
      `Entidad: \`${address?.slice(0,10) || 'global'}...\`\n` +
      `Score: ${results.complianceScore}/100\n` +
      `Estado: ${results.status.toUpperCase()}\n\n` +
      `${results.summary.slice(0, 350)}`,
      { level: results.status === 'compliant' ? 'success' : results.status === 'needs-review' ? 'warning' : 'critical' }
    );

    // Si hay violaciones, escalar a HITL
    if (results.status === 'non-compliant' && this.manager) {
      await this.requireApproval(task.id, {
        type:        'compliance:violation',
        title:       '🔴 Violación de Compliance Detectada',
        description: results.summary,
        severity:    'critical',
        entity:      address,
        score:       results.complianceScore,
      }).catch(() => null); // no bloquear si hay timeout
    }

    await this.remember(`check:${address || 'global'}:${Date.now()}`, results);
    this._checkedEntities.set(address, results);
    return results;
  }

  // ─── MICA ─────────────────────────────────────────────────────────────────

  async _checkMiCA(task) {
    const { entityType = 'empresa', txAmount = 0, dailyVolume = 0 } = task.payload || {};

    const checks = {
      tokenClassification: {
        type:         MICA_TOKEN_TYPES.OTHER,
        description:  'BEZ-Coin clasificado como Utility Token (Other Crypto-Asset)',
        requiresLicense: false,
        requiresWhitepaper: true,
        whitepaperStatus: 'required', // pending | submitted | approved
      },
      whitepaper: {
        required:    true,
        fields:      ['issuer info', 'token description', 'risk factors', 'rights', 'technology'],
        status:      'pending',
        deadline:    '2024-12-30',
      },
      vasp: {
        required:    true,
        description: 'Registro como VASP en Banco de España',
        status:      'pending',
        authority:   'Banco de España / CNMV',
      },
      stablecoinLimits: {
        applicable:  false, // BEZ no es stablecoin
        note:        'BEZ-Coin no está sujeto a límites EMT/ART de MiCA',
      },
      reserveRequirements: {
        applicable:  false,
        note:        'No aplica para utility tokens',
      },
      dailyVolumeLimit: {
        applicable:    false,
        currentVolume: dailyVolume,
        limit:         THRESHOLDS.micaStablecoin,
        withinLimit:   true,
      },
    };

    const issues = [];
    if (checks.whitepaper.status !== 'approved') {
      issues.push({ severity:'high', text:'Whitepaper MiCA pendiente de registro ante CNMV' });
    }
    if (checks.vasp.status !== 'registered') {
      issues.push({ severity:'high', text:'Registro VASP pendiente en Banco de España' });
    }

    return {
      framework:  'MiCA (EU 2023/1114)',
      compliant:  issues.length === 0,
      score:      issues.length === 0 ? 100 : 100 - (issues.length * 25),
      checks,
      issues,
      actions:    [
        'Registrar whitepaper ante CNMV (Art. 6 MiCA)',
        'Solicitar registro VASP en Banco de España',
        'Establecer política AML/KYC compatible con MiCA',
        'Publicar informe anual de actividad (Art. 22 MiCA)',
      ],
    };
  }

  // ─── DAC8 ─────────────────────────────────────────────────────────────────

  async _checkDAC8(task) {
    const { address, txAmount = 0, annualVolume = 0 } = task.payload || {};

    const singleTxFlag  = txAmount >= THRESHOLDS.dac8SingleTx;
    const annualFlag    = annualVolume >= THRESHOLDS.dac8Annual;

    const reportingDue = {
      singleTransaction: {
        triggered:   singleTxFlag,
        threshold:   `${THRESHOLDS.dac8SingleTx.toLocaleString()} €`,
        amount:      txAmount,
        action:      singleTxFlag ? 'Reportar a AEAT en plazo de 30 días' : null,
      },
      annualVolume: {
        triggered:   annualFlag,
        threshold:   `${THRESHOLDS.dac8Annual.toLocaleString()} €/año`,
        amount:      annualVolume,
        action:      annualFlag ? 'Incluir en informe DAC8 anual — Modelo 173' : null,
      },
    };

    const issues = [];
    if (singleTxFlag) issues.push({ severity:'medium', text:`Transacción >1.000€ requiere reporting DAC8 (${txAmount.toLocaleString()}€)` });
    if (annualFlag)   issues.push({ severity:'high',   text:`Volumen anual >10.000€ requiere informe DAC8 (${annualVolume.toLocaleString()}€)` });

    return {
      framework:    'DAC8 (Directiva 2023/2226/UE)',
      address,
      compliant:    issues.length === 0,
      score:        issues.length === 0 ? 100 : 60,
      reportingDue,
      issues,
      deadline:     'Enero del año siguiente al ejercicio fiscal',
      authority:    'AEAT (España) + intercambio automático UE',
      models:       ['Modelo 173 (operaciones)', 'Modelo 172 (saldos)'],
      actions:      issues.map(i => i.text),
    };
  }

  // ─── MODELO 720 ────────────────────────────────────────────────────────────

  async _checkModelo720(task) {
    const { address, assetsAbroad = 0 } = task.payload || {};

    const obligated = assetsAbroad >= THRESHOLDS.modelo720;

    const analysis = {
      threshold:    `${THRESHOLDS.modelo720.toLocaleString()} € en activos fuera de España`,
      currentValue: assetsAbroad,
      obligated,
      deadline:     '31 de marzo de cada año (ejercicio anterior)',
      penalty:      obligated ? 'Sanción: 10.000€ por dato no declarado (mín. 30.000€)' : null,
      items: [
        'Criptomonedas en exchanges/wallets fuera de España',
        'NFTs con valor > 50.000€ custodios en el extranjero',
        'DeFi positions en protocolos no establecidos en ES/UE',
      ],
    };

    const issues = obligated
      ? [{ severity:'high', text:`Activos extranjeros ${assetsAbroad.toLocaleString()}€ > umbral Modelo 720` }]
      : [];

    return {
      framework: 'Modelo 720 (RD 1558/2012 + Ley 7/2012)',
      address,
      compliant: !obligated,
      score:     obligated ? 30 : 100,
      analysis,
      issues,
      authority: 'AEAT',
      actions:   obligated ? [
        'Presentar Modelo 720 antes del 31 de marzo',
        'Documentar valoración de activos a 31/12 del ejercicio',
        'Consultar con asesor fiscal especializado en cripto',
      ] : ['Sin acción requerida'],
    };
  }

  // ─── AEAT — IRPF + IS ─────────────────────────────────────────────────────

  async _generateAEATReport(task) {
    const {
      gains        = 0,
      losses       = 0,
      revenue      = 0,
      entityType   = 'empresa',
      taxRegime    = 'general',   // general | startup | zec
      year         = new Date().getFullYear() - 1,
    } = task.payload || {};

    const netGain   = gains - losses;
    const taxRate   = TAX_RATES[taxRegime] || TAX_RATES.general;

    // IS para empresas
    const isBase    = Math.max(0, revenue);
    const isDue     = isBase * taxRate;

    // IRPF para personas físicas (si aplica)
    const irpfDue   = this._calculateIRPF(netGain);

    // Ganancias patrimoniales cripto
    const capitalGains = {
      gross:         gains,
      losses,
      net:           netGain,
      taxable:       netGain > 0,
      taxBand:       this._getIRPFBand(netGain),
    };

    const report = {
      year,
      entityType,
      taxRegime,
      taxRateIS:    `${(taxRate * 100).toFixed(0)}%`,
      is: {
        base:     isBase,
        rate:     taxRate,
        due:      isDue,
        models:   ['Modelo 200 (IS anual)', 'Modelo 202 (pago fraccionado)'],
      },
      irpf: {
        netGain,
        due:       irpfDue,
        model:     'Modelo 100 (RENTA)',
        schedule:  'Apéndice D — Ganancias y pérdidas patrimoniales',
      },
      capitalGains,
      vatCrypto: {
        applicable: false,
        note:       'Intercambio cripto-fiat exento IVA (TJUE C-264/14 Hedqvist)',
      },
      cryptoModels: [
        { model:'Modelo 172', desc:'Saldos en criptomonedas (presentan los exchanges)' },
        { model:'Modelo 173', desc:'Operaciones con criptomonedas (presentan los exchanges)' },
        { model:'Modelo 100', desc:'IRPF personal — ganancias patrimoniales cripto' },
        { model:'Modelo 200', desc:'IS empresas — ingresos por servicios blockchain' },
      ],
      deadline:     `${year + 1}-06-30 (IS) / ${year + 1}-06-30 (IRPF)`,
      totalTaxDue:  isDue + irpfDue,
    };

    const llmSummary = await this.think(`
Resume en 3-4 frases el informe fiscal de BeZhas para el año ${year}:
- Régimen fiscal: ${taxRegime} (${(taxRate*100).toFixed(0)}% IS)
- Revenue fiscal: ${revenue.toLocaleString('es-ES')}€
- IS estimado: ${isDue.toLocaleString('es-ES')}€
- Ganancias patrimoniales netas: ${netGain.toLocaleString('es-ES')}€
- IRPF estimado: ${irpfDue.toLocaleString('es-ES')}€
- Total obligaciones: ${(isDue + irpfDue).toLocaleString('es-ES')}€

Sé conciso y práctico. Destaca los plazos más importantes. Responde en español.
`, { maxTokens: 300 });

    report.llmSummary = llmSummary;

    await this.notify(
      `📊 *Informe Fiscal AEAT ${year}*\n` +
      `Régimen: ${taxRegime.toUpperCase()} (${(taxRate*100).toFixed(0)}% IS)\n` +
      `IS estimado: ${isDue.toLocaleString('es-ES')}€\n` +
      `IRPF estimado: ${irpfDue.toLocaleString('es-ES')}€\n` +
      `*Total: ${(isDue+irpfDue).toLocaleString('es-ES')}€*\n\n` +
      `${llmSummary.slice(0, 300)}`,
      { level: 'info' }
    );

    this._reportsIssued++;
    await this.remember(`aeat_report_${year}`, report);
    return report;
  }

  // ─── AML / KYC ────────────────────────────────────────────────────────────

  async _checkAML(task) {
    const { address, txAmount = 0, country = 'ES' } = task.payload || {};

    const highRiskCountries = ['IR','KP','SY','MM','CU','AF'];
    const countryRisk       = highRiskCountries.includes(country) ? 'HIGH' : 'LOW';
    const amountRisk        = txAmount >= THRESHOLDS.amlAlert ? 'HIGH'
                            : txAmount >= THRESHOLDS.kycThreshold ? 'MEDIUM' : 'LOW';

    const overallRisk = (countryRisk === 'HIGH' || amountRisk === 'HIGH') ? 'HIGH'
                      : amountRisk === 'MEDIUM' ? 'MEDIUM' : 'LOW';

    const issues = [];
    if (countryRisk === 'HIGH') issues.push({ severity:'critical', text:`País de alto riesgo FATF: ${country}` });
    if (txAmount >= THRESHOLDS.amlAlert) issues.push({ severity:'high', text:`Transacción >10.000€ — alerta AML automática (${txAmount.toLocaleString()}€)` });
    if (txAmount >= THRESHOLDS.kycThreshold && txAmount < THRESHOLDS.amlAlert) {
      issues.push({ severity:'medium', text:`KYC completo requerido >1.000€ (5ª Directiva AML)` });
    }

    return {
      framework:   '5ª Directiva AML (2018/843/UE) + Ley 10/2010 ES',
      address,
      overallRisk,
      countryRisk,
      amountRisk,
      compliant:   issues.length === 0,
      score:       overallRisk === 'LOW' ? 100 : overallRisk === 'MEDIUM' ? 70 : 30,
      issues,
      kycRequired: txAmount >= THRESHOLDS.kycThreshold,
      sarRequired:  txAmount >= THRESHOLDS.amlAlert || countryRisk === 'HIGH',
      actions:      issues.length === 0 ? ['Sin acción requerida'] : [
        txAmount >= THRESHOLDS.amlAlert ? 'Reportar SAR (Suspicious Activity Report) al SEPBLAC' : null,
        txAmount >= THRESHOLDS.kycThreshold ? 'Solicitar documentación KYC completa al usuario' : null,
        countryRisk === 'HIGH' ? 'Bloquear operación — país FATF lista negra/gris' : null,
      ].filter(Boolean),
    };
  }

  async _runKYC(task) {
    const { address, documentType, country = 'ES' } = task.payload || {};

    // En producción: integrar con proveedor KYC (Jumio, Onfido, Sumsub)
    const kycLevels = {
      basic: {
        required:   'email + nombre completo',
        threshold:  `< ${THRESHOLDS.kycThreshold.toLocaleString()}€`,
      },
      standard: {
        required:   'DNI/NIE/Pasaporte + selfie',
        threshold:  `${THRESHOLDS.kycThreshold.toLocaleString()}€ - ${THRESHOLDS.amlAlert.toLocaleString()}€`,
      },
      enhanced: {
        required:   'Documentos + prueba de origen de fondos + SEPBLAC check',
        threshold:  `> ${THRESHOLDS.amlAlert.toLocaleString()}€`,
      },
    };

    return {
      framework:   'KYC / AML — 5ª Directiva UE + Ley 10/2010',
      address,
      levels:      kycLevels,
      currentLevel:'pending',
      provider:    'Integración KYC pendiente (Jumio/Onfido/Sumsub)',
      note:        'Conectar con proveedor KYC externo en Sprint 5',
    };
  }

  // ─── COMPLIANCE REPORT GENERAL ────────────────────────────────────────────

  async _generateComplianceReport(task) {
    const { period = 'Q' + Math.ceil(new Date().getMonth() / 3) + '-' + new Date().getFullYear() } = task.payload || {};

    const prompt = `
Genera un informe de compliance trimestral para BeZhas Blockchain (${period}):

Contexto de la empresa:
- Plataforma blockchain L2 con token BEZ-Coin
- Operación en BNB Chain y Polygon
- Sede en España → sujeta a regulación española y europea
- Clientes B2B (aduanas, supply chain, RWA)
- Token BEZ clasificado como Utility Token bajo MiCA

Frameworks regulatorios aplicables:
1. MiCA → clasificación token, whitepaper, registro VASP
2. DAC8 → reporting operaciones cripto a AEAT
3. Modelo 720 → bienes en el extranjero
4. 5ª Directiva AML → KYC/AML para usuarios
5. IS/IRPF España → obligaciones fiscales

El informe debe incluir:
- Resumen del estado de compliance por framework (⚠️/✅/🔴)
- Acciones prioritarias para el trimestre
- Riesgos regulatorios identificados
- Calendario de obligaciones próximas

Responde en español, formato ejecutivo. Máx 600 tokens.`;

    const report = await this.think(prompt, { maxTokens: 700 });

    const result = {
      period,
      report,
      generatedAt: new Date().toISOString(),
      frameworks:  ['MiCA', 'DAC8', 'Modelo 720', 'AML/KYC 5D', 'IS/IRPF'],
    };

    await this.notify(
      `📋 *Informe Compliance ${period}*\n\n${report.slice(0, 500)}\n\n_Ver informe completo en /dashboard/compliance_`,
      { level: 'info' }
    );

    this._reportsIssued++;
    await this.remember(`compliance_report_${period}`, result);
    return result;
  }

  // ─── CÁLCULOS FISCALES ────────────────────────────────────────────────────

  _calculateIRPF(netGain) {
    if (netGain <= 0) return 0;
    let tax = 0;
    let remaining = netGain;
    for (const band of TAX_RATES.irpf_bands) {
      if (remaining <= 0) break;
      const taxable = Math.min(remaining, band.to - band.from);
      tax     += taxable * band.rate;
      remaining -= taxable;
    }
    return Math.round(tax * 100) / 100;
  }

  _getIRPFBand(netGain) {
    if (netGain <= 0) return null;
    for (const band of TAX_RATES.irpf_bands) {
      if (netGain >= band.from && netGain < band.to) {
        return `${(band.rate * 100).toFixed(0)}% (${band.from.toLocaleString()}€ - ${band.to === Infinity ? '∞' : band.to.toLocaleString()}€)`;
      }
    }
    return '26%';
  }

  _calculateScore(results) {
    const scores = [
      results.mica?.score,
      results.dac8?.score,
      results.modelo720?.score,
      results.aml?.score,
    ].filter(s => typeof s === 'number');
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;
  }

  async _analyzeLLM(results) {
    return this.think(`
Analiza brevemente el estado de compliance de esta entidad BeZhas:
- MiCA: ${results.mica?.compliant ? '✅' : '⚠️'} (score ${results.mica?.score}/100)
- DAC8: ${results.dac8?.compliant ? '✅' : '⚠️'} (score ${results.dac8?.score}/100)
- Modelo 720: ${results.modelo720?.compliant ? '✅' : '⚠️'} (score ${results.modelo720?.score}/100)
- AML/KYC: ${results.aml?.compliant ? '✅' : '⚠️'} (score ${results.aml?.score}/100)
- Score global: ${results.complianceScore}/100

Proporciona un resumen ejecutivo de 2-3 frases y las 2 acciones más urgentes.
Responde en español.
`, { maxTokens: 250 });
  }

  // ─── STATS ───────────────────────────────────────────────────────────────

  getStats() {
    return {
      ...super.getStats(),
      reportsIssued:    this._reportsIssued,
      entitiesChecked:  this._checkedEntities.size,
      violations:       this._violations.length,
    };
  }

  _systemPrompt() {
    return `Eres el Compliance Agent de BeZhas Blockchain — experto en regulación cripto España y UE.
Especialista en: MiCA, DAC8, Modelo 720, AEAT (Modelos 172/173/100/200), AML/KYC 5ª Directiva.
Operas bajo el marco legal español: CNMV, Banco de España, AEAT, SEPBLAC.
Eres preciso, conservador en interpretación legal, y siempre recomiendas consultar con asesor fiscal.
Tus informes son ejecutivos, accionables y destacan plazos críticos.
Responde siempre en español.`;
  }
}

module.exports = ComplianceAgent;
module.exports.THRESHOLDS = THRESHOLDS;
module.exports.TAX_RATES  = TAX_RATES;
