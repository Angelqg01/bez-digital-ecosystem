const { mockQuery } = require('../helpers');
const telemetry = require('../../services/telemetryPipeline');
const anon = require('../../services/episodeAnonymizer');

/**
 * Un identificador distinto por test.
 *
 * `_seOpuso` cachea la oposición 60 s a propósito —se consulta en cada llamada
 * y no puede costar una consulta cada vez—, y ese caché vive en el módulo, así
 * que sobrevive entre tests. Compartiendo un id, el segundo test leería la
 * decisión del primero y pasaría o fallaría por algo que no está probando.
 */
let APP;
let contador = 0;

function sinOposicion() { mockQuery.mockResolvedValueOnce({ rows: [{ telemetria: true, episodios: true }] }); }
function conOposicion(over = {}) {
    mockQuery.mockResolvedValueOnce({ rows: [{ telemetria: false, episodios: false, ...over }] });
}

describe('telemetryPipeline', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        APP = `app-${++contador}`;
    });

    describe('zero-retention: se vende como feature, así que tiene que ser cierto', () => {
        it.each(['business', 'enterprise_vip'])('en plan %s NO se escribe ni una fila', async (plan) => {
            const r = await telemetry.registrar({
                appId: APP, plan, canal: 'mcp', herramienta: 'bezhas_token_price', resultado: 'ok',
            });
            expect(r).toEqual({ escrito: false, motivo: 'zero_retention' });
            expect(mockQuery.mock.calls.some((c) => /INSERT INTO agent_telemetry/i.test(String(c[0])))).toBe(false);
        });

        it('tampoco episodios', async () => {
            const r = await telemetry.registrarEpisodio({
                appId: APP, plan: 'business', intencion: 'consultar_precio', resolucion: 'resuelto',
            });
            expect(r.motivo).toBe('zero_retention');
            expect(mockQuery.mock.calls.some((c) => /INSERT INTO cs_episodes/i.test(String(c[0])))).toBe(false);
        });

        it('no llega ni a consultar la oposición: el plan corta antes', async () => {
            await telemetry.registrar({ appId: APP, plan: 'business', canal: 'mcp', herramienta: 'x', resultado: 'ok' });
            expect(mockQuery).not.toHaveBeenCalled();
        });
    });

    describe('oposición (art. 21 RGPD)', () => {
        it('se respeta aunque el plan permitiera recoger', async () => {
            conOposicion();
            const r = await telemetry.registrar({
                appId: APP, plan: 'starter', canal: 'mcp', herramienta: 'x', resultado: 'ok',
            });
            expect(r.motivo).toBe('oposicion_art21');
        });

        it('ante un fallo de base se asume QUE SÍ se opuso', async () => {
            // Si no podemos comprobar si alguien se opuso, tratar sus datos
            // sería tratarlos sin poder acreditar la base jurídica. Perder
            // telemetría no cuesta nada; tratarla sin base, sí.
            mockQuery.mockRejectedValueOnce(new Error('la base no responde'));
            const r = await telemetry.registrar({
                appId: APP, plan: 'starter', canal: 'mcp', herramienta: 'x', resultado: 'ok',
            });
            expect(r.motivo).toBe('oposicion_art21');
        });

        it('guarda la FECHA de oposición, no sólo el interruptor', async () => {
            // Ante una reclamación hay que poder acreditar desde cuándo se dejó
            // de tratar, y un booleano no lo dice.
            mockQuery.mockResolvedValueOnce({ rows: [{ telemetria: false, episodios: false, opuesto_at: new Date() }] });
            await telemetry.fijarPreferencias(APP, { telemetria: false, episodios: false });
            expect(String(mockQuery.mock.calls[0][0])).toMatch(/opuesto_at/);
        });
    });

    describe('minimización: se guarda la FORMA, nunca el contenido', () => {
        it('los valores no llegan a la fila', async () => {
            sinOposicion();
            await telemetry.registrar({
                appId: APP, plan: 'starter', canal: 'mcp', herramienta: 'bezhas_dex_quote',
                resultado: 'ok',
                argumentos: {
                    amount: '48200.00', from: 'BEZ',
                    to: '0x' + 'a'.repeat(40),
                    nota: 'pago a Delta Logistics contrato 42',
                },
            });
            const insert = mockQuery.mock.calls.find((c) => /INSERT INTO agent_telemetry/i.test(String(c[0])));
            const escrito = JSON.stringify(insert[1]);
            expect(escrito).not.toContain('48200.00');
            expect(escrito).not.toContain('Delta Logistics');
            expect(escrito).not.toContain('0x' + 'a'.repeat(40));
            // Los NOMBRES sí: son de nuestro esquema, no del cliente, y son lo
            // que permite descubrir que una herramienta se invoca mal.
            expect(escrito).toContain('amount');
            expect(escrito).toContain('decimal');
        });

        it('el app_id no aparece en claro: va seudonimizado', async () => {
            sinOposicion();
            await telemetry.registrar({
                appId: APP, plan: 'starter', canal: 'mcp', herramienta: 'x', resultado: 'ok',
            });
            const insert = mockQuery.mock.calls.find((c) => /INSERT INTO agent_telemetry/i.test(String(c[0])));
            expect(insert[1][0]).not.toBe(APP);
            expect(insert[1][0]).toBe(anon.seudonimo(APP, 'telemetria'));
            expect(insert[1][0]).toHaveLength(32);
        });

        it('descarta la fila entera si en la forma se cuela algo que no es un tipo', async () => {
            // Red de seguridad deliberadamente paranoica: el coste de un falso
            // positivo es perder una fila; el de un falso negativo, guardar el
            // dato de un cliente donde dijimos que no.
            const espia = jest.spyOn(anon, 'formaArgumentos')
                .mockReturnValue({ amount: '48200.00' });   // valor, no tipo
            sinOposicion();
            const r = await telemetry.registrar({
                appId: APP, plan: 'starter', canal: 'mcp', herramienta: 'x', resultado: 'ok', argumentos: {},
            });
            expect(r.motivo).toBe('contenido_detectado');
            expect(mockQuery.mock.calls.some((c) => /INSERT INTO agent_telemetry/i.test(String(c[0])))).toBe(false);
            espia.mockRestore();
        });
    });

    describe('nunca rompe una petición', () => {
        it('un fallo al escribir se traga y se registra', async () => {
            sinOposicion();
            mockQuery.mockRejectedValueOnce(new Error('disco lleno'));
            await expect(telemetry.registrar({
                appId: APP, plan: 'starter', canal: 'mcp', herramienta: 'x', resultado: 'ok',
            })).resolves.toMatchObject({ escrito: false, motivo: 'error' });
        });
    });

    describe('plazos (art. 5.1.e)', () => {
        it('el plazo va EN LA FILA, no sólo en el proceso de purga', async () => {
            // Una fila escrita con 90 días conserva 90 días aunque mañana se
            // cambie la constante. Purgar con la constante de hoy alargaría
            // retroactivamente la conservación de datos ya recogidos.
            sinOposicion();
            await telemetry.registrar({
                appId: APP, plan: 'starter', canal: 'mcp', herramienta: 'x', resultado: 'ok',
            });
            const insert = mockQuery.mock.calls.find((c) => /INSERT INTO agent_telemetry/i.test(String(c[0])));
            expect(String(insert[0])).toMatch(/purgar_despues_de/);
            expect(insert[1][insert[1].length - 1]).toBe(String(telemetry.DIAS_TELEMETRIA));
        });

        it('la purga borra por la fecha de la fila', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 12 });
            mockQuery.mockResolvedValueOnce({ rowCount: 3 });
            const r = await telemetry.purgar();
            expect(r).toEqual({ telemetriaBorrada: 12, episodiosBorrados: 3 });
            expect(String(mockQuery.mock.calls[0][0])).toMatch(/purgar_despues_de <= NOW\(\)/);
        });

        it('los plazos son los declarados en el documento', () => {
            expect(telemetry.DIAS_TELEMETRIA).toBe(90);
            expect(telemetry.MESES_EPISODIOS).toBe(24);
        });
    });

    describe('derechos de acceso y supresión', () => {
        it('se resuelven por el seudónimo, que es lo único que hay en la tabla', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            await telemetry.exportarDe(APP);
            expect(mockQuery.mock.calls[0][1]).toEqual([anon.seudonimo(APP, 'telemetria')]);
        });

        it('la supresión NO toca los episodios', async () => {
            // Están agregados por sector y no contienen dato que permita
            // identificar al inquilino: no son suyos que suprimir.
            mockQuery.mockResolvedValueOnce({ rowCount: 5 });
            const r = await telemetry.suprimirDe(APP);
            expect(r.telemetriaBorrada).toBe(5);
            expect(mockQuery.mock.calls.some((c) => /cs_episodes/i.test(String(c[0])))).toBe(false);
        });
    });
});
