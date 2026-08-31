'use strict';

/**
 * chainCall — que una llamada a contrato degrade de forma VISIBLE.
 *
 * Existe por `EdgeNodeRewards.pendingRewards()`: un método que no está en el
 * ABI, envuelto en `.catch(() => 0n)`. Devolvía 0 a todos los validadores y
 * nada lo delataba, porque **un cero de un catch es indistinguible de un cero
 * legítimo**.
 */

const { chainCall, getChainCallFailures, totalChainCallFailures, _reset } =
  require('../../utils/chainCall');

describe('chainCall', () => {
  beforeEach(() => _reset());

  it('devuelve el valor cuando la llamada va bien, sin registrar nada', async () => {
    expect(await chainCall('X.ok', async () => 42, 0)).toBe(42);
    expect(totalChainCallFailures()).toBe(0);
  });

  it('devuelve el valor por defecto cuando falla — no rompe la petición', async () => {
    // Ese era el motivo legítimo del catch original y se conserva.
    const v = await chainCall('X.boom', async () => { throw new Error('sin nodo'); }, []);
    expect(v).toEqual([]);
  });

  it('pero deja rastro: el fallo queda contado y con su causa', async () => {
    await chainCall('Registry.getInfo', async () => { throw new Error('no existe'); }, null);
    const f = getChainCallFailures();
    expect(f['Registry.getInfo'].count).toBe(1);
    expect(f['Registry.getInfo'].lastError).toContain('no existe');
  });

  it('cuenta por etiqueta, para saber QUÉ llamada es la rota', async () => {
    // Con la cadena caída fallan todas. Con un método inexistente falla una
    // sola, siempre la misma: es lo que distingue un caso del otro.
    for (let i = 0; i < 3; i++) {
      await chainCall('A.uno', async () => { throw new Error('x'); }, 0);
    }
    await chainCall('B.dos', async () => { throw new Error('y'); }, 0);

    const f = getChainCallFailures();
    expect(f['A.uno'].count).toBe(3);
    expect(f['B.dos'].count).toBe(1);
    expect(totalChainCallFailures()).toBe(4);
  });

  it('no se traga un valor falsy legítimo', async () => {
    // 0 y [] son respuestas válidas de un contrato. Si el ayudante los
    // confundiera con un fallo, reintroduciría el problema que viene a quitar.
    expect(await chainCall('X.cero', async () => 0n, 99n)).toBe(0n);
    expect(await chainCall('X.vacio', async () => [], ['no'])).toEqual([]);
    expect(await chainCall('X.falso', async () => false, true)).toBe(false);
    expect(totalChainCallFailures()).toBe(0);
  });
});

describe('las llamadas migradas usan chainCall', () => {
  const fs = require('fs');
  const path = require('path');

  it.each([
    ['services/validatorService.js', 'ValidatorRegistry.getValidatorInfo'],
    ['services/cargoLinkOnChain.js', 'CustomsClearanceOracle.getClearanceDetails'],
    ['services/l1Batcher.js', 'BeZhasL1Commitment.commitments'],
    ['routes/blockchain.js', 'ValidatorRegistry.getActiveSequencerCandidates'],
  ])('%s etiqueta %s', (file, label) => {
    const src = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    expect(src).toContain(`chainCall('${label}'`);
  });

  it('ninguna llamada a MÉTODO de contrato queda con catch mudo', () => {
    // `getContract(...).catch(() => null)` sí puede quedarse: ahí el null
    // significa "no desplegado en esta cadena" y el llamante lo comprueba.
    // Lo que no puede quedarse es un catch sobre la llamada a un método, que
    // es donde el valor por defecto se consume como si fuera un dato.
    const files = ['services/validatorService.js', 'services/cargoLinkOnChain.js',
                   'services/l1Batcher.js', 'routes/blockchain.js', 'routes/gateway.js'];
    const mudos = [];
    for (const f of files) {
      const src = fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8');
      for (const line of src.split('\n')) {
        if (!/\.catch\(\s*\(\s*\)\s*=>\s*(0n|0|\[\]|null)\s*\)/.test(line)) continue;
        if (/getContract\(/.test(line)) continue;
        mudos.push(`${f}: ${line.trim()}`);
      }
    }
    expect(mudos).toEqual([]);
  });
});
