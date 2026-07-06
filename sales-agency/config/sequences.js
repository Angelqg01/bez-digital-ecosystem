// Secuencias de email por sector
// Estrategia: día 0 primer contacto → días 4, 9, 16, 25 follow-ups
// La IA personaliza el cuerpo usando el contexto del lead

export const SEQUENCES = {
  logistica: [
    {
      step: 0, dayOffset: 0, label: 'Primer contacto',
      subject: (lead) => `${lead.empresa} — 40% menos tiempo en despacho aduanero`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Eres ${persona.name}, ${persona.title} de BeZhas.
Escribe el primer email de prospección para:
- Empresa: ${lead.empresa}, Sector: logística/aduanas, Ubicación: ${lead.ubicacion}
- Contacto: ${lead.contacto || 'Responsable comercial'}
- Señal de urgencia: ${lead.señal_urgencia || 'empresa activa en el sector'}

Estrategia CLAVE: NUNCA mencionar blockchain, cripto, token, wallet.
Usar en su lugar: "red empresarial automatizada", "contrato de ejecución automática", "activo de utilidad BEZ".

Estructura:
1. Apertura: problema concreto que tiene esta empresa (despacho, documentación, pagos)
2. Propuesta: BeZhas automatiza ese proceso, con dato concreto de mejora
3. CTA: llamada de 15 min esta semana

Máximo 120 palabras. Tono ejecutivo, directo. Firma: ${persona.name}, ${persona.title}
Email respuesta: ${process.env.REPLY_TO_EMAIL}`,
    },
    {
      step: 1, dayOffset: 4, label: 'Follow-up caso práctico',
      subject: (lead) => `Puerto de Algeciras — caso real de automatización aduanera`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Follow-up #1 (4 días después) para ${lead.empresa}, ${lead.sector}.
Persona: ${persona.name}.

Objetivo: compartir un caso real (creíble, con cifras concretas) de empresa logística similar que ya usa BeZhas.
Incluir: tiempo ahorrado en despacho, coste reducido por operación, nombre ficticio creíble de empresa.
Terminar con pregunta directa.
Máximo 110 palabras.`,
    },
    {
      step: 2, dayOffset: 9, label: 'El activo BEZ explicado',
      subject: (lead) => `Por qué ${lead.empresa} necesita BEZ como activo operativo`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Follow-up #2 (9 días) para ${lead.empresa}.
Aquí SÍ puedes mencionar que la red usa un activo interno llamado BEZ (precio: $${bezPrice}/unidad).
Explícalo como "el combustible de la red" — como los sellos de correos.
Menciona que el precio es de entrada: $${bezPrice} ahora, sube con adopción.
Incluye enlace: ${saleUrl}
Máximo 120 palabras. Tono informativo, sin presión.`,
    },
    {
      step: 3, dayOffset: 16, label: 'Urgencia precio',
      subject: (lead) => `Precio BEZ sube pronto — último aviso para ${lead.empresa}`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Follow-up #3 (16 días) para ${lead.empresa}.
Crear urgencia real: precio de entrada BEZ ($${bezPrice}) sube la próxima semana.
Otras empresas del sector (2-3 de logística) ya han entrado a este precio.
${lead.empresa} puede entrar aún al precio más bajo.
CTA: ${saleUrl} o reply para hablar.
Máximo 100 palabras. Tono: ejecutivo urgente, no desesperado.`,
    },
    {
      step: 4, dayOffset: 25, label: 'Break-up email',
      subject: (lead) => `Último mensaje — BeZhas`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Break-up email (25 días sin respuesta) para ${lead.empresa}.
Tono: amigable, sin presión, dejar puerta abierta.
Inicio: "Entiendo que quizás no es el momento ahora."
Ofrecer: mantenerlos en lista cuando estén listos.
Dejar enlace: ${saleUrl}
Máximo 80 palabras.`,
    },
  ],

  alimentacion: [
    {
      step: 0, dayOffset: 0, label: 'Primer contacto',
      subject: (lead) => `${lead.empresa} — Trazabilidad UE Reg. 178/2002 automatizada`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Eres ${persona.name}, ${persona.title} de BeZhas.
Email para ${lead.empresa}, exportador/productor agroalimentario en ${lead.ubicacion}.
NUNCA mencionar blockchain/cripto/token. Usar: "plataforma de trazabilidad digital", "certificado de lote digital".

Estructura:
1. El Reglamento UE 178/2002 obliga trazabilidad digital en tiempo real
2. Muchas empresas aún usan Excel o sistemas que no comunican — riesgo de multa y retirada de mercado
3. BZ PureScan de BeZhas digitaliza cada lote con IA y certificación inmutable
4. CTA: demo en 15 min

Máximo 120 palabras. Tono regulatorio pero amigable.`,
    },
    {
      step: 1, dayOffset: 4, label: 'Caso de retirada de mercado',
      subject: (lead) => `Lo que cuesta una retirada de mercado sin trazabilidad digital`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Follow-up #1 para ${lead.empresa} (sector agroalimentario).
Compartir caso concreto: empresa similar que tuvo retirada de mercado (ficticio pero creíble).
Coste: producto retirado + sanción AEAT + daño reputacional (inventar cifra realista €500K-2M).
Cómo BeZhas lo habría evitado: localización de lote en minutos.
Pregunta directa al final.
Máximo 120 palabras.`,
    },
    {
      step: 2, dayOffset: 9, label: 'El activo BEZ para agroalimentario',
      subject: (lead) => `Cuánto cuesta certificar un lote con BeZhas vs notaría`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Follow-up #2 para ${lead.empresa}.
Comparativa de costes concreta:
- Certificación tradicional (notaría): €50-200 por lote
- BeZhas: $${bezPrice} por unidad de activo BEZ, coste de certificación <$0.01
Mencionar que empresas como ${lead.empresa} que exportan volumen alto ahorran €50K-200K/año.
Incluir: ${saleUrl} para ver precios de entrada.
Máximo 110 palabras.`,
    },
    {
      step: 3, dayOffset: 16, label: 'Urgencia campaña',
      subject: (lead) => `Antes de la próxima campaña — ${lead.empresa}`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Follow-up #3 para ${lead.empresa} (agroalimentario).
La próxima campaña (cosecha/exportación) se acerca.
Las empresas que entraron antes de campaña en BeZhas operaron sin incidencias regulatorias.
${lead.empresa} puede activar la plataforma en 48h.
Precio BEZ: $${bezPrice} — sube próximamente.
CTA: ${saleUrl}
Máximo 100 palabras.`,
    },
    {
      step: 4, dayOffset: 25, label: 'Break-up',
      subject: (lead) => `Sin presión — BeZhas queda aquí cuando lo necesiten`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Break-up para ${lead.empresa} (agroalimentario). Amigable, dejar puerta abierta.
Ofrecer: enviar informe de normativa UE trazabilidad gratis si lo quieren.
Enlace: ${saleUrl}
Máximo 80 palabras.`,
    },
  ],

  crypto: [
    {
      step: 0, dayOffset: 0, label: 'DM directo',
      subject: (lead) => `BEZ-Coin — precio semilla $0.0075, utilidad real B2B`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Mensaje directo para inversor crypto: ${lead.contacto || 'inversor'}.
Aquí SÍ se puede hablar de blockchain, token, DEX.

Estructura:
- BeZhas: L2 blockchain propia (BNB + Polygon activo), 88% plataforma operativa
- 5 sub-apps en GCP: hub, capital, cargolink, purescan, energy
- BEZ-Coin a $${bezPrice} precio semilla — sin pool DEX aún = menor precio que existirá
- Smart contracts: staking, DAO, farming, bridge, compliance MiCA
- Compra directa Stripe: ${saleUrl}

Máximo 150 palabras. Tono: peer-to-peer, crypto nativo, sin hype vacío.`,
    },
    {
      step: 1, dayOffset: 3, label: 'Due diligence técnico',
      subject: (lead) => `Contratos verificables + sprint 88% completado`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Follow-up técnico para inversor crypto.
Datos para due diligence:
- Contrato Polygon: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
- BNB Chain: 0x8a1e3930fde1f151471c368fdbb39f3f63a65b55
- 30+ contratos Solidity: GovernanceSystem, StakingPool, LiquidityFarming, ComplianceAgent MiCA (único en EU)
- 5 sub-apps live en GCP Cloud Run
- Telegram bot con HITL activo

Precio: $${bezPrice}. Pack desde $100: ${saleUrl}
Máximo 130 palabras. Tono técnico, sin hype.`,
    },
    {
      step: 2, dayOffset: 7, label: 'FOMO listing DEX',
      subject: (lead) => `Antes del listing en QuickSwap — último aviso`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Follow-up FOMO para inversor. Listing en DEX en proceso (QuickSwap V3 Polygon + PancakeSwap V3 BNB).
Cuando esté listado el precio ya no lo controla el proyecto.
Compra directa al precio de $${bezPrice} — el más bajo que habrá.
Pack Starter $100 → 13.333 BEZ. Pack Pro $550 → 73.333 BEZ.
${saleUrl}
Máximo 100 palabras.`,
    },
    {
      step: 3, dayOffset: 14, label: 'Cierre',
      subject: (lead) => `Último mensaje sobre BEZ-Coin`,
      bodyPrompt: (lead, persona, bezPrice, saleUrl) => `
Break-up para inversor crypto. Sin presión.
Dejar enlace final: ${saleUrl}
Precio actual: $${bezPrice}.
Disponible en Telegram: t.me/BeZhasBot
Máximo 70 palabras.`,
    },
  ],
};

// Para sectores no definidos, usar logistica como base
export const getSequence = (sector) => SEQUENCES[sector] || SEQUENCES.logistica;
