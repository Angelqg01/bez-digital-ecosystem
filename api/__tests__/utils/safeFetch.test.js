/**
 * utils/safeFetch — guardia anti-SSRF de las peticiones a URLs de cliente.
 */
const dns = require('dns');
const {
    safeFetch, validarUrl, validarDestinoPublico, esIpPublica, _lookupPublico,
} = require('../../utils/safeFetch');

const resolverA = (...ips) => jest.spyOn(dns.promises, 'lookup')
    .mockResolvedValue(ips.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));

afterEach(() => jest.restoreAllMocks());

describe('esIpPublica', () => {
    it.each([
        '10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.4', '192.168.1.1',
        '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1',
        '::ffff:10.0.0.1', '::ffff:169.254.169.254', 'no-es-ip',
    ])('rechaza %s', (ip) => expect(esIpPublica(ip)).toBe(false));

    it.each(['8.8.8.8', '34.120.10.5', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
        'acepta %s', (ip) => expect(esIpPublica(ip)).toBe(true),
    );
});

describe('validarUrl', () => {
    it.each([
        ['http://cliente.example/hook', /https/],
        ['https://user:pass@cliente.example/hook', /credenciales/],
        ['https://localhost/hook', /interna/],
        ['https://metadata.google.internal/computeMetadata/v1/', /interna/],
        ['https://redis.svc.local/', /interna/],
        ['https://169.254.169.254/latest', /pública/],
        ['https://[::1]/hook', /pública/],
        ['https://10.0.0.5:6379/', /pública/],
        ['no-es-url', /inválida/],
    ])('rechaza %s', (url, motivo) => {
        expect(() => validarUrl(url)).toThrow(motivo);
    });

    it('acepta una URL https pública', () => {
        expect(validarUrl('https://cliente.example/hook').hostname).toBe('cliente.example');
    });
});

describe('validarDestinoPublico', () => {
    it('acepta un host que resuelve sólo a IPs públicas', async () => {
        resolverA('93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946');
        await expect(validarDestinoPublico('https://cliente.example/hook')).resolves.toBeTruthy();
    });

    it('rechaza un host con alguna IP interna aunque tenga otra pública', async () => {
        resolverA('93.184.216.34', '10.0.0.7');
        await expect(validarDestinoPublico('https://cliente.example/hook'))
            .rejects.toMatchObject({ code: 'DESTINATION_NOT_ALLOWED', status: 400 });
    });

    it('rechaza un host que no resuelve', async () => {
        jest.spyOn(dns.promises, 'lookup').mockRejectedValue(new Error('ENOTFOUND'));
        await expect(validarDestinoPublico('https://nadie.example/')).rejects.toThrow(/resolver/);
    });
});

describe('lookup del socket (anti DNS rebinding)', () => {
    it('falla la conexión si al conectar el host ya resuelve a una IP interna', (done) => {
        resolverA('127.0.0.1');
        _lookupPublico('cliente.example', { all: true }, (err) => {
            expect(err).toMatchObject({ code: 'DESTINATION_NOT_ALLOWED' });
            done();
        });
    });

    it('devuelve la dirección pública con la firma de dns.lookup', (done) => {
        resolverA('93.184.216.34');
        _lookupPublico('cliente.example', {}, (err, address, family) => {
            expect(err).toBeNull();
            expect(address).toBe('93.184.216.34');
            expect(family).toBe(4);
            done();
        });
    });
});

describe('safeFetch', () => {
    it('no sale a la red con una URL http', async () => {
        const lookup = jest.spyOn(dns.promises, 'lookup');
        await expect(safeFetch('http://cliente.example/hook')).rejects.toMatchObject({ code: 'DESTINATION_NOT_ALLOWED' });
        expect(lookup).not.toHaveBeenCalled();
    });

    it('no conecta a un host que resuelve al servidor de metadatos', async () => {
        resolverA('169.254.169.254');
        await expect(safeFetch('https://rebind.example/', { method: 'POST', body: '{}' }))
            .rejects.toMatchObject({ code: 'DESTINATION_NOT_ALLOWED' });
    });
});

describe('una sola lista de rangos para toda la API', () => {
    it('el guard de los conectores ERP clasifica igual que safeFetch', () => {
        const { esDireccionProhibida } = require('../../services/erp/httpGuard');
        for (const ip of ['10.0.0.1', '198.18.0.1', '2001:db8::1', '::ffff:127.0.0.1', '8.8.8.8', '2606:4700::1', 'x']) {
            expect(esDireccionProhibida(ip)).toBe(!esIpPublica(ip));
        }
    });

    it('el canal webhook de notificaciones no sale a la red con una URL http', async () => {
        const lookup = jest.spyOn(dns.promises, 'lookup');
        const { _sendWebhook } = require('../../services/channelService');
        await expect(_sendWebhook('http://10.0.0.5/hook', {})).rejects.toMatchObject({ code: 'DESTINATION_NOT_ALLOWED' });
        expect(lookup).not.toHaveBeenCalled();
    });
});
