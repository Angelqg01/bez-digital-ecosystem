#!/usr/bin/env node
'use strict';

/**
 * Evaluación del retrieval del Knowledge Plane (BM25 actual) contra un corpus etiquetado.
 *
 *   node scripts/rag-eval.js                 # imprime el informe
 *   node scripts/rag-eval.js --json out.json # además guarda el resultado
 *   node scripts/rag-eval.js --min-recall 0.9 --min-abstencion 0.8   # sale con 1 si no se cumple
 *   KNOWLEDGE_EMBEDDER=ollama KNOWLEDGE_EMBED_MODEL=nomic-embed-text node scripts/rag-eval.js --comparar
 *       # mide BM25 y BM25+vectores (RRF) sobre las mismas preguntas y muestra la diferencia
 *   ... --vec-min 0.6   # umbral de similitud de la vía semántica (calibrarlo por modelo)
 *
 * Usa el conocimiento público sembrado (services/knowledge/seed.js) en un almacén en memoria: no toca la base de
 * datos ni llama a ningún modelo. Mide sólo recuperación; la calidad de la respuesta del LLM no se evalúa aquí.
 */
const fs = require('fs');
const path = require('path');

process.env.KNOWLEDGE_STORE = 'memory';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { KnowledgeService, MemoryStore } = require('../services/knowledge');
const { seedPublicKnowledge } = require('../services/knowledge/seed');

const FIXTURES = path.join(__dirname, '..', '__tests__', 'fixtures', 'rag-eval');
const CORPUS = path.join(FIXTURES, 'questions.json');
const CORPUS_SEMANTICO = path.join(FIXTURES, 'questions-semanticas.json');
const TOP_K = 4;
const UMBRAL_DEBIL = 0.5; // misma cobertura bajo la que el chat avisa de que puede no responder

const pct = (n, d) => (d ? n / d : null);
const percentil = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };

async function evaluar({ corpus = CORPUS, topK = TOP_K, embedder = null, vecMin, vecWeight } = {}) {
    const knowledge = new KnowledgeService({ store: new MemoryStore(), embedder, ...(vecMin != null ? { vecMin } : {}), ...(vecWeight != null ? { vecWeight } : {}) });
    await seedPublicKnowledge(knowledge);
    const principal = { userId: 'eval', tenantId: 'org:eval', roles: ['USER'], plan: 'business' };
    const preguntas = [].concat(corpus).flatMap((c) => JSON.parse(fs.readFileSync(c, 'utf8')).preguntas);

    const filas = [];
    for (const p of preguntas) {
        const t0 = process.hrtime.bigint();
        const res = await knowledge.search(principal, p.q, { topK });
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        const docs = [...new Set(res.map((c) => c.document_id))];
        const esperados = p.esperados || [];
        const pos = docs.findIndex((d) => esperados.includes(d));
        filas.push({
            id: p.id, tipo: p.tipo, q: p.q, esperados, docs, ms,
            cobertura: res.length ? Math.max(...res.map((c) => c.cobertura || 0)) : 0,
            acierto: esperados.length ? pos >= 0 : null,
            top1: esperados.length ? pos === 0 : null,
            rr: esperados.length ? (pos >= 0 ? 1 / (pos + 1) : 0) : null,
            // Sin respuesta en el corpus: abstención = no devuelve nada; «débil» = devuelve algo pero con cobertura baja (el chat avisa).
            abstiene: esperados.length ? null : res.length === 0,
            debil: esperados.length ? null : res.length > 0 && Math.max(...res.map((c) => c.cobertura || 0)) < UMBRAL_DEBIL,
        });
    }

    const con = filas.filter((f) => f.esperados.length);
    const sin = filas.filter((f) => !f.esperados.length);
    const porTipo = {};
    for (const t of [...new Set(con.map((f) => f.tipo))]) {
        const g = con.filter((f) => f.tipo === t);
        porTipo[t] = { n: g.length, recall: pct(g.filter((f) => f.acierto).length, g.length) };
    }
    const ms = filas.map((f) => f.ms);
    return {
        fecha: new Date().toISOString(), topK, modo: embedder ? `BM25+vectores (${embedder.id})` : 'BM25', preguntas: filas.length,
        con_respuesta: con.length, sin_respuesta: sin.length,
        recall_at_k: pct(con.filter((f) => f.acierto).length, con.length),
        top1: pct(con.filter((f) => f.top1).length, con.length),
        mrr: con.length ? con.reduce((s, f) => s + f.rr, 0) / con.length : null,
        abstencion_correcta: pct(sin.filter((f) => f.abstiene).length, sin.length),
        abstencion_o_debil: pct(sin.filter((f) => f.abstiene || f.debil).length, sin.length),
        latencia_ms: { p50: percentil(ms, 0.5), p95: percentil(ms, 0.95), max: Math.max(...ms) },
        por_tipo: porTipo,
        fallos: con.filter((f) => !f.acierto).map(({ id, q, esperados, docs }) => ({ id, q, esperados, docs })),
        no_abstiene: sin.filter((f) => !f.abstiene).map(({ id, q, docs, cobertura, debil }) => ({ id, q, docs, cobertura: Number(cobertura.toFixed(2)), debil })),
    };
}

const f2 = (x) => (x == null ? 'n/d' : (x * 100).toFixed(1) + ' %');

function imprimir(r) {
    console.log(`RAG eval · ${r.modo} · top-${r.topK} · ${r.preguntas} preguntas (${r.con_respuesta} con respuesta, ${r.sin_respuesta} sin)`);
    console.log(`  recall@${r.topK}            ${f2(r.recall_at_k)}`);
    console.log(`  acierto en 1.ª posición ${f2(r.top1)}   MRR ${r.mrr == null ? 'n/d' : r.mrr.toFixed(3)}`);
    console.log(`  abstención correcta     ${f2(r.abstencion_correcta)}   (o coincidencia débil avisada: ${f2(r.abstencion_o_debil)})`);
    console.log(`  latencia retrieval      p50 ${r.latencia_ms.p50.toFixed(1)} ms · p95 ${r.latencia_ms.p95.toFixed(1)} ms · máx ${r.latencia_ms.max.toFixed(1)} ms`);
    console.log('  recall por tipo:', Object.entries(r.por_tipo).map(([t, v]) => `${t} ${f2(v.recall)} (${v.n})`).join(' · '));
    if (r.fallos.length) { console.log('  FALLOS:'); r.fallos.forEach((f) => console.log(`   - ${f.id} «${f.q}» esperado ${f.esperados.join('|')} → ${f.docs.join(', ') || '(nada)'}`)); }
    if (r.no_abstiene.length) { console.log('  SIN ABSTENCIÓN:'); r.no_abstiene.forEach((f) => console.log(`   - ${f.id} «${f.q}» → ${f.docs.join(', ')} (cobertura ${f.cobertura}${f.debil ? ', débil' : ''})`)); }
}

function comparar(a, b) {
    const d = (x, y) => (x == null || y == null ? 'n/d' : `${x >= y ? '+' : ''}${((y - x) * 100).toFixed(1)} pt`);
    console.log(`\nDiferencia (${b.modo}) frente a BM25:`);
    console.log(`  recall@${a.topK} ${d(a.recall_at_k, b.recall_at_k)} · 1.ª posición ${d(a.top1, b.top1)} · abstención correcta ${d(a.abstencion_correcta, b.abstencion_correcta)} · abstención o débil ${d(a.abstencion_o_debil, b.abstencion_o_debil)}`);
    for (const t of Object.keys(a.por_tipo)) console.log(`  ${t}: ${f2(a.por_tipo[t].recall)} → ${f2(b.por_tipo[t]?.recall)}`);
    console.log(`  latencia p95 ${a.latencia_ms.p95.toFixed(1)} → ${b.latencia_ms.p95.toFixed(1)} ms`);
}

if (require.main === module) {
    const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
    (async () => {
        const { crearEmbedder } = require('../services/knowledge/embedder');
        const embedder = process.argv.includes('--embedder') || process.argv.includes('--comparar') ? crearEmbedder({ KNOWLEDGE_EMBEDDER: 'ollama', ...process.env }) : null;
        const vecMin = arg('--vec-min') != null ? Number(arg('--vec-min')) : undefined;
        const vecWeight = arg('--vec-weight') != null ? Number(arg('--vec-weight')) : undefined;
        if (process.argv.includes('--comparar')) {
            // Con --comparar se añaden las preguntas sin vocabulario común (las que BM25 falla por diseño).
            const corpus = [CORPUS, CORPUS_SEMANTICO];
            const base = await evaluar({ corpus });
            const hib = await evaluar({ corpus, embedder, vecMin, vecWeight });
            imprimir(base); console.log(); imprimir(hib); comparar(base, hib);
            return hib;
        }
        return evaluar({ embedder, vecMin, vecWeight });
    })().then((r) => {
        if (!process.argv.includes('--comparar')) imprimir(r);
        if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(r, null, 2));
        const minR = Number(arg('--min-recall') || 0);
        const minA = Number(arg('--min-abstencion') || 0);
        if (r.recall_at_k < minR || r.abstencion_o_debil < minA) { console.error('Umbral no alcanzado'); process.exit(1); }
        process.exit(0);
    }).catch((e) => { console.error(e); process.exit(2); });
}

module.exports = { evaluar };
