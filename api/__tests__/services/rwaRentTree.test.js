/**
 * services/rwaRentTree — saldos en el corte, prorrata y árbol de Merkle del
 * reparto de rentas (contrato RWARentDistributor).
 */
const { ethers } = require('ethers');
const tree = require('../../services/rwaRentTree');

const dir = (c) => ethers.getAddress('0x' + c.repeat(40));
const EMISOR = dir('e');
const ANA = dir('a');
const LUIS = dir('b');
const EVA = dir('c');
const CERO = ethers.ZeroAddress;

/** Emisión de 1.000 fracciones del activo 3 y ventas: ana 500, luis 300, eva 200. */
const eventos = () => [
    { from: CERO, to: EMISOR, id: 3n, value: 1000n },
    { from: CERO, to: EMISOR, id: 4n, value: 77n }, // otro activo: no cuenta
    { from: EMISOR, to: ANA, id: 3n, value: 600n },
    { from: ANA, to: LUIS, ids: [4n, 3n], values: [0n, 100n] }, // batch
    { from: EMISOR, to: LUIS, id: 3n, value: 200n },
    { from: EMISOR, to: EVA, id: '3', value: '200' },
];

describe('saldosEnCorte', () => {
    it('reconstruye los saldos del activo y descarta los que quedan a cero', () => {
        const s = tree.saldosEnCorte(eventos(), 3);
        expect(Object.fromEntries(s)).toEqual({ [ANA]: 500n, [LUIS]: 300n, [EVA]: 200n });
    });

    it('falla si los eventos dejan un saldo negativo', () => {
        expect(() => tree.saldosEnCorte([{ from: ANA, to: LUIS, id: 3n, value: 1n }], 3))
            .toThrow(expect.objectContaining({ code: 'INCONSISTENT_EVENTS' }));
    });
});

describe('repartir', () => {
    const saldos = () => new Map([[ANA, 500n], [LUIS, 300n], [EVA, 200n]]);

    it('reparte a prorrata', () => {
        const r = tree.repartir(saldos(), 1000n);
        expect(Object.fromEntries(r.asignaciones.map((a) => [a.cuenta, a.importe])))
            .toEqual({ [ANA]: 500n, [LUIS]: 300n, [EVA]: 200n });
        expect(r.repartido).toBe(1000n);
        expect(r.resto).toBe(0n);
    });

    it('redondea hacia abajo y nunca reparte más de lo depositado', () => {
        const r = tree.repartir(new Map([[ANA, 1n], [LUIS, 1n], [EVA, 1n]]), 100n);
        expect(r.asignaciones.map((a) => a.importe)).toEqual([33n, 33n, 33n]);
        expect(r.repartido).toBe(99n);
        expect(r.resto).toBe(1n);
    });

    it('lo de un excluido se reparte entre los demás', () => {
        const r = tree.repartir(new Map([[EMISOR, 800n], [ANA, 150n], [LUIS, 50n]]), 1000n, { excluir: [EMISOR.toLowerCase()] });
        expect(Object.fromEntries(r.asignaciones.map((a) => [a.cuenta, a.importe]))).toEqual({ [ANA]: 750n, [LUIS]: 250n });
    });

    it('rechaza importe cero, reparto sin titulares e importes que no dan ni una unidad', () => {
        expect(() => tree.repartir(saldos(), 0n)).toThrow(expect.objectContaining({ code: 'INVALID_AMOUNT' }));
        expect(() => tree.repartir(new Map([[EMISOR, 5n]]), 10n, { excluir: [EMISOR] }))
            .toThrow(expect.objectContaining({ code: 'NO_HOLDERS' }));
        expect(() => tree.repartir(new Map([[ANA, 1n], [LUIS, 1n], [EVA, 1n]]), 2n))
            .toThrow(expect.objectContaining({ code: 'AMOUNT_TOO_SMALL' }));
    });
});

describe('construirArbol', () => {
    it('la hoja es la del contrato: doble keccak de abi.encode(cuenta, importe)', () => {
        const codificado = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [ANA, 500n]);
        expect(tree.hoja(ANA, 500n)).toBe(ethers.keccak256(ethers.keccak256(codificado)));
    });

    it('con un solo titular la raíz es su hoja y la prueba va vacía', () => {
        const { raiz, pruebas } = tree.construirArbol([{ cuenta: ANA, importe: 7n }]);
        expect(raiz).toBe(tree.hoja(ANA, 7n));
        expect(pruebas[ANA].prueba).toEqual([]);
    });

    it.each([2, 3, 5, 8, 13, 100])('con %i titulares todas las pruebas verifican contra la raíz', (n) => {
        const asignaciones = Array.from({ length: n }, (_, i) => ({
            cuenta: ethers.getAddress(ethers.zeroPadValue(ethers.toBeHex(i + 1), 20)), importe: BigInt(1000 + i),
        }));
        const { raiz, pruebas } = tree.construirArbol(asignaciones);
        for (const a of asignaciones) {
            const p = pruebas[a.cuenta];
            expect(tree.verificar(raiz, a.cuenta, p.importe, p.prueba)).toBe(true);
            // Ni otro importe ni otra cuenta pasan con la misma prueba.
            expect(tree.verificar(raiz, a.cuenta, BigInt(p.importe) + 1n, p.prueba)).toBe(false);
            expect(tree.verificar(raiz, dir('f'), p.importe, p.prueba)).toBe(false);
        }
    });

    it('la raíz no depende del orden de entrada', () => {
        const a = [{ cuenta: ANA, importe: 1n }, { cuenta: LUIS, importe: 2n }, { cuenta: EVA, importe: 3n }];
        expect(tree.construirArbol(a).raiz).toBe(tree.construirArbol([...a].reverse()).raiz);
    });

    it('rechaza cuentas repetidas y listas vacías', () => {
        expect(() => tree.construirArbol([{ cuenta: ANA, importe: 1n }, { cuenta: ANA.toLowerCase(), importe: 2n }]))
            .toThrow(expect.objectContaining({ code: 'DUPLICATE_ACCOUNT' }));
        expect(() => tree.construirArbol([])).toThrow(expect.objectContaining({ code: 'NO_HOLDERS' }));
    });
});

describe('calcularReparto', () => {
    it('va de los eventos a la raíz y las pruebas', () => {
        const r = tree.calcularReparto({ eventos: eventos(), assetId: 3, importe: ethers.parseEther('1000') });
        expect(r.titulares).toBe(3);
        expect(r.repartido).toBe(ethers.parseEther('1000').toString());
        expect(r.resto).toBe('0');
        expect(r.pruebas[ANA].importe).toBe(ethers.parseEther('500').toString());
        for (const [cuenta, p] of Object.entries(r.pruebas)) {
            expect(tree.verificar(r.raiz, cuenta, p.importe, p.prueba)).toBe(true);
        }
    });
});
