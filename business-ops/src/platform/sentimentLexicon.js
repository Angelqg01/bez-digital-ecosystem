'use strict';

/**
 * sentimentLexicon — capa DETERMINISTA de análisis de sentimiento.
 *
 * Por qué existe teniendo un LLM: dos razones, y ninguna es el coste.
 *
 *   1. **Sigue funcionando cuando el modelo no.** `ModelGateway` degrada a
 *      simulado si el proveedor falla (y `AlertRules` lo marca como crítico
 *      justamente porque el texto deja de ser fiable). Un cliente amenazando
 *      con un abogado tiene que detectarse igual en ese escenario: es cuando
 *      MÁS caro sale no verlo.
 *   2. **Las señales de alto riesgo no admiten interpretación.** "Voy a
 *      denunciaros a la AEPD" o "quiero darme de baja" no necesitan matiz:
 *      necesitan un humano ya. Dejarlas al juicio de un modelo introduce
 *      variabilidad donde no debe haberla.
 *
 * El LLM sí aporta en el matiz (ironía, frustración educada, contexto), así
 * que `SentimentAgent` combina ambos: esta capa marca el suelo de gravedad y
 * el modelo puede subirlo, nunca bajarlo.
 *
 * Cobertura ES + EN: los clientes de BeZhas escriben en ambos.
 */

/** Normaliza para comparar: minúsculas y sin tildes. */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');   // quita diacríticos
}

/**
 * Señales de alto riesgo. Cada una tiene consecuencia distinta, así que se
 * detectan por separado en vez de fundirlas en un único "está enfadado".
 */
const SIGNALS = {
  // Intención de irse: la señal que cuesta dinero directo.
  churn_intent: [
    'dar de baja', 'darme de baja', 'cancelar mi', 'cancelar la suscripcion',
    'cancelar el contrato', 'rescindir', 'no renovar', 'me voy a la competencia',
    'buscar otro proveedor', 'cambiar de proveedor', 'devolucion del dinero',
    'quiero mi dinero', 'reembolso completo',
    'cancel my', 'cancel our', 'terminate the contract', 'switch provider', 'full refund',
  ],
  // Amenaza legal: además de urgente, tiene exposición regulatoria.
  //
  // OJO con los términos de una sola palabra en un contexto blockchain: en
  // BeZhas, "consumo" (de tokens/gas), "demanda" (de mercado) y "arbitraje"
  // (de precios) son vocabulario DIARIO. Con esas tres sueltas, preguntas
  // rutinarias como "¿cuál es mi consumo de tokens?" se marcaban como amenaza
  // legal crítica y despertaban a una persona. Por eso aquí van en frases
  // inequívocas, aunque cueste perder alguna detección real: una alerta legal
  // que salta con la operativa normal se ignora en una semana.
  legal_threat: [
    'abogado', 'denuncia', 'denunciar', 'demandar', 'via judicial',
    'poner una demanda', 'interponer una demanda', 'acciones legales',
    'reclamacion formal', 'hoja de reclamaciones',
    'aepd', 'agencia de proteccion de datos',
    'oficina del consumidor', 'oficina de consumo', 'junta arbitral',
    'incumplimiento de contrato',
    'lawyer', 'legal action', 'sue you', 'file a complaint', 'breach of contract',
  ],
  // Amenaza reputacional: ventana muy corta para reaccionar.
  reputational_threat: [
    'poner una resena', 'dejar una resena', 'trustpilot', 'redes sociales',
    'lo voy a contar', 'contarlo en twitter', 'valoracion de una estrella',
    'aviso a todo el mundo',
    'leave a review', 'one star', 'post about this', 'tell everyone',
  ],
  // Contacto reiterado: la frustración se acumula y multiplica lo demás.
  repeat_contact: [
    'ya os escribi', 'os he escrito', 'es la tercera vez', 'es la segunda vez',
    'sigo sin respuesta', 'nadie me contesta', 'llevo semanas', 'llevo dias',
    'otra vez lo mismo', 'como ya dije',
    'third time', 'second time', 'still no response', 'nobody has replied',
  ],
};

/** Términos negativos graduados por intensidad (peso sobre la polaridad). */
const NEGATIVE = [
  { w: 0.9, terms: ['verguenza', 'indignante', 'estafa', 'fraude', 'inaceptable', 'lamentable', 'nefasto', 'scam', 'outrageous', 'unacceptable'] },
  { w: 0.7, terms: ['harto', 'harta', 'furioso', 'furiosa', 'indignado', 'enfadado', 'cabreado', 'terrible', 'pesimo', 'horrible', 'furious', 'appalling'] },
  { w: 0.5, terms: ['decepcionado', 'decepcionante', 'frustrado', 'frustrante', 'molesto', 'insatisfecho', 'malisimo', 'disappointed', 'frustrated'] },
  { w: 0.3, terms: ['no funciona', 'no va', 'sigue fallando', 'roto', 'error', 'problema', 'fallo', 'lento', 'broken', 'not working', 'issue'] },
];

/** Términos positivos (para no marcar como negativo un agradecimiento). */
const POSITIVE = [
  { w: 0.9, terms: ['excelente', 'fantastico', 'maravilloso', 'impecable', 'excellent', 'outstanding'] },
  { w: 0.7, terms: ['genial', 'estupendo', 'perfecto', 'encantado', 'great', 'perfect', 'love it'] },
  { w: 0.5, terms: ['gracias', 'agradecido', 'contento', 'satisfecho', 'bien resuelto', 'thanks', 'happy', 'resolved'] },
];

/** Cuenta cuántas frases de una lista aparecen en el texto normalizado. */
function matches(normText, terms) {
  return terms.filter((t) => normText.includes(t));
}

/**
 * Intensidad tipográfica: gritar en MAYÚSCULAS y encadenar signos son señales
 * reales de enfado, independientes del vocabulario.
 * Se ignoran textos muy cortos: "OK" o "URGENTE" no son un grito sostenido.
 */
function typographicIntensity(rawText) {
  const text = String(rawText || '');
  const letters = text.replace(/[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/g, '');
  let score = 0;

  if (letters.length >= 15) {
    const upper = letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '').length;
    const ratio = upper / letters.length;
    if (ratio > 0.6) score += 0.35;
    else if (ratio > 0.35) score += 0.15;
  }
  if (/[!?]{3,}/.test(text)) score += 0.2;
  else if (/[!?]{2}/.test(text)) score += 0.1;

  return Math.min(0.5, score);
}

/**
 * Analiza un texto y devuelve polaridad, señales y una gravedad mínima.
 *
 * @returns {{
 *   polarity: number,        // -1 (muy negativo) .. +1 (muy positivo)
 *   label: string,           // 'furious'|'negative'|'neutral'|'positive'
 *   signals: string[],       // señales de alto riesgo detectadas
 *   evidence: object,        // qué frase concreta disparó cada señal
 *   minSeverity: string,     // suelo de gravedad: 'none'|'elevated'|'high'|'critical'
 *   typographic: number,
 * }}
 */
function analyze(text) {
  const raw = String(text || '');
  const norm = normalize(raw);

  // 1. Señales de alto riesgo.
  const signals = [];
  const evidence = {};
  for (const [name, terms] of Object.entries(SIGNALS)) {
    const hits = matches(norm, terms);
    if (hits.length) { signals.push(name); evidence[name] = hits; }
  }

  // 2. Polaridad por vocabulario graduado. Se queda con el término de mayor
  //    peso de cada lado en vez de sumar: repetir "error" cinco veces no hace
  //    a alguien cinco veces más negativo, y sumando saturaría enseguida.
  let neg = 0;
  const negHits = [];
  for (const { w, terms } of NEGATIVE) {
    const hits = matches(norm, terms);
    if (hits.length) { neg = Math.max(neg, w); negHits.push(...hits); }
  }
  let pos = 0;
  const posHits = [];
  for (const { w, terms } of POSITIVE) {
    const hits = matches(norm, terms);
    if (hits.length) { pos = Math.max(pos, w); posHits.push(...hits); }
  }
  if (negHits.length) evidence.negative = negHits;
  if (posHits.length) evidence.positive = posHits;

  const typographic = typographicIntensity(raw);
  // Los signos tipográficos solo agravan lo negativo: escribir "¡¡GRACIAS!!"
  // no es una queja.
  const negTotal = Math.min(1, neg + (neg > 0 || signals.length ? typographic : 0));
  let polarity = Number((pos - negTotal).toFixed(2));

  // Una amenaza legal o de baja NO puede quedar en polaridad positiva por
  // llevar un "gracias" de cortesía ("gracias, pero quiero darme de baja").
  if (signals.includes('churn_intent') || signals.includes('legal_threat')) {
    polarity = Math.min(polarity, -0.5);
  }
  polarity = Math.max(-1, Math.min(1, Number(polarity.toFixed(2))));

  // 3. Suelo de gravedad. El modelo podrá subirlo, nunca bajarlo.
  let minSeverity = 'none';
  if (polarity <= -0.3 || signals.includes('repeat_contact')) minSeverity = 'elevated';
  if (polarity <= -0.6 || signals.includes('reputational_threat')) minSeverity = 'high';
  if (signals.includes('legal_threat') || signals.includes('churn_intent')) minSeverity = 'critical';

  const label = polarity <= -0.7 ? 'furious'
    : polarity <= -0.25 ? 'negative'
      : polarity >= 0.4 ? 'positive'
        : 'neutral';

  return { polarity, label, signals, evidence, minSeverity, typographic };
}

/** Orden de gravedad, para comparar y combinar sin repetir la escala. */
const SEVERITY_ORDER = ['none', 'elevated', 'high', 'critical'];

/** Devuelve la mayor de dos gravedades. */
function maxSeverity(a, b) {
  const ia = SEVERITY_ORDER.indexOf(a);
  const ib = SEVERITY_ORDER.indexOf(b);
  return SEVERITY_ORDER[Math.max(ia === -1 ? 0 : ia, ib === -1 ? 0 : ib)];
}

module.exports = {
  analyze, normalize, maxSeverity,
  SIGNALS, SEVERITY_ORDER,
};
