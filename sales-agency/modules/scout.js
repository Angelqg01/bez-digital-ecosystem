// Scout — busca empresas reales via Claude + web search
import Anthropic from '@anthropic-ai/sdk';
import * as db from './db.js';
import { getPersona } from '../config/personas.js';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_PER_RUN = parseInt(process.env.MAX_LEADS_PER_SCOUT || '5');

// ── Prompt de búsqueda ────────────────────────────────────────────
const buildSearchPrompt = (sector, persona) => `
Busca empresas reales en internet que sean prospectos de ventas para BeZhas en el sector: ${sector}.

GEOGRAFÍA PRIORITARIA: ${persona.targets_geograficos?.join(', ') || 'España'}
PALABRAS CLAVE: ${persona.keywords.join(', ')}
PAIN POINT: ${persona.pain}

CRITERIOS:
- Empresas medianas (20-500 empleados) con alta actividad operativa
- Con presencia digital verificable (web, LinkedIn, noticias recientes)
- Con señales de dolor en: ${persona.pain}
- Con email de contacto encontrable públicamente (info@, comercial@, contacto@)

IMPORTANTE: Devuelve SOLO JSON válido, sin markdown:
{
  "empresas": [
    {
      "empresa": "Nombre Empresa SL",
      "email": "info@empresa.com o null",
      "contacto": "Nombre CEO/Director si aparece o null",
      "ubicacion": "Ciudad, Provincia",
      "descripcion": "Qué hace y por qué necesita BeZhas (2 líneas)",
      "señal_urgencia": "señal concreta encontrada (noticia, problema, expansión)",
      "web": "https://empresa.com",
      "empleados": "50-200",
      "score_inicial": 70
    }
  ]
}

Máximo ${MAX_PER_RUN} empresas. Solo JSON, sin texto adicional.`;

// ── Scorer rápido ─────────────────────────────────────────────────
const scorePrompt = (empresa, sector, persona) => `
Puntúa este prospecto de ventas del 0 al 100 para BeZhas (venta de activo BEZ-Coin + plataforma B2B).

Empresa: ${empresa.empresa}
Sector: ${sector}
Ubicación: ${empresa.ubicacion}
Descripción: ${empresa.descripcion}
Señal urgencia: ${empresa.señal_urgencia}

Criterios de puntuación:
- Tamaño empresa (mayor = mejor): peso 20%
- Relevancia sector para BeZhas: peso 30%
- Señal de urgencia real: peso 25%
- Probabilidad de tener email contactable: peso 15%
- Proximidad geográfica a Algeciras: peso 10%

Devuelve SOLO JSON:
{"score": 75, "tier": "HOT", "razon": "empresa transitaria activa en Algeciras con problema documentación aduanera"}

Tiers: HOT (>=70), WARM (50-69), COLD (<50)`;

// ── Funciones principales ─────────────────────────────────────────
async function callClaude(prompt, maxTokens = 2000) {
  const res = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content[0].text;
}

export async function scoutSector(sector, emit = () => {}) {
  const persona = getPersona(sector);
  emit({ type: 'scout_start', sector });

  let empresas = [];
  try {
    const raw = await callClaude(buildSearchPrompt(sector, persona), 3000);
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    empresas = parsed.empresas || [];
    emit({ type: 'scout_found', sector, count: empresas.length });
  } catch (err) {
    emit({ type: 'scout_error', sector, error: err.message });
    return [];
  }

  const results = [];
  for (const empresa of empresas) {
    // Filtrar duplicados por email
    if (empresa.email && db.getLeadByEmail(empresa.email)) {
      emit({ type: 'scout_skip', empresa: empresa.empresa, reason: 'duplicate' });
      continue;
    }

    // Score
    let score = empresa.score_inicial || 50;
    let tier = 'WARM';
    let razon = 'Prospecto estándar';
    try {
      const raw = await callClaude(scorePrompt(empresa, sector, persona), 300);
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      score = parsed.score || score;
      tier = parsed.tier || tier;
      razon = parsed.razon || razon;
    } catch { /* usar score inicial */ }

    const lead = {
      id: db.generateId(),
      ...empresa,
      sector,
      score,
      tier,
      razon_score: razon,
      status: 'new',
      steps_sent: [],
      persona: persona.name,
    };

    db.saveLead(lead);
    db.log({ event: 'lead_created', id: lead.id, empresa: lead.empresa, score, tier });
    emit({ type: 'lead_saved', empresa: empresa.empresa, score, tier });
    results.push(lead);

    await sleep(1500);
  }

  emit({ type: 'scout_done', sector, saved: results.length });
  return results;
}

export async function runScout(sectors, emit = () => {}) {
  const allResults = [];
  for (const sector of sectors) {
    const r = await scoutSector(sector, emit);
    allResults.push(...r);
    await sleep(3000);
  }
  return allResults;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
