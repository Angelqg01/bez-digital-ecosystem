const dns = require('dns');
const { mockQuery } = require('../helpers');
const erpConnections = require('../../services/erpConnections');
const { decryptSecret } = require('../../services/secretVault');

const APP = 'app-1';
const CONN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function filaConexion(over = {}) {
    return {
        id: CONN, app_id: APP, org_id: null, erp: 'odoo', nombre: 'Odoo producción',
        base_url: 'https://erp.example.com',
        credenciales_cifradas: require('../../services/secretVault')
            .encryptSecret(JSON.stringify({ baseDatos: 'db', usuario: 'u', password: 'p' })),
        alcance_campos: [], tipos_escritura: [], modo: 'gestionado',
        activa: true, dpa_firmado_at: new Date(),
        ultima_prueba_at: null, ultima_prueba_ok: null, ultimo_error: null,
        created_at: new Date(), updated_at: new Date(),
        ...over,
    };
}

describe('erpConnections', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    });
    afterEach(() => jest.restoreAllMocks());

    describe('alta', () => {
        it('cifra las credenciales antes de guardarlas', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [filaConexion()] });
            await erpConnections.crear({
                appId: APP, erp: 'odoo', nombre: 'Odoo', baseUrl: 'https://erp.example.com',
                credenciales: { baseDatos: 'db', usuario: 'u', password: 'secreta' },
            });
            const insert = mockQuery.mock.calls.find((c) => /INSERT INTO erp_connections/i.test(String(c[0])));
            const guardado = insert[1][5];
            expect(guardado).not.toContain('secreta');
            expect(guardado.startsWith('v1:')).toBe(true);
            expect(JSON.parse(decryptSecret(guardado)).password).toBe('secreta');
        });

        it('nace desactivada: dar de alta no es encender', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [filaConexion({ activa: false })] });
            const c = await erpConnections.crear({
                appId: APP, erp: 'odoo', nombre: 'Odoo', baseUrl: 'https://erp.example.com',
                credenciales: { baseDatos: 'db', usuario: 'u', password: 'p' },
            });
            expect(c.activa).toBe(false);
            const insert = mockQuery.mock.calls.find((c2) => /INSERT INTO erp_connections/i.test(String(c2[0])));
            expect(String(insert[0])).toMatch(/FALSE\)/);
        });

        it('rechaza una URL que resuelve a la red interna', async () => {
            dns.promises.lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
            await expect(erpConnections.crear({
                appId: APP, erp: 'odoo', nombre: 'x', baseUrl: 'https://interno.example.com',
                credenciales: { baseDatos: 'db', usuario: 'u', password: 'p' },
            })).rejects.toMatchObject({ code: 'ERP_DESTINO_INTERNO' });
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('exige las credenciales que ese ERP necesita', async () => {
            await expect(erpConnections.crear({
                appId: APP, erp: 'odoo', nombre: 'x', baseUrl: 'https://erp.example.com',
                credenciales: { usuario: 'u' },
            })).rejects.toMatchObject({ code: 'ERP_CREDENCIALES_INCOMPLETAS' });
        });

        it('rechaza credenciales que ese ERP no reconoce', async () => {
            // Un campo de más es un campo que guardaríamos sin saber para qué.
            await expect(erpConnections.crear({
                appId: APP, erp: 'odoo', nombre: 'x', baseUrl: 'https://erp.example.com',
                credenciales: { baseDatos: 'db', usuario: 'u', password: 'p', sshKey: '...' },
            })).rejects.toMatchObject({ code: 'ERP_CREDENCIALES_DESCONOCIDAS' });
        });

        it('rechaza un alcance con campos que no existen', async () => {
            await expect(erpConnections.crear({
                appId: APP, erp: 'odoo', nombre: 'x', baseUrl: 'https://erp.example.com',
                credenciales: { baseDatos: 'db', usuario: 'u', password: 'p' },
                alcanceCampos: ['numero', 'salario_del_gerente'],
            })).rejects.toMatchObject({ code: 'ERP_ALCANCE_INVALIDO' });
        });
    });

    describe('las credenciales entran y no salen', () => {
        it('la vista pública no las lleva, ni enmascaradas', () => {
            const v = erpConnections.vistaPublica(filaConexion());
            const texto = JSON.stringify(v);
            expect(texto).not.toContain('password');
            expect(texto).not.toContain('credenciales_cifradas');
            expect(texto).not.toMatch(/v1:/);
        });
    });

    describe('activación', () => {
        it('sin DPA firmado no se activa', async () => {
            // Guardar credenciales del ERP de un cliente nos hace encargado de
            // tratamiento: no es una imprudencia técnica, es una infracción.
            mockQuery.mockResolvedValueOnce({ rows: [filaConexion({ dpa_firmado_at: null, activa: false })] });
            await expect(erpConnections.activar(APP, CONN, {}))
                .rejects.toMatchObject({ code: 'ERP_SIN_DPA' });
        });

        it('no se activa si la prueba de conexión falla', async () => {
            // Activar y probar luego dejaría una ventana en la que el agente
            // pide documentos contra una conexión rota y el error no dice por qué.
            mockQuery.mockResolvedValueOnce({ rows: [filaConexion({ activa: false })] });  // _filaPropia
            mockQuery.mockResolvedValueOnce({ rows: [filaConexion({ activa: false })] });  // probar → _filaPropia
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });                     // update prueba
            await expect(erpConnections.activar(APP, CONN, { dpaFirmadoAt: new Date().toISOString() }))
                .rejects.toMatchObject({ code: 'ERP_PRUEBA_FALLIDA' });
        });
    });

    describe('titularidad', () => {
        it('la consulta filtra por app_id en el WHERE, no después', async () => {
            // Es la lección de la fuga que arregló la migración 049: un filtro
            // aplicado después de traer la fila es un filtro que se puede olvidar.
            mockQuery.mockResolvedValueOnce({ rows: [] });
            await erpConnections.obtener('otra-app', CONN);
            const sql = String(mockQuery.mock.calls[0][0]);
            expect(sql).toMatch(/WHERE id = \$1 AND app_id = \$2/);
            expect(mockQuery.mock.calls[0][1]).toEqual([CONN, 'otra-app']);
        });
    });

    describe('escritura', () => {
        it('una conexión de solo lectura no escribe aunque el agente insista', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [filaConexion({ tipos_escritura: [] })] });
            await expect(erpConnections.escribirDocumento(APP, CONN, {
                tipo: 'factura', payload: { numero: 'F-1', importe: 1, moneda: 'EUR' }, idempotencyKey: 'k-1',
            })).rejects.toMatchObject({ code: 'ERP_ESCRITURA_NO_AUTORIZADA' });
        });

        it('rechaza un payload sin los campos obligatorios', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [filaConexion({ tipos_escritura: ['factura'] })] });
            await expect(erpConnections.escribirDocumento(APP, CONN, {
                tipo: 'factura', payload: { numero: 'F-1' }, idempotencyKey: 'k-1',
            })).rejects.toMatchObject({ code: 'ERP_PAYLOAD_INCOMPLETO' });
        });

        it('un reintento con la MISMA clave y el mismo contenido no vuelve a escribir', async () => {
            // Es el caso que justifica toda la maquinaria: sin esto, el reintento
            // de un agente son dos facturas en la contabilidad del cliente.
            const payload = { numero: 'F-1', importe: 100, moneda: 'EUR' };
            const huella = require('crypto').createHash('sha256')
                .update(JSON.stringify(payload)).digest('hex');

            mockQuery.mockResolvedValueOnce({ rows: [filaConexion({ tipos_escritura: ['factura'] })] });
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'w-1', estado: 'aplicado', documento_id: 'DOC-9', payload_sha256: huella }],
            });

            const r = await erpConnections.escribirDocumento(APP, CONN, {
                tipo: 'factura', payload, idempotencyKey: 'k-1',
            });
            expect(r).toEqual({ id: 'DOC-9', creado: false, reintento: true });
            // No se ha llegado a insertar nada nuevo.
            expect(mockQuery.mock.calls.some((c) => /INSERT INTO erp_write_log/i.test(String(c[0])))).toBe(false);
        });

        it('la misma clave con OTRO contenido se rechaza en vez de aplicarse', async () => {
            // No es un reintento: es un error del llamante. Aplicar cualquiera de
            // los dos contenidos sería adivinar.
            mockQuery.mockResolvedValueOnce({ rows: [filaConexion({ tipos_escritura: ['factura'] })] });
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'w-1', estado: 'aplicado', documento_id: 'DOC-9', payload_sha256: 'otra-huella' }],
            });
            await expect(erpConnections.escribirDocumento(APP, CONN, {
                tipo: 'factura', payload: { numero: 'F-2', importe: 5, moneda: 'EUR' }, idempotencyKey: 'k-1',
            })).rejects.toMatchObject({ code: 'ERP_IDEMPOTENCIA_REUSADA' });
        });
    });

    describe('uso de una conexión desactivada', () => {
        it('no se puede leer de ella', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [filaConexion({ activa: false })] });
            await expect(erpConnections.listarDocumentos(APP, CONN, 'factura', {}))
                .rejects.toMatchObject({ code: 'ERP_INACTIVA' });
        });
    });
});
