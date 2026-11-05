const crypto = require('crypto');
const { _comprobarServidor } = require('../../utils/safeFetch');

describe('safeFetch — comprobación TLS del proveedor', () => {
    const pub = crypto.randomBytes(64);
    const cert = { subject: { CN: 'api.proveedor.example' }, subjectaltname: 'DNS:api.proveedor.example', pubkey: pub };
    const pin = crypto.createHash('sha256').update(pub).digest('base64');

    it('acepta el certificado cuya clave coincide con el pin', () => {
        expect(_comprobarServidor(pin)('api.proveedor.example', cert)).toBeUndefined();
    });

    it('rechaza otra clave aunque el nombre sea correcto', () => {
        expect(_comprobarServidor(Buffer.alloc(32).toString('base64'))('api.proveedor.example', cert).code).toBe('TLS_PIN_MISMATCH');
    });

    it('sin pin sigue comprobando el nombre del host', () => {
        expect(_comprobarServidor(null)('otro.example', cert)).toHaveProperty('code', 'ERR_TLS_CERT_ALTNAME_INVALID');
    });
});
