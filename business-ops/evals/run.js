'use strict';

/**
 * Eval harness — contratos de comportamiento de los agentes.
 *
 * Diferencia con los tests: los tests protegen el CÓDIGO; las evals protegen
 * el COMPORTAMIENTO (enrutado correcto, escalar cuando toca, no inventar sin
 * KB, líneas rojas intocables, el bucle de herramientas encaja rechazos...).
 * Regla de la casa: ningún cambio de prompt entra sin pasar las evals.
 *
 * Modo por defecto: simulado (determinista, gratis, corre en CI).
 * Con EVALS_LIVE=1 + ANTHROPIC_API_KEY las suites corren contra el modelo
 * real: los contratos son los mismos, lo que cambia es quién decide.
 *
 * Uso:  npm run evals            (todas las suites)
 *       node evals/run.js routing (solo una suite)
 */
const path = require('path');
const fs = require('fs');

const CASES_DIR = path.join(__dirname, 'cases');

async function main() {
  const only = process.argv[2] || null;
  const files = fs.readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => !only || f.replace('.js', '') === only);

  if (!files.length) {
    console.error(`No hay suites${only ? ` llamadas "${only}"` : ''} en evals/cases/`);
    process.exit(1);
  }

  let pass = 0, fail = 0, advisory = 0;
  const failures = [];

  for (const file of files) {
    const suite = require(path.join(CASES_DIR, file));
    const world = suite.setup ? await suite.setup() : null;
    console.log(`\n━━ ${suite.suite} — ${suite.description}`);

    for (const c of suite.cases) {
      try {
        const detail = await c.check(world);
        pass++;
        console.log(`  ✔ ${c.name}${detail ? ` · ${detail}` : ''}`);
      } catch (err) {
        if (c.mustPass === false) {
          advisory++;
          console.log(`  ~ ${c.name} · ADVISORY: ${err.message}`);
        } else {
          fail++;
          failures.push(`${suite.suite} → ${c.name}: ${err.message}`);
          console.log(`  ✖ ${c.name} · ${err.message}`);
        }
      }
    }
    if (suite.teardown) await suite.teardown(world);
  }

  console.log(`\n═══ EVALS: ${pass} pasan · ${fail} fallan · ${advisory} advisory ═══`);
  if (failures.length) {
    console.log('\nFallos:');
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
