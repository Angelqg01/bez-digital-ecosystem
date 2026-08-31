'use strict';

/**
 * Anclaje en cadena de los rechazos de Aegis.
 *
 * Hasta ahora, cuando Aegis rechazaba una telemetría el hecho quedaba en
 * `ai_logs`: una tabla nuestra, que podemos editar nosotros. Y es justo el
 * hecho que hay que sostener después — «detectamos la rotura de la cadena de
 * frío y nos negamos a certificar» — ante alguien que no tiene por qué fiarse
 * de la parte interesada.
 */

const { levelFor, RISK_LEVEL, ON_CHAIN_FROM } = require('../../services/aegisOnChain');

describe('nivel de riesgo de un rechazo', () => {
  it('un modelo muy seguro de que hay anomalía es CRITICAL', () => {
    expect(levelFor({ reason: 'telemetry_rejected', score: 0.95 })).toBe(RISK_LEVEL.CRITICAL);
  });

  it('un rechazo normal del modelo es HIGH y sí se ancla', () => {
    const l = levelFor({ reason: 'telemetry_rejected', score: 0.5 });
    expect(l).toBe(RISK_LEVEL.HIGH);
    expect(l).toBeGreaterThanOrEqual(ON_CHAIN_FROM);
  });

  it('si decidió la regla de emergencia y no el modelo, baja a MEDIUM', () => {
    // El fallback es un rango fijo, no un juicio. Anclarlo al mismo nivel que
    // una detección del modelo daría a la señal una autoridad que no tiene.
    const l = levelFor({ reason: 'telemetry_rejected', usedFallback: true });
    expect(l).toBe(RISK_LEVEL.MEDIUM);
    expect(l).toBeLessThan(ON_CHAIN_FROM);
  });

  it('el circuito abierto NO es una amenaza: es no saber', () => {
    // Marcarlo como crítico llenaría la cadena de señales durante una caída
    // del servicio de IA, que es cuando menos información tenemos.
    const l = levelFor({ reason: 'circuit_open' });
    expect(l).toBe(RISK_LEVEL.LOW);
    expect(l).toBeLessThan(ON_CHAIN_FROM);
  });

  it('el umbral limita el gasto por diseño, no por un interruptor', () => {
    // Un sensor averiado que dispare cien rechazos leves al día no gasta gas;
    // uno que detecte manipulación, sí — y debe.
    expect(ON_CHAIN_FROM).toBe(RISK_LEVEL.HIGH);
  });
});

describe('la vía de pausa automática queda SIN cablear', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '../../..');

  it('ningún servicio invoca pauseByAI ni processSecurityAction', () => {
    // Parar una cadena es una decisión con consecuencias para todos los que
    // operan en ella. No se enciende: se diseña. Y los dos contratos que la
    // implementan no tienen una sola prueba.
    const dirs = ['api/services', 'api/routes'];
    const hits = [];
    for (const d of dirs) {
      for (const f of fs.readdirSync(path.join(root, d))) {
        if (!f.endsWith('.js')) continue;
        const src = fs.readFileSync(path.join(root, d, f), 'utf8');
        if (/\.(pauseByAI|processSecurityAction|resumeSequencer)\s*\(/.test(src)) hits.push(`${d}/${f}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('el conector de agent-lib escucha eventos que NO existen', () => {
    // Se deja constancia en una prueba en vez de en un comentario: es la razón
    // por la que ese subsistema se clasificó como no construido, y si algún día
    // se arregla, esta prueba fallará y obligará a revisar la decisión.
    const abi = JSON.parse(fs.readFileSync(path.join(root,
      'smart-contracts/out/AegisSecurityProvider.sol/AegisSecurityProvider.json'), 'utf8')).abi;
    const eventos = abi.filter((e) => e.type === 'event').map((e) => e.name);

    expect(eventos).toContain('RiskSignalTriggered');
    expect(eventos).not.toContain('ThreatDetected');
    expect(eventos).not.toContain('SecurityCheckFailed');

    const conector = fs.readFileSync(path.join(root,
      'agent-lib/connectors/AegisConnector.js'), 'utf8');
    expect(conector).toContain('ThreatDetected');     // escucha el que no existe
    expect(conector).toContain('placeholder');        // con hashes de relleno
  });
});

describe('lo que sí se cableó', () => {
  const fs = require('fs');
  const path = require('path');

  it('aegisService ancla el rechazo en vez de dejarlo sólo en ai_logs', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../services/aegisService.js'), 'utf8');
    expect(src).toContain('aegisOnChain.signalRejection');
    expect(src).toContain("reason: 'telemetry_rejected'");
  });

  it('el despliegue crea el contrato de verdad', () => {
    const src = fs.readFileSync(path.resolve(__dirname,
      '../../../smart-contracts/script/DeployAll.s.sol'), 'utf8');
    expect(src).toContain('new AegisSecurityProvider(deployer)');
  });
});
