const { crearAdaptador, IDS, describirErp, canonical } = require('../../../services/erp');
const NetSuiteAdapter = require('../../../services/erp/NetSuiteAdapter');

const cfg = (extra = {}) => ({
    baseUrl: 'https://erp.example.com',
    credenciales: { usuario: 'u', password: 'p', token: 't', companyDB: 'db', baseDatos: 'db' },
    ...extra,
});

describe('Adaptadores de ERP', () => {
    describe('el contrato es pobre a propósito', () => {
        it('ninguno acepta una ruta, una consulta ni una URL como filtro', () => {
            // Es la misma razón por la que el MCP no tiene call_gateway(path),
            // con el agravante de que aquí el destino es el sistema de otro.
            const { FILTROS } = require('../../../services/erp/ErpAdapter');
            for (const clave of Object.keys(FILTROS)) {
                expect(clave).not.toMatch(/path|url|query|sql|endpoint|dominio|filter/i);
            }
        });

        it('rechaza un filtro que no esté en la lista cerrada', () => {
            const a = crearAdaptador('odoo', cfg());
            expect(() => a.normalizarFiltro({ sql: '1=1' }))
                .toThrow(/no admitido/i);
        });

        it('acota el límite a un rango razonable', () => {
            const a = crearAdaptador('odoo', cfg());
            expect(a.normalizarFiltro({ limite: 99999 }).limite).toBe(200);
            expect(a.normalizarFiltro({ limite: -5 }).limite).toBe(1);
            expect(a.normalizarFiltro({}).limite).toBe(50);
        });

        it('rechaza una fecha que no lo es', () => {
            const a = crearAdaptador('odoo', cfg());
            expect(() => a.normalizarFiltro({ desde: 'ayer por la tarde' })).toThrow(/fecha/i);
        });
    });

    describe('escapado por dialecto', () => {
        it('OData: dobla la comilla simple, que es como se escapa allí', () => {
            const a = crearAdaptador('sap_s4hana', cfg());
            const expr = a._filtroOData('factura', { numero: "F-1' or '1'='1" });
            expect(expr).toContain("''");
            // El operador y el campo siguen siendo los nuestros: el valor no ha
            // conseguido salir de sus comillas.
            expect(expr.startsWith('SupplierInvoice eq ')).toBe(true);
            expect(expr.match(/ eq /g)).toHaveLength(1);
        });

        it('Odoo: el dominio es estructura, así que no hay nada que escapar', () => {
            const a = crearAdaptador('odoo', cfg());
            const d = a._dominio('factura', { numero: "F-1' or '1'='1" });
            const clausula = d.find((c) => c[0] === 'name');
            // El valor viaja como tercer elemento de un array: no puede alterar
            // ni el campo ni el operador.
            expect(clausula).toEqual(['name', '=', "F-1' or '1'='1"]);
        });

        it('NetSuite: RECHAZA en vez de limpiar, porque construye SQL de verdad', () => {
            // SuiteQL no admite parámetros ligados, así que aquí sí hay inyección
            // si un valor entra crudo. Limpiar es una carrera que se pierde.
            expect(() => NetSuiteAdapter.textoSeguro("x' OR '1'='1", 'numero'))
                .toThrow(/no admitidos/i);
            expect(() => NetSuiteAdapter.textoSeguro('F-2026/0042_A', 'numero')).not.toThrow();
        });

        it('NetSuite: el WHERE no deja escapar un valor hostil', () => {
            const a = crearAdaptador('netsuite', cfg());
            expect(() => a._where('factura', { numero: "'; DROP TABLE transaction; --" }))
                .toThrow(/ERP_FILTRO_CARACTERES|no admitidos/i);
        });
    });

    describe('proyección al modelo canónico', () => {
        it('sólo salen los campos canónicos, aunque el ERP devuelva más', () => {
            // Cada campo que sale del ERP es un dato del que respondemos.
            const a = crearAdaptador('sap_s4hana', cfg());
            const doc = a.proyectar('factura', {
                numero: 'F-1', importe: 100, moneda: 'EUR',
                iban_proveedor: 'ES77…', salario_responsable: 45000,
            });
            expect(Object.keys(doc).sort()).toEqual(['importe', 'moneda', 'numero']);
        });

        it('el alcance aprobado recorta todavía más', () => {
            // Un campo canónico que el cliente no aprobó no sale, aunque nos
            // sirviera y aunque el ERP lo devuelva.
            const a = crearAdaptador('sap_s4hana', cfg({ alcanceCampos: ['numero'] }));
            const doc = a.proyectar('factura', { numero: 'F-1', importe: 100, moneda: 'EUR' });
            expect(Object.keys(doc)).toEqual(['numero']);
        });
    });

    describe('escritura', () => {
        it('exige clave de idempotencia: un agente reintenta', async () => {
            const a = crearAdaptador('sap_s4hana', cfg());
            await expect(a.escribirDocumento('factura', { numero: 'F-1' }, null))
                .rejects.toMatchObject({ code: 'ERP_SIN_IDEMPOTENCIA' });
        });

        it('rechaza escribir un tipo que el adaptador no declara escribible', async () => {
            const a = crearAdaptador('sap_s4hana', cfg());
            await expect(a.escribirDocumento('asiento', {}, 'k-1'))
                .rejects.toMatchObject({ code: 'ERP_TIPO_NO_SOPORTADO' });
        });

        it('los de solo lectura no escriben nada', async () => {
            for (const id of ['dynamics', 'netsuite']) {
                const a = crearAdaptador(id, cfg());
                expect(a.tiposEscribibles).toEqual([]);
                await expect(a.escribirDocumento('factura', {}, 'k-1'))
                    .rejects.toMatchObject({ code: 'ERP_TIPO_NO_SOPORTADO' });
            }
        });
    });

    describe('registro', () => {
        it('un ERP fuera del registro no se puede instanciar', () => {
            expect(() => crearAdaptador('sap_inventado', cfg()))
                .toThrow(/no soportado/i);
        });

        it('todos declaran credenciales y tipos', () => {
            for (const id of IDS) {
                const d = describirErp(id);
                expect(d.credenciales.length).toBeGreaterThan(0);
                expect(d.tiposLegibles.length).toBeGreaterThan(0);
                for (const t of d.tiposLegibles) expect(canonical.esTipoValido(t)).toBe(true);
            }
        });

        it('describir un ERP no abre ninguna conexión', () => {
            // El cliente HTTP es perezoso a propósito: el catálogo se sirve sin
            // tocar la red ni las credenciales.
            expect(() => IDS.map(describirErp)).not.toThrow();
        });
    });

    describe('esquema', () => {
        it('dice qué campos hay y cuáles se han aprobado', () => {
            const a = crearAdaptador('odoo', cfg({ alcanceCampos: ['numero', 'importe'] }));
            const e = a.describirEsquema('factura');
            expect(e.camposCanonicos).toContain('proveedor');
            expect(e.camposAprobados).toEqual(['numero', 'importe']);
            expect(e.escribible).toBe(true);
        });

        it('un tipo desconocido se rechaza', () => {
            const a = crearAdaptador('odoo', cfg());
            expect(() => a.describirEsquema('nomina')).toThrow(/desconocido/i);
        });
    });
});
