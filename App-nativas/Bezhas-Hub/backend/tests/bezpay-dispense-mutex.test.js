/**
 * Serialización del hot wallet — dos entregas concurrentes (una del webhook
 * cripto, otra del liberador fiat) no deben solaparse: un único hot wallet
 * firmando dos TX a la vez arriesga una colisión de nonce (ver el comentario
 * junto a _dispense en services/bezpay.service.js). El fix es una cola FIFO
 * en memoria; este test prueba justo eso — no toca cadena real.
 *
 * ⚠️ jest.config.js: `transform: {}` (sin hoisting de jest.mock) y
 * `resetMocks: true`.
 */

const bezpay = require('../services/bezpay.service');

afterEach(() => {
  bezpay.__setDispenser(null);
});

it('dos dispense() concurrentes se ejecutan uno tras otro, nunca solapados', async () => {
  let inFlight = 0;
  let maxConcurrent = 0;
  const order = [];

  bezpay.__setDispenser(async (to, amount) => {
    inFlight++;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    order.push(`start:${to}`);
    await new Promise((r) => setTimeout(r, 20)); // simula latencia de RPC/confirmación
    order.push(`end:${to}`);
    inFlight--;
    return { txHash: `0xtx-${to}`, bezAmount: amount, to };
  });

  const [r1, r2] = await Promise.all([
    bezpay.dispense('0xAAA', 100),
    bezpay.dispense('0xBBB', 200),
  ]);

  expect(maxConcurrent).toBe(1); // nunca las dos a la vez
  expect(order).toEqual(['start:0xAAA', 'end:0xAAA', 'start:0xBBB', 'end:0xBBB']);
  expect(r1.txHash).toBe('0xtx-0xAAA');
  expect(r2.txHash).toBe('0xtx-0xBBB');
});

it('una entrega que falla no bloquea la cola para la siguiente', async () => {
  let call = 0;
  bezpay.__setDispenser(async (to) => {
    call++;
    if (call === 1) throw new Error('RPC caído');
    return { txHash: `0xtx-${to}`, to };
  });

  await expect(bezpay.dispense('0xAAA', 100)).rejects.toThrow('RPC caído');
  const r2 = await bezpay.dispense('0xBBB', 200);
  expect(r2.txHash).toBe('0xtx-0xBBB');
});

it('tres dispense() concurrentes preservan orden de llegada (FIFO)', async () => {
  const order = [];
  bezpay.__setDispenser(async (to) => {
    order.push(to);
    await new Promise((r) => setTimeout(r, 5));
    return { txHash: `0xtx-${to}`, to };
  });

  await Promise.all([
    bezpay.dispense('first', 1),
    bezpay.dispense('second', 2),
    bezpay.dispense('third', 3),
  ]);

  expect(order).toEqual(['first', 'second', 'third']);
});
