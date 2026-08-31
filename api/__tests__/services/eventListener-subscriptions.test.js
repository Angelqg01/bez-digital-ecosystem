/**
 * Las suscripciones del indexador contra los ABI reales.
 *
 * Este fichero existe por un fallo concreto: `eventListener` se suscribía a
 * `LiquidityFarming.RewardsClaimed`, evento que no existe (el real es `Claim`).
 * ethers rechazaba la promesa, nadie la capturaba y el proceso entero se caía
 * al arrancar en producción. Cuatro suscripciones estaban así.
 *
 * Un nombre de evento obsoleto es de las cosas más fáciles de introducir al
 * refactorizar un contrato y de las más difíciles de ver: no lo detecta el
 * compilador ni el linter, sólo el arranque. Estas pruebas lo detectan antes.
 */

const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');

const OUT = path.resolve(__dirname, '../../../smart-contracts/out');
const SRC = fs.readFileSync(path.resolve(__dirname, '../../services/eventListener.js'), 'utf8');

function abiOf(name) {
  const p = path.join(OUT, `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')).abi;
}

/** Qué variable del fichero corresponde a qué contrato. */
function contractVars() {
  const map = {};
  const re = /(\w+)\s*=\s*(?:await\s+)?getContract\(\s*['"](\w+)['"]/g;
  let m;
  while ((m = re.exec(SRC))) if (!map[m[1]]) map[m[1]] = m[2];
  return map;
}

/** Cada onEvent(variable, 'Evento', ...) del fichero. */
function subscriptions() {
  const out = [];
  const re = /onEvent\(\s*(\w+)\s*,\s*['"](\w+)['"]/g;
  let m;
  while ((m = re.exec(SRC))) out.push({ variable: m[1], eventName: m[2] });
  return out;
}

const vars = contractVars();
const subs = subscriptions();
const auditables = subs
  .map((s) => ({ ...s, contract: vars[s.variable] }))
  .filter((s) => s.contract && abiOf(s.contract));

describe('eventListener — suscripciones contra el ABI compilado', () => {
  it('encuentra suscripciones que auditar', () => {
    expect(subs.length).toBeGreaterThan(5);
  });

  it('casi todas las suscripciones apuntan a contratos con ABI compilado', () => {
    // Si esto baja, es que se añadió un contrato sin compilar y la auditoría
    // de abajo estaría pasando por no mirar.
    expect(auditables.length).toBeGreaterThanOrEqual(subs.length - 2);
  });

  it.each(auditables.map((s) => [s.contract, s.eventName]))(
    '%s.%s existe en el ABI',
    (contract, eventName) => {
      const names = abiOf(contract).filter((e) => e.type === 'event').map((e) => e.name);
      expect(names).toContain(eventName);
    }
  );
});

describe('onEvent — una suscripción caduca no puede tumbar el proceso', () => {
  const listener = require('../../services/eventListener');
  const abi = abiOf('LiquidityFarming');

  it('el ABI de LiquidityFarming tiene Claim y no RewardsClaimed', () => {
    const names = abi.filter((e) => e.type === 'event').map((e) => e.name);
    expect(names).toContain('Claim');
    expect(names).not.toContain('RewardsClaimed');
  });

  it('suscribirse a un evento inexistente no lanza: lo registra y sigue', () => {
    const c = new ethers.Contract(`0x${'11'.repeat(20)}`, abi, null);
    const before = listener.getListenerStats().failedSubscriptions.length;

    let ok;
    expect(() => { ok = listener.__onEvent(c, 'RewardsClaimed', () => {}); }).not.toThrow();
    expect(ok).toBe(false);

    const failed = listener.getListenerStats().failedSubscriptions;
    expect(failed.length).toBe(before + 1);
    expect(failed[failed.length - 1].eventName).toBe('RewardsClaimed');
    // El motivo tiene que decir cuáles SÍ existen: es lo que hace falta para
    // arreglarlo sin ir a abrir el ABI a mano.
    expect(failed[failed.length - 1].reason).toContain('Claim');
  });

  it('un evento que sí existe pasa la comprobación', () => {
    const c = new ethers.Contract(`0x${'22'.repeat(20)}`, abi, null);
    // Se comprueba el guardián, no `.on()`: suscribirse de verdad exige un
    // runner con conexión, y lo que aquí importa es que el guardián no dé
    // falsos positivos y bloquee suscripciones legítimas.
    expect(listener.__checkEvent(c, 'Claim')).toBeNull();
    expect(listener.__checkEvent(c, 'Deposit')).toBeNull();
  });
});

describe('SlashingManager.ValidatorSlashed — el orden de los campos', () => {
  it('el evento lleva el tipo de infracción ANTES del importe', () => {
    // El fallo era desestructurar [slashId, validator, amount, reason]: `amount`
    // recibía el enum de infracción, así que toda sanción quedaba registrada
    // como ~0 BEZ y el campo de motivo guardaba los wei. Silencioso.
    const ev = abiOf('SlashingManager')
      .find((e) => e.type === 'event' && e.name === 'ValidatorSlashed');
    expect(ev.inputs.map((i) => i.name))
      .toEqual(['slashId', 'validator', 'infraction', 'amount', 'evidence']);
  });

  it('el indexador desestructura en ese mismo orden', () => {
    expect(SRC).toContain('const [slashId, validator, infraction, amount, evidence] = args;');
  });
});
