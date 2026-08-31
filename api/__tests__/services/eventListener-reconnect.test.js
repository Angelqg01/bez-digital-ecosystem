'use strict';

/**
 * Reconexión del indexador ante un nodo caído.
 *
 * El comportamiento anterior: ethers reintentaba detectar la red **cada segundo
 * y para siempre**, y este módulo escribía una línea de log por intento
 * prometiendo una reconexión que nunca ocurría — `reconnectTimer` estaba
 * declarado y no se asignaba jamás. Con el nodo caído eso son ~86.400 líneas al
 * día, un núcleo ocupado y cero reconexiones. Es lo que tenía `bezhas-api` en
 * unhealthy.
 */

const { ethers } = require('ethers');

describe('espera creciente entre reintentos', () => {
    const listener = require('../../services/eventListener');
    const delay = listener.__backoffDelay;

    it('crece con cada intento en vez de repetir un segundo fijo', () => {
        // Con ruido de ±25%, el intento 5 no puede solaparse con el 1.
        const first = delay(1);
        const fifth = delay(5);
        expect(first).toBeLessThan(2000);
        expect(fifth).toBeGreaterThan(first * 4);
    });

    it('tiene techo: no espera indefinidamente al volver el nodo', () => {
        // Sin techo, tras 20 intentos la espera serían días y el servicio no se
        // recuperaría solo aunque el nodo llevara horas disponible.
        for (const attempt of [20, 40, 100]) {
            expect(delay(attempt)).toBeLessThanOrEqual(60000 * 1.25 + 1);
        }
    });

    it('nunca baja del mínimo, ni siquiera con el ruido en contra', () => {
        for (let i = 0; i < 200; i++) expect(delay(1)).toBeGreaterThanOrEqual(1000);
    });

    it('añade ruido: dos réplicas no reintentan a la vez', () => {
        // Sin esto, varias instancias reintentan sincronizadas y vuelven a
        // tumbar el nodo justo cuando se recupera.
        const muestras = new Set(Array.from({ length: 40 }, () => delay(6)));
        expect(muestras.size).toBeGreaterThan(1);
    });
});

describe('provider: la red se declara, no se descubre', () => {
    const OLD = { ...process.env };
    afterEach(() => { process.env = { ...OLD }; jest.resetModules(); });

    it('un nodo caído falla rápido en vez de sondear para siempre', async () => {
        jest.resetModules();
        process.env.BEZHAS_L2_RPC_URL = 'http://127.0.0.1:59998';
        process.env.BEZHAS_CHAIN_ID = '31337';
        const cs = require('../../services/contractService');

        const t0 = Date.now();
        const res = await cs.pingChain(3000);
        const elapsed = Date.now() - t0;

        expect(res.reachable).toBe(false);
        // Sin `staticNetwork`, ethers entra en su bucle de detección de red y
        // esto tardaba mucho más — o no terminaba.
        expect(elapsed).toBeLessThan(2500);
    });

    it('declara la red configurada, así que no hay nada que detectar', async () => {
        jest.resetModules();
        process.env.BEZHAS_L2_RPC_URL = 'http://127.0.0.1:59998';
        process.env.BEZHAS_CHAIN_ID = '4242';
        const cs = require('../../services/contractService');

        // getNetwork() resuelve SIN tocar la red: es la prueba de que no sondea.
        const net = await cs.getProvider().getNetwork();
        expect(Number(net.chainId)).toBe(4242);
    });

    it('desactiva la caché de respuestas (el fallo de nonce del repo)', () => {
        jest.resetModules();
        process.env.BEZHAS_L2_RPC_URL = 'http://127.0.0.1:59998';
        const cs = require('../../services/contractService');
        expect(cs.getProvider()._getOption('cacheTimeout')).toBe(-1);
    });

    it('resetProvider entrega una instancia nueva', () => {
        jest.resetModules();
        process.env.BEZHAS_L2_RPC_URL = 'http://127.0.0.1:59998';
        const cs = require('../../services/contractService');
        const a = cs.getProvider();
        expect(cs.resetProvider()).not.toBe(a);
    });
});

describe('estado de conexión visible desde fuera', () => {
    it('las métricas distinguen "sin eventos" de "sin nodo"', () => {
        // Desde fuera se parecen mucho, y confundirlas es la razón de que una
        // avería así pase semanas sin detectarse.
        const s = require('../../services/eventListener').getListenerStats();
        expect(s).toHaveProperty('chainReachable');
        expect(s).toHaveProperty('reconnectAttempts');
        expect(s).toHaveProperty('lastChainError');
    });
});
