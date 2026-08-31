/**
 * operantAnchor — la parte criptográfica del anclaje de auditoría.
 *
 * El esquema merkle está escrito TRES veces: aquí, en OPERANT
 * (src/platform/auditMerkle.js) y en Solidity (TelemetryAnchor.verify). Si una
 * de las tres deriva, las pruebas de inclusión dejan de validar on-chain sin
 * que nada avise. Estos tests fijan el esquema: sha256 con pares ORDENADOS y
 * duplicado del último nodo en niveles impares.
 */
const crypto = require('crypto');
const { merkleRoot, merkleProof, toLeaf, anchorKey } = require('../../services/operantAnchor');

const h = (n) => crypto.createHash('sha256').update(String(n)).digest('hex');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest();

/** Verificación independiente, igual que la hace el contrato. */
function verifyLikeSolidity(leaf, proof, root) {
    let acc = leaf;
    for (const sibling of proof) {
        acc = Buffer.compare(acc, sibling) <= 0
            ? sha(Buffer.concat([acc, sibling]))
            : sha(Buffer.concat([sibling, acc]));
    }
    return Buffer.compare(acc, root) === 0;
}

describe('operantAnchor — merkle', () => {
    test('rechaza un hash que no es sha256 hex de 64', () => {
        expect(() => toLeaf('no-soy-un-hash')).toThrow(/inválido/);
        expect(() => toLeaf(h('x').slice(0, 40))).toThrow(/inválido/);
    });

    test('acepta el hash con y sin prefijo 0x', () => {
        const raw = h('a');
        expect(toLeaf(raw)).toEqual(toLeaf('0x' + raw));
    });

    test('un tramo vacío no tiene raíz (no se ancla la nada)', () => {
        expect(merkleRoot([])).toBeNull();
    });

    test.each([1, 2, 3, 4, 5, 7, 8, 16, 33])(
        'toda hoja de un tramo de %i se demuestra contra la raíz',
        (n) => {
            const leaves = Array.from({ length: n }, (_, i) => toLeaf(h(`r${i}`)));
            const root = merkleRoot(leaves);
            for (let i = 0; i < n; i++) {
                expect(verifyLikeSolidity(leaves[i], merkleProof(leaves, i), root)).toBe(true);
            }
        }
    );

    test('una hoja ajena al tramo no se puede demostrar', () => {
        const leaves = Array.from({ length: 6 }, (_, i) => toLeaf(h(`r${i}`)));
        const root = merkleRoot(leaves);
        const intrusa = toLeaf(h('no-estaba'));
        expect(verifyLikeSolidity(intrusa, merkleProof(leaves, 2), root)).toBe(false);
    });

    test('alterar un solo registro cambia la raíz: la manipulación se ve', () => {
        const original = Array.from({ length: 5 }, (_, i) => toLeaf(h(`r${i}`)));
        const alterado = original.slice();
        alterado[3] = toLeaf(h('r3-reescrito'));
        expect(merkleRoot(original)).not.toEqual(merkleRoot(alterado));
    });

    test('la raíz es determinista: el mismo tramo da siempre el mismo número', () => {
        const build = () => Array.from({ length: 9 }, (_, i) => toLeaf(h(`r${i}`)));
        expect(merkleRoot(build())).toEqual(merkleRoot(build()));
    });

    test('la clave on-chain lleva prefijo para no chocar con los B-UID de CargoLink', () => {
        expect(anchorKey('bez-abc123')).toBe('operant:bez-abc123');
    });
});
