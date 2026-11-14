/**
 * services/rwaRent — leer transferencias de Polygon, preparar un reparto de
 * rentas y la prueba con la que cobra cada titular.
 */
const { ethers } = require('ethers');
const polygon = require('../../services/polygonReader');
const rwaRent = require('../../services/rwaRent');
const tree = require('../../services/rwaRentTree');

const DISTRIBUIDOR = ethers.getAddress('0x' + 'd'.repeat(40));
const CREADOR = ethers.getAddress('0x' + 'c'.repeat(40));
const ANA = ethers.getAddress('0x' + 'a'.repeat(40));
const LUIS = ethers.getAddress('0x' + 'b'.repeat(40));
const EVA = ethers.getAddress('0x' + 'e'.repeat(40));
const CERO = ethers.ZeroAddress;
const FABRICA = '0xa7e6656eFA45EB59ca247aa15F883330692C0d9A';

const T0 = 1_700_000_000;
const BLOQUE_CREACION = 500;
const CABEZA = 10_000;

const evIface = new ethers.Interface([
    'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
    'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
]);
const repIface = new ethers.Interface([
    'event DistributionCreated(uint256 indexed distributionId, uint256 indexed assetId, address indexed issuer, address token, uint256 amount, uint256 fee, bytes32 merkleRoot, uint64 snapshotBlock, uint64 claimDeadline, string detailsCID)',
    'function approve(address spender, uint256 amount)',
    'function createDistribution(uint256 assetId, address token, uint256 amount, bytes32 merkleRoot, uint64 snapshotBlock, uint64 claimDeadline, string detailsCID)',
    'function claim(uint256 distributionId, address account, uint256 amount, bytes32[] proof)',
]);

function logSingle(blockNumber, from, to, id, value) {
    const { data, topics } = evIface.encodeEventLog('TransferSingle', [CREADOR, from, to, id, value]);
    return { blockNumber, index: 0, data, topics };
}
function logBatch(blockNumber, from, to, ids, values) {
    const { data, topics } = evIface.encodeEventLog('TransferBatch', [CREADOR, from, to, ids, values]);
    return { blockNumber, index: 0, data, topics };
}

/** Emisión de 1.000 fracciones del activo 3; vende 600 a ana, 200 a luis (en un batch) y 100 a eva. */
const LOGS = [
    logSingle(600, CERO, CREADOR, 3n, 1000n),
    logSingle(650, CERO, CREADOR, 4n, 50n), // otro activo
    logSingle(700, CREADOR, ANA, 3n, 600n),
    logBatch(800, CREADOR, LUIS, [3n, 4n], [200n, 10n]),
    logSingle(9000, CREADOR, EVA, 3n, 100n),
];

const activo = (over = {}) => ({
    name: 'Nave', category: 7n, legalDocumentCID: 'QmLegal', imagesCID: '', totalSupply: 1000n,
    valuationUSD: 500000n, pricePerFraction: ethers.parseEther('10'), estimatedYield: 850n, creator: CREADOR,
    location: 'Algeciras', createdAt: BigInt(T0 + BLOQUE_CREACION * 2), isActive: true, ...over,
});

/** Cadena falsa. `maxRango` simula un RPC que rechaza consultas de logs muy largas. */
function cadena({ maxRango = Infinity } = {}) {
    const llamadas = { logs: 0 };
    polygon._setCadena({
        bloqueActual: async () => CABEZA,
        timestampDeBloque: async (n) => T0 + n * 2,
        logs: async ({ fromBlock, toBlock }) => {
            llamadas.logs += 1;
            if (toBlock - fromBlock + 1 > maxRango) throw new Error('query returned more than 10000 results');
            return LOGS.filter((l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock);
        },
    });
    return llamadas;
}

function lector({ asset = activo(), distribucion, reclamado = false, verificado = false, feeBps = 100n } = {}) {
    const fn = jest.fn(async (_dir, _abi, f) => {
        if (f === 'getAsset') return asset;
        if (f === 'feeBps') return feeBps;
        if (f === 'distributions') return distribucion;
        if (f === 'isClaimed') return reclamado;
        if (f === 'isVerified') return verificado;
        throw new Error(`inesperado ${f}`);
    });
    polygon._setLlamador(fn);
    return fn;
}

const base = { assetId: 3, emisor: CREADOR, token: 'usdc', importe: '900' };

describe('services/rwaRent', () => {
    const envAntes = { ...process.env };
    beforeEach(() => {
        process.env.RWA_RENT_DISTRIBUTOR_ADDRESS = DISTRIBUIDOR;
        rwaRent._vaciarCache();
        cadena();
    });
    afterEach(() => {
        process.env = { ...envAntes };
        polygon._setLlamador(null);
        polygon._setCadena(null);
    });

    describe('prepararReparto', () => {
        it('sin contrato de reparto: 503 DISTRIBUTOR_NOT_DEPLOYED', async () => {
            delete process.env.RWA_RENT_DISTRIBUTOR_ADDRESS;
            await expect(rwaRent.prepararReparto(base)).rejects.toMatchObject({ code: 'DISTRIBUTOR_NOT_DEPLOYED', status: 503 });
        });

        it('reconstruye saldos de la cadena, excluye al emisor y prepara approve + createDistribution', async () => {
            lector();
            const r = await rwaRent.prepararReparto(base);

            // 600 + 200 + 100 fracciones vendidas; las 100 del emisor no cobran.
            expect(r.reparto.titulares).toBe(3);
            expect(r.reparto.importe).toBe('900.0');
            expect(r.reparto.comision).toBe('9.0'); // 1 %
            expect(r.reparto.totalAPagar).toBe('909.0');
            expect(r.reparto.importeUsd).toBe('900.00'); // USDC = 1 USD
            expect(r.reparto.totalAPagarUsd).toBe('909.00');
            expect(r.reparto.restoSinAsignar).toBe('0.0');
            expect(r.reparto.bloqueDeCorte).toBe(CABEZA - 128);
            const usdc = (v) => ethers.parseUnits(v, 6).toString();
            expect(r.justificante.reparto[ANA].importe).toBe(usdc('600'));
            expect(r.justificante.reparto[LUIS].importe).toBe(usdc('200'));
            expect(r.justificante.reparto[EVA].importe).toBe(usdc('100'));
            expect(r.justificante.reparto[CREADOR]).toBeUndefined();

            expect(r.transacciones).toHaveLength(2);
            const [aprobar, crear] = r.transacciones;
            expect(aprobar.to).toBe(rwaRent.TOKENS.usdc.direccion);
            const ap = repIface.decodeFunctionData('approve', aprobar.data);
            expect(ap[0]).toBe(DISTRIBUIDOR);
            expect(ap[1]).toBe(ethers.parseUnits('909', 6));

            expect(crear.to).toBe(DISTRIBUIDOR);
            const c = repIface.decodeFunctionData('createDistribution', crear.data);
            expect(c[0]).toBe(3n);
            expect(c[1]).toBe(rwaRent.TOKENS.usdc.direccion);
            expect(c[2]).toBe(ethers.parseUnits('900', 6));
            expect(c[3]).toBe(r.reparto.raiz);
            expect(c[4]).toBe(BigInt(CABEZA - 128));
            expect(Number(c[5])).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000) + 31 * 86400 - 5);
        });

        it('las pruebas del justificante verifican contra la raíz que se publica', async () => {
            lector();
            const r = await rwaRent.prepararReparto(base);
            for (const [cuenta, p] of Object.entries(r.justificante.reparto)) {
                expect(tree.verificar(r.reparto.raiz, cuenta, p.importe, p.prueba)).toBe(true);
            }
        });

        it('incluye detallesCID en la transacción', async () => {
            lector();
            const r = await rwaRent.prepararReparto({ ...base, detallesCID: 'QmJustificanteDelReparto' });
            const c = repIface.decodeFunctionData('createDistribution', r.transacciones[1].data);
            expect(c[6]).toBe('QmJustificanteDelReparto');
        });

        it('reparte en BEZ con 18 decimales', async () => {
            lector();
            const r = await rwaRent.prepararReparto({ ...base, token: 'bez', importe: '900' });
            expect(r.justificante.reparto[ANA].importe).toBe(ethers.parseEther('600').toString());
            expect(r.reparto.importeUsd).toBe('6.75'); // 900 BEZ × 0,0075 USD
        });

        it('si el RPC rechaza tramos largos los parte y llega al mismo resultado', async () => {
            lector();
            const ref = await rwaRent.prepararReparto(base);
            rwaRent._vaciarCache();
            const llamadas = cadena({ maxRango: 3000 });
            const r = await rwaRent.prepararReparto(base);
            expect(llamadas.logs).toBeGreaterThan(1);
            expect(r.reparto.raiz).toBe(ref.reparto.raiz);
        });

        it('rechaza a quien no es el creador del activo', async () => {
            lector();
            await expect(rwaRent.prepararReparto({ ...base, emisor: ANA }))
                .rejects.toMatchObject({ code: 'NOT_CREATOR', status: 403 });
        });

        it('rechaza un activo desactivado', async () => {
            lector({ asset: activo({ isActive: false }) });
            await expect(rwaRent.prepararReparto(base)).rejects.toMatchObject({ code: 'ASSET_INACTIVE' });
        });

        it('valida token, importe, plazo y CID', async () => {
            lector();
            await expect(rwaRent.prepararReparto({ ...base, token: 'doge' })).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
            await expect(rwaRent.prepararReparto({ ...base, importe: '10.1234567' })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
            await expect(rwaRent.prepararReparto({ ...base, importe: '0' })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
            await expect(rwaRent.prepararReparto({ ...base, plazoDias: 30 })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
            await expect(rwaRent.prepararReparto({ ...base, plazoDias: 366 })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
            await expect(rwaRent.prepararReparto({ ...base, detallesCID: 'no es un cid!' })).rejects.toMatchObject({ code: 'INVALID_CID' });
        });

        it('si el RPC de logs falla del todo: 503 RPC_UNAVAILABLE', async () => {
            lector();
            polygon._setCadena({
                bloqueActual: async () => CABEZA,
                timestampDeBloque: async (n) => T0 + n * 2,
                logs: async () => { throw new Error('boom'); },
            });
            await expect(rwaRent.prepararReparto(base)).rejects.toMatchObject({ code: 'RPC_UNAVAILABLE', status: 503 });
        });

        it('NO_HOLDERS sale como RwaRentError (400), no como un error de código que acabaría en un 500', async () => {
            lector();
            polygon._setCadena({
                bloqueActual: async () => CABEZA,
                timestampDeBloque: async (n) => T0 + n * 2,
                logs: async () => [],
            });
            await expect(rwaRent.prepararReparto(base)).rejects.toMatchObject({ name: 'RwaRentError', code: 'NO_HOLDERS', status: 400 });
        });

        it('un activo sin ninguna fracción vendida no tiene a quién repartir', async () => {
            lector();
            polygon._setCadena({
                bloqueActual: async () => CABEZA,
                timestampDeBloque: async (n) => T0 + n * 2,
                logs: async ({ fromBlock, toBlock }) => [logSingle(600, CERO, CREADOR, 3n, 1000n)]
                    .filter((l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock),
            });
            await expect(rwaRent.prepararReparto(base)).rejects.toMatchObject({ code: 'NO_HOLDERS' });
        });
    });

    describe('listarRepartos', () => {
        const ahora = () => Math.floor(Date.now() / 1000);
        const dist = (over = {}) => ({
            assetId: 3n, issuer: CREADOR, token: rwaRent.TOKENS.usdc.direccion, amount: ethers.parseUnits('900', 6),
            remaining: ethers.parseUnits('900', 6), merkleRoot: '0x' + '1'.repeat(64), snapshotBlock: 9872n,
            claimDeadline: BigInt(ahora() + 40 * 86400), detailsCID: '', ...over,
        });

        function logCreado(blockNumber, distributionId, assetId) {
            const { data, topics } = repIface.encodeEventLog('DistributionCreated', [
                distributionId, assetId, CREADOR, rwaRent.TOKENS.usdc.direccion, 1n, 0n, '0x' + '1'.repeat(64), 1n, 2n, '',
            ]);
            return { blockNumber, index: 0, data, topics };
        }

        /** Cadena que devuelve los eventos de transferencia y los de creación según el filtro. */
        function cadenaConRepartos(creados) {
            const filtros = [];
            polygon._setCadena({
                bloqueActual: async () => CABEZA,
                timestampDeBloque: async (n) => T0 + n * 2,
                logs: async (f) => {
                    filtros.push(f);
                    const fuente = f.address === DISTRIBUIDOR ? creados : LOGS;
                    const hasta = f.toBlock === 'latest' ? Infinity : f.toBlock;
                    return fuente.filter((l) => l.blockNumber >= f.fromBlock && l.blockNumber <= hasta);
                },
            });
            return filtros;
        }

        it('lista los repartos del activo, del más reciente al más antiguo, filtrando por assetId en el log', async () => {
            const filtros = cadenaConRepartos([logCreado(9100, 1n, 3n), logCreado(9300, 2n, 3n)]);
            const porId = { 1: dist(), 2: dist({ amount: ethers.parseUnits('50', 6), remaining: ethers.parseUnits('50', 6) }) };
            polygon._setLlamador(jest.fn(async (_d, _a, f, args) => {
                if (f === 'getAsset') return activo();
                if (f === 'distributions') return porId[Number(args[0])];
                throw new Error(`inesperado ${f}`);
            }));

            const r = await rwaRent.listarRepartos({ assetId: 3 });
            expect(r.repartos.map((x) => x.distributionId)).toEqual(['2', '1']);
            expect(r.repartos[0]).toMatchObject({ token: 'USDC', importe: '50.0', abierto: true });
            expect(r.repartos[0].yaCobrado).toBeUndefined(); // sin cuenta, nada sobre ninguna wallet
            const f = filtros.find((x) => x.address === DISTRIBUIDOR);
            expect(f.topics[2]).toBe(ethers.zeroPadValue(ethers.toBeHex(3n), 32));
        });

        it('incluye un reparto recién minado aunque el número de bloque leído vaya por detrás', async () => {
            // La cabeza que ve la API es 10.000, pero el reparto está en el 10.005: sólo aparece pidiendo 'latest'.
            const filtros = cadenaConRepartos([logCreado(10_005, 1n, 3n)]);
            lector({ distribucion: dist() });
            polygon._setLlamador(jest.fn(async (_d, _a, f) => {
                if (f === 'getAsset') return activo();
                if (f === 'distributions') return dist();
                throw new Error(`inesperado ${f}`);
            }));
            const r = await rwaRent.listarRepartos({ assetId: 3 });
            expect(r.repartos.map((x) => x.distributionId)).toEqual(['1']);
            expect(filtros.find((x) => x.address === DISTRIBUIDOR).toBlock).toBe('latest');
        });

        it('sin repartos devuelve una lista vacía', async () => {
            cadenaConRepartos([]);
            lector();
            const r = await rwaRent.listarRepartos({ assetId: 3 });
            expect(r.repartos).toEqual([]);
        });

        it('con cuenta añade si ya cobró y cuánto le toca en los repartos abiertos', async () => {
            // Reparto real calculado con el servicio, para que la raíz sea reproducible.
            lector();
            const creado = await rwaRent.prepararReparto(base);
            rwaRent._vaciarCache();
            const real = dist({
                merkleRoot: creado.reparto.raiz, snapshotBlock: BigInt(creado.reparto.bloqueDeCorte),
            });
            const cerrado = dist({ claimDeadline: BigInt(ahora() - 100) });
            cadenaConRepartos([logCreado(9100, 1n, 3n), logCreado(9300, 2n, 3n)]);
            const porId = { 1: cerrado, 2: real };
            polygon._setLlamador(jest.fn(async (_d, _a, f, args) => {
                if (f === 'getAsset') return activo();
                if (f === 'distributions') return porId[Number(args[0])];
                if (f === 'isClaimed') return false;
                throw new Error(`inesperado ${f}`);
            }));

            const r = await rwaRent.listarRepartos({ assetId: 3, cuenta: ANA });
            const [nuevo, viejo] = r.repartos;
            expect(nuevo).toMatchObject({ distributionId: '2', yaCobrado: false, miParte: '600.0', motivoSinParte: null });
            expect(viejo).toMatchObject({ distributionId: '1', abierto: false, miParte: null }); // cerrado: no se calcula

            const sinParte = await rwaRent.listarRepartos({ assetId: 3, cuenta: ethers.getAddress('0x' + '7'.repeat(40)) });
            expect(sinParte.repartos[0]).toMatchObject({ miParte: null, motivoSinParte: 'NO_SHARE' });
        });

        it('si la raíz no es reproducible lo dice por reparto, sin romper el listado', async () => {
            cadenaConRepartos([logCreado(9100, 1n, 3n)]);
            polygon._setLlamador(jest.fn(async (_d, _a, f) => {
                if (f === 'getAsset') return activo();
                if (f === 'distributions') return dist({ merkleRoot: '0x' + '9'.repeat(64) });
                if (f === 'isClaimed') return false;
                throw new Error(`inesperado ${f}`);
            }));
            const r = await rwaRent.listarRepartos({ assetId: 3, cuenta: ANA });
            expect(r.repartos[0]).toMatchObject({ miParte: null, motivoSinParte: 'ROOT_NOT_REPRODUCIBLE' });
        });

        it('sin contrato de reparto: 503', async () => {
            delete process.env.RWA_RENT_DISTRIBUTOR_ADDRESS;
            await expect(rwaRent.listarRepartos({ assetId: 3 })).rejects.toMatchObject({ code: 'DISTRIBUTOR_NOT_DEPLOYED' });
        });
    });

    describe('leerReparto', () => {
        const dist = (over = {}) => ({
            assetId: 3n, issuer: CREADOR, token: rwaRent.TOKENS.usdc.direccion, amount: ethers.parseUnits('900', 6),
            remaining: ethers.parseUnits('300', 6), merkleRoot: '0x' + '1'.repeat(64), snapshotBlock: 9872n,
            claimDeadline: BigInt(Math.floor(Date.now() / 1000) + 86400), detailsCID: 'QmX', ...over,
        });

        it('devuelve el reparto con importes legibles', async () => {
            lector({ distribucion: dist() });
            const r = await rwaRent.leerReparto({ distributionId: 1 });
            expect(r).toMatchObject({ assetId: '3', emisor: CREADOR, token: 'USDC', importe: '900.0', sinReclamar: '300.0', abierto: true, detallesCID: 'QmX' });
        });

        it('un reparto que no existe: 404', async () => {
            lector({ distribucion: dist({ issuer: CERO }) });
            await expect(rwaRent.leerReparto({ distributionId: 9 })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
        });
    });

    describe('prepararReclamo', () => {
        /** Crea un reparto con el servicio y devuelve lo que el contrato guardaría. */
        async function repartoCreado(over = {}) {
            lector();
            const r = await rwaRent.prepararReparto(base);
            rwaRent._vaciarCache(); // el titular recalcula desde cero, sin ayuda de la caché
            return {
                assetId: 3n, issuer: CREADOR, token: rwaRent.TOKENS.usdc.direccion, amount: ethers.parseUnits('900', 6),
                remaining: ethers.parseUnits('900', 6), merkleRoot: r.reparto.raiz, snapshotBlock: BigInt(r.reparto.bloqueDeCorte),
                claimDeadline: BigInt(Math.floor(Date.now() / 1000) + 40 * 86400), detailsCID: '', ...over,
            };
        }

        it('recalcula el árbol y devuelve una prueba que el contrato aceptaría', async () => {
            const d = await repartoCreado();
            lector({ distribucion: d });
            const r = await rwaRent.prepararReclamo({ distributionId: 1, cuenta: ANA });

            expect(r.cobro).toMatchObject({ cuenta: ANA, token: 'USDC', importe: '600.0' });
            const c = repIface.decodeFunctionData('claim', r.transacciones[0].data);
            expect(c[0]).toBe(1n);
            expect(c[1]).toBe(ANA);
            expect(c[2]).toBe(ethers.parseUnits('600', 6));
            expect(tree.verificar(d.merkleRoot, c[1], c[2], [...c[3]])).toBe(true);
        });

        it('si la raíz publicada no sale de la cadena: 409 ROOT_NOT_REPRODUCIBLE', async () => {
            const d = await repartoCreado({ merkleRoot: '0x' + '9'.repeat(64) });
            lector({ distribucion: d });
            await expect(rwaRent.prepararReclamo({ distributionId: 1, cuenta: ANA }))
                .rejects.toMatchObject({ code: 'ROOT_NOT_REPRODUCIBLE', status: 409 });
        });

        it('quien no tenía fracciones en el corte: 404 NO_SHARE; el emisor tampoco cobra', async () => {
            const d = await repartoCreado();
            lector({ distribucion: d });
            await expect(rwaRent.prepararReclamo({ distributionId: 1, cuenta: ethers.getAddress('0x' + '7'.repeat(40)) }))
                .rejects.toMatchObject({ code: 'NO_SHARE', status: 404 });
            await expect(rwaRent.prepararReclamo({ distributionId: 1, cuenta: CREADOR }))
                .rejects.toMatchObject({ code: 'NO_SHARE' });
        });

        it('rechaza si ya cobró o si el plazo terminó', async () => {
            const d = await repartoCreado();
            lector({ distribucion: d, reclamado: true });
            await expect(rwaRent.prepararReclamo({ distributionId: 1, cuenta: ANA })).rejects.toMatchObject({ code: 'ALREADY_CLAIMED' });

            lector({ distribucion: { ...d, claimDeadline: BigInt(Math.floor(Date.now() / 1000) - 10) } });
            await expect(rwaRent.prepararReclamo({ distributionId: 1, cuenta: ANA })).rejects.toMatchObject({ code: 'CLAIM_WINDOW_CLOSED' });
        });

        it('en un inmueble exige KYC (si se pide comprobarlo)', async () => {
            const d = await repartoCreado();
            lector({ distribucion: d, asset: activo({ category: 0n }), verificado: false });
            await expect(rwaRent.prepararReclamo({ distributionId: 1, cuenta: ANA }))
                .rejects.toMatchObject({ code: 'KYC_REQUIRED' });
            // Sin comprobarlo (MCP) el contrato es quien decide.
            const sin = await rwaRent.prepararReclamo({ distributionId: 1, cuenta: ANA, comprobarKyc: false });
            expect(sin.transacciones).toHaveLength(1);
            lector({ distribucion: d, asset: activo({ category: 0n }), verificado: true });
            await expect(rwaRent.prepararReclamo({ distributionId: 1, cuenta: ANA })).resolves.toBeDefined();
        });
    });
});
