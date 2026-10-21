/**
 * Pruebas de la clave del limitador de ritmo.
 *
 * Un cliente IPv6 suele tener al menos un /64 para él solo y puede estrenar
 * dirección en cada petición. Si la clave fuera la dirección individual, cada
 * petición abriría un cupo nuevo; por eso se agrupa por subred.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import express, { type Request } from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';

import { ipAddressKey, subjectFromRequest } from '../../security/auditLog.js';
import { trustProxyHops, watchdogLimiter } from '../../security/throttle.js';

/** Clave que daría el limitador global para una petición desde `ip`. */
function claveDe(ip: string, path = '/x'): string {
    const opciones = watchdogLimiter(10, { global: true });
    return opciones.keyGenerator!({ ip, path } as Request, {} as never) as string;
}

/** App mínima con el limitador real y `trust proxy` como en producción. */
function appLimitada(limite: number, hops = 2) {
    const app = express();
    app.set('trust proxy', hops);
    app.use(rateLimit(watchdogLimiter(limite, { global: true })));
    app.get('/ping', (req, res) => {
        res.json({ ip: req.ip });
    });
    return app;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('clave del limitador: IPv6 por subred', () => {
    it('dos IPv6 de la misma /64 comparten clave de límite', () => {
        expect(claveDe('2001:db8:abcd:12::1')).toBe(claveDe('2001:db8:abcd:12:ffff:ffff:ffff:fffe'));
    });

    it('dos /64 dentro de la misma /56 también comparten clave', () => {
        expect(claveDe('2001:db8:abcd:1200::1')).toBe(claveDe('2001:db8:abcd:12ff::1'));
    });

    it('subredes /56 distintas son claves distintas', () => {
        expect(claveDe('2001:db8:abcd:1200::1')).not.toBe(claveDe('2001:db8:abcd:1300::1'));
    });

    it('las IPv4 siguen contando por dirección', () => {
        expect(claveDe('203.0.113.9')).not.toBe(claveDe('203.0.113.10'));
    });

    it('la IPv4 mapeada y localhost siguen normalizándose antes de agrupar', () => {
        expect(claveDe('::ffff:203.0.113.9')).toBe(claveDe('203.0.113.9'));
        // Si se agrupara antes de normalizar, `::1` acabaría como `::/56`.
        expect(claveDe('::1')).toBe(claveDe('127.0.0.1'));
    });

    it('el limitador y el vigilante imputan al mismo sujeto', () => {
        // El sujeto de auditoría sale de `subjectFromRequest` con la IP en
        // crudo; el del limitador, de la IP ya agrupada. Han de coincidir.
        const ip = '2001:db8:abcd:12::7';
        expect(claveDe(ip)).toBe(subjectFromRequest({ ip }));
        // El cuarto grupo `12` es `0012`: su /56 empieza en `0000`.
        expect(ipAddressKey(ip)).toBe('2001:db8:abcd::/56');
        expect(ipAddressKey(ipAddressKey(ip))).toBe(ipAddressKey(ip));
    });

    it('sin `global`, la clave separa además por ruta', () => {
        const opciones = watchdogLimiter(10);
        const clave = (path: string) =>
            opciones.keyGenerator!({ ip: '2001:db8::1', path } as Request, {} as never) as string;
        expect(clave('/a')).not.toBe(clave('/b'));
    });
});

describe('limitador montado', () => {
    it('express-rate-limit no avisa de un keyGenerator sin ipKeyGenerator', async () => {
        const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
        const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await request(appLimitada(5)).get('/ping').set('X-Forwarded-For', '203.0.113.1, 198.51.100.1');

        const salida = [...errores.mock.calls, ...avisos.mock.calls].flat().map(String).join('\n');
        expect(salida).not.toContain('ERR_ERL_KEY_GEN_IPV6');
    });

    it('rotar de dirección dentro de la misma /64 no da cupo nuevo', async () => {
        const app = appLimitada(2);
        const desde = (ip: string) => request(app).get('/ping').set('X-Forwarded-For', `${ip}, 198.51.100.1`);

        expect((await desde('2001:db8:abcd:12::1')).status).toBe(200);
        expect((await desde('2001:db8:abcd:12::2')).status).toBe(200);
        expect((await desde('2001:db8:abcd:12::3')).status).toBe(429);

        // Otra subred no se ve afectada.
        expect((await desde('2001:db8:ffff:1::1')).status).toBe(200);
    });

    it('con 2 saltos, `req.ip` es el cliente y no el balanceador', async () => {
        // Detrás del balanceador HTTPS de Google llega «<cliente>, <balanceador>».
        const res = await request(appLimitada(5))
            .get('/ping')
            .set('X-Forwarded-For', '203.0.113.50, 198.51.100.1');
        expect(res.body.ip).toBe('203.0.113.50');
    });

    it('con 2 saltos, un X-Forwarded-For falsificado por el cliente no cuela', async () => {
        // El cliente antepone lo que quiera; solo cuentan los dos últimos saltos.
        const res = await request(appLimitada(5))
            .get('/ping')
            .set('X-Forwarded-For', '1.1.1.1, 203.0.113.50, 198.51.100.1');
        expect(res.body.ip).toBe('203.0.113.50');
    });
});

describe('trustProxyHops', () => {
    it('acepta enteros de 0 a 5', () => {
        expect(trustProxyHops('0')).toBe(0);
        expect(trustProxyHops('2')).toBe(2);
        expect(trustProxyHops('5')).toBe(5);
    });

    it('sin valor, confía en un salto', () => {
        expect(trustProxyHops(undefined)).toBe(1);
    });

    it('cualquier valor inválido cae a 1, nunca a `true`', () => {
        for (const raro of ['', 'true', 'abc', '-1', '6', '1.5']) {
            expect(trustProxyHops(raro)).toBe(1);
        }
    });
});
