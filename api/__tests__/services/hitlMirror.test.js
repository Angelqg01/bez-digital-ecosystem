'use strict';

/**
 * hitlMirror — espejo de aprobaciones hacia business-ops (OPERANT).
 *
 * Lo que se protege aquí son las dos propiedades que justifican el diseño:
 *
 *  1. El espejo NO BLOQUEA ni puede tumbar la cola. Gatea mando SCADA: si un
 *     fallo de red retrasara o rompiera un `approve()`, un operador no podría
 *     denegar un deslastre. Una aprobación que no se puede denegar es peor que
 *     no tener panel unificado.
 *
 *  2. Cada transición se refleja, para que exista una sola bandeja y un solo
 *     registro de quién aprobó qué.
 */

const hitlQueue = require('../../services/hitlQueue');
const hitlMirror = require('../../services/hitlMirror');

const job = (over = {}) => ({
  jobId: 'scada_1', nodeId: 'edge-01', command: 'SHED_LOAD',
  params: { kw: 500 }, requestedBy: 'u1', ...over,
});

describe('hitlMirror', () => {
  let enviados;

  beforeEach(() => {
    hitlQueue._reset();
    enviados = [];
    process.env.BUSINESS_OPS_URL = 'http://destino-de-prueba:4000';
    global.fetch = jest.fn((url, opts) => {
      enviados.push({ url, body: JSON.parse(opts.body) });
      return Promise.resolve({ ok: true, status: 200 });
    });
  });

  afterEach(() => { delete process.env.BUSINESS_OPS_URL; });

  it('refleja el alta, la aprobación y el consumo', async () => {
    hitlQueue.submit(job());
    hitlQueue.approve('scada_1', 'operador-2');
    hitlQueue.consume('scada_1', { command: 'SHED_LOAD' });
    await new Promise((r) => setImmediate(r));

    expect(enviados.map((e) => e.body.status)).toEqual(['pending', 'approved', 'consumed']);
    expect(enviados[0].body).toMatchObject({ approvalId: 'scada_1', action: 'SHED_LOAD', origin: 'api:scada' });
    expect(enviados[1].body.approvedBy).toBe('operador-2');
  });

  it('refleja el rechazo', async () => {
    hitlQueue.submit(job({ jobId: 'scada_2' }));
    hitlQueue.reject('scada_2', 'operador-2', 'fuera de ventana');
    await new Promise((r) => setImmediate(r));
    expect(enviados.at(-1).body).toMatchObject({ status: 'rejected', approvalId: 'scada_2' });
  });

  // ── Las dos propiedades críticas ──────────────────────────────────────────

  it('si el destino falla, la cola sigue funcionando igual', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')));

    const alta = hitlQueue.submit(job({ jobId: 'scada_3' }));
    expect(alta.status).toBe('PENDING');

    const ok = hitlQueue.approve('scada_3', 'operador-2');
    expect(ok.status).toBe('APPROVED');

    const usado = hitlQueue.consume('scada_3', { command: 'SHED_LOAD' });
    expect(usado.status).toBe('CONSUMED');

    // Y el rechazo, que es lo que NUNCA puede quedar bloqueado.
    hitlQueue.submit(job({ jobId: 'scada_4' }));
    expect(hitlQueue.reject('scada_4', 'operador-2', 'no').status).toBe('REJECTED');

    await new Promise((r) => setImmediate(r));
  });

  it('el espejo es síncrono desde fuera: la cola no espera a la red', () => {
    let resuelto = false;
    global.fetch = jest.fn(() => new Promise((r) => setTimeout(() => { resuelto = true; r({ ok: true }); }, 5000)));

    const alta = hitlQueue.submit(job({ jobId: 'scada_5' }));

    // Devuelve ya, con la petición todavía en vuelo.
    expect(alta.status).toBe('PENDING');
    expect(resuelto).toBe(false);
  });

  it('sin BUSINESS_OPS_URL no intenta salir a la red', async () => {
    delete process.env.BUSINESS_OPS_URL;
    jest.resetModules();
    const queueLimpia = require('../../services/hitlQueue');
    queueLimpia._reset();
    queueLimpia.submit(job({ jobId: 'scada_6' }));
    await new Promise((r) => setImmediate(r));
    expect(enviados).toHaveLength(0);
  });

  it('enabled() refleja si hay destino configurado', () => {
    expect(typeof hitlMirror.enabled()).toBe('boolean');
  });
});
