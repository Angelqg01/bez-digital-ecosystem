/**
 * Las cifras de OPERANT que se publican (CLAUDE.md, docs/OPERANT_SUBAPP.md y el espejo del Hub)
 * son las que calcula el backend. Antes divergieron sin que nada lo avisara: se publicaba
 * 0,1271 € por tarea mid cuando el backend facturaba 0,0923 €, y el suelo de coste de cada plan
 * estaba un 18-30 % por encima del real.
 *
 * Si cambia un precio de Anthropic (config/usage-pricing.js) este test falla hasta que se
 * actualicen los documentos.
 */
const fs = require('fs');
const path = require('path');
const { estimateTaskCost, worstCaseMonthlyCost, DEPARTMENTS } = require('../../config/operant-services');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

/** Formato de los documentos: coma decimal y punto de millares («1.018,98»). */
function es(n, decimales) {
    const [ent, dec] = Number(n).toFixed(decimales).split('.');
    return ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? `,${dec}` : '');
}

const frontier = estimateTaskCost(DEPARTMENTS.find((d) => d.tier === 'frontier').id);
const mid = estimateTaskCost(DEPARTMENTS.find((d) => d.tier === 'mid').id);

describe('cifras de OPERANT publicadas = cifras del backend', () => {
    const claude = leer('CLAUDE.md');
    const doc = leer('docs', 'OPERANT_SUBAPP.md');

    test('CLAUDE.md publica el precio por tarea de cada tier', () => {
        expect(claude).toContain(`${es(frontier.billableEUR, 4)} €`);
        expect(claude).toContain(`${es(mid.billableEUR, 4)} €`);
    });

    test('la tabla de tiers de la documentación coincide con el coste, el precio y los créditos', () => {
        expect(doc).toContain(`| ${es(frontier.rawCostEUR, 4)} € | **${es(frontier.billableEUR, 4)} €** | ${frontier.credits} |`);
        expect(doc).toContain(`| ${es(mid.rawCostEUR, 4)} € | **${es(mid.billableEUR, 4)} €** | ${mid.credits} |`);
    });

    test.each(['creator_pro', 'business', 'enterprise_vip'])('el suelo de coste de %s publicado es el calculado', (plan) => {
        const suelo = es(worstCaseMonthlyCost(plan).totalCostEUR, 2);
        expect(doc).toContain(`${suelo} €`);
    });

    test('el espejo del Hub publica el mismo precio por tarea', () => {
        const hub = leer('App-nativas', 'Bezhas-Hub', 'frontend', 'src', 'config', 'operant-native-app.js');
        const m = hub.match(/OPERANT_TASK_PRICE_EUR\s*=\s*\{\s*frontier:\s*([0-9.]+),\s*mid:\s*([0-9.]+)\s*\}/);
        expect(m).not.toBeNull();
        expect(Number(m[1])).toBeCloseTo(frontier.billableEUR, 4);
        expect(Number(m[2])).toBeCloseTo(mid.billableEUR, 4);
    });

    test('no queda el precio antiguo por tarea mid en los documentos vigentes', () => {
        expect(claude).not.toContain('0,1271');
        expect(doc).not.toMatch(/\*\*0,1271 €\*\*/);
    });
});
