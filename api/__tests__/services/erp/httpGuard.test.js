const dns = require('dns');
const guard = require('../../../services/erp/httpGuard');

describe('httpGuard — la conexión al ERP es SSRF por diseño y hay que cerrarla', () => {
    afterEach(() => jest.restoreAllMocks());

    describe('clasificación de direcciones', () => {
        // Se comprueba sobre la IP RESUELTA y nunca sobre el texto del nombre:
        // «interno.ejemplo.com» puede apuntar a 10.0.0.5 y «0x7f.1» es 127.0.0.1
        // escrito de otra forma. El texto engaña; la IP no.
        it.each([
            ['loopback v4', '127.0.0.1'],
            ['loopback v6', '::1'],
            ['privada 10/8', '10.0.0.5'],
            ['privada 172.16/12', '172.20.10.1'],
            ['privada 192.168/16', '192.168.1.1'],
            ['metadatos de nube', '169.254.169.254'],
            ['link-local v6', 'fe80::1'],
            ['unique local v6', 'fd00::1'],
            ['v4 embebida en v6', '::ffff:127.0.0.1'],
            ['CGNAT', '100.64.0.1'],
            ['multicast', '239.1.1.1'],
            ['sin especificar', '0.0.0.0'],
            ['no es una ip', 'no-soy-una-ip'],
        ])('bloquea %s', (_n, ip) => {
            expect(guard.esDireccionProhibida(ip)).toBe(true);
        });

        it.each([['8.8.8.8'], ['93.184.216.34'], ['2606:4700:4700::1111']])(
            'deja pasar la pública %s', (ip) => {
                expect(guard.esDireccionProhibida(ip)).toBe(false);
            }
        );
    });

    describe('validación de la URL base', () => {
        beforeEach(() => {
            jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
        });

        it('acepta una URL pública por HTTPS', async () => {
            const url = await guard.validarUrlBase('https://mi-erp.example.com');
            expect(url.hostname).toBe('mi-erp.example.com');
        });

        it('rechaza HTTP: por ahí viajarían en claro credenciales y datos', async () => {
            await expect(guard.validarUrlBase('http://mi-erp.example.com'))
                .rejects.toMatchObject({ code: 'ERP_URL_NO_HTTPS' });
        });

        it('rechaza un puerto que huele a red interna', async () => {
            await expect(guard.validarUrlBase('https://mi-erp.example.com:5432'))
                .rejects.toMatchObject({ code: 'ERP_PUERTO_NO_ADMITIDO' });
        });

        it('rechaza credenciales embebidas en la URL', async () => {
            // Acabarían en la fila, en los logs y en cualquier traza.
            await expect(guard.validarUrlBase('https://u:p@mi-erp.example.com'))
                .rejects.toMatchObject({ code: 'ERP_URL_CON_CREDENCIALES' });
        });

        it('rechaza un nombre que resuelve a una dirección interna', async () => {
            dns.promises.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
            await expect(guard.validarUrlBase('https://interno.example.com'))
                .rejects.toMatchObject({ code: 'ERP_DESTINO_INTERNO' });
        });

        it('rechaza si CUALQUIERA de las IPs es interna, no sólo la primera', async () => {
            // Un nombre puede resolver a varias, y basta una interna para que la
            // conexión sea aprovechable.
            dns.promises.lookup.mockResolvedValue([
                { address: '93.184.216.34', family: 4 },
                { address: '10.0.0.5', family: 4 },
            ]);
            await expect(guard.validarUrlBase('https://mixto.example.com'))
                .rejects.toMatchObject({ code: 'ERP_DESTINO_INTERNO' });
        });

        it('rechaza una URL que no lo es', async () => {
            await expect(guard.validarUrlBase('esto no es una url'))
                .rejects.toMatchObject({ code: 'ERP_URL_INVALIDA' });
        });
    });

    describe('lookup del agente — la defensa contra DNS rebinding', () => {
        // Sin esto, entre validar la URL y conectar hay una ventana en la que el
        // nombre puede cambiar de IP. Es corta, y es justo la que se explota.
        it('corta la conexión si el nombre resuelve a interna AL CONECTAR', (done) => {
            jest.spyOn(dns, 'lookup').mockImplementation((_h, _o, cb) => {
                cb(null, [{ address: '169.254.169.254', family: 4 }]);
            });
            guard.lookupValidado('rebind.example.com', {}, (err) => {
                expect(err).toBeTruthy();
                expect(err.code).toBe('ERP_DESTINO_INTERNO');
                done();
            });
        });

        it('deja conectar a una pública', (done) => {
            jest.spyOn(dns, 'lookup').mockImplementation((_h, _o, cb) => {
                cb(null, [{ address: '93.184.216.34', family: 4 }]);
            });
            guard.lookupValidado('ok.example.com', {}, (err, address) => {
                expect(err).toBeNull();
                expect(address).toBe('93.184.216.34');
                done();
            });
        });
    });

    describe('cliente HTTP', () => {
        it('no sigue redirecciones', () => {
            // Un 302 hacia http://127.0.0.1 convertiría un destino válido en uno
            // interno sin que ninguna comprobación previa lo hubiera visto.
            const c = guard.crearCliente({ baseUrl: 'https://mi-erp.example.com' });
            expect(c.defaults.maxRedirects).toBe(0);
        });

        it('acota el tamaño de la respuesta y el tiempo', () => {
            const c = guard.crearCliente({ baseUrl: 'https://mi-erp.example.com' });
            expect(c.defaults.maxContentLength).toBe(guard.MAX_RESPUESTA_BYTES);
            expect(c.defaults.timeout).toBe(guard.TIMEOUT_MS);
        });

        it('usa el lookup validado en los dos agentes', () => {
            const c = guard.crearCliente({ baseUrl: 'https://mi-erp.example.com' });
            expect(c.defaults.httpsAgent.options.lookup).toBe(guard.lookupValidado);
            expect(c.defaults.httpAgent.options.lookup).toBe(guard.lookupValidado);
        });
    });
});
