/**
 * BeZhas_ID canónico — formato único de identidad del ecosistema.
 * Ver api/lib/bezhasId.js (espejo en Bezhas-Hub/backend/lib/bezhasId.js).
 */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const bezhasId = require('../lib/bezhasId');
const {
    generateBezhasId,
    isValidBezhasId,
    isLegacyBezhasId,
    normalizeBezhasId,
    legacyToCanonical,
    toCanonical,
    ALPHABET,
} = bezhasId;

const LEGACY_SAMPLE = 'BEZ-A3F8C012-9E4B7D56';

describe('generateBezhasId', () => {
    it('emite el formato canónico BZ- + 10 chars', () => {
        for (let i = 0; i < 200; i++) {
            expect(isValidBezhasId(generateBezhasId())).toBe(true);
        }
    });

    it('nunca usa los caracteres ambiguos I, L, O ni U', () => {
        // Son el motivo de elegir Crockford: se confunden con 1, 0 y V al
        // dictar un ID por teléfono o transcribirlo de un albarán.
        const ids = Array.from({ length: 500 }, () => generateBezhasId()).join('');
        expect(ids).not.toMatch(/[ILOU]/);
        expect(ALPHABET).toHaveLength(32);
    });

    it('no repite ids en un lote grande', () => {
        const ids = new Set(Array.from({ length: 5000 }, generateBezhasId));
        expect(ids.size).toBe(5000);
    });
});

describe('validación', () => {
    it('acepta el canónico y rechaza el legacy', () => {
        expect(isValidBezhasId('BZ-K4R7M2X9PQ')).toBe(true);
        expect(isValidBezhasId(LEGACY_SAMPLE)).toBe(false);
    });

    it('rechaza ids con caracteres ambiguos o longitud incorrecta', () => {
        expect(isValidBezhasId('BZ-K4R7M2X9PI')).toBe(false); // contiene I
        expect(isValidBezhasId('BZ-K4R7M2X9P')).toBe(false);  // 9 chars
        expect(isValidBezhasId('BZ-K4R7M2X9PQR')).toBe(false); // 11 chars
        expect(isValidBezhasId('K4R7M2X9PQ')).toBe(false);    // sin prefijo
        expect(isValidBezhasId(null)).toBe(false);
        expect(isValidBezhasId(12345)).toBe(false);
    });

    it('reconoce el formato legacy en ambas cajas', () => {
        expect(isLegacyBezhasId(LEGACY_SAMPLE)).toBe(true);
        expect(isLegacyBezhasId(LEGACY_SAMPLE.toLowerCase())).toBe(true);
        expect(isLegacyBezhasId('BEZ-XYZ')).toBe(false);
    });
});

describe('normalizeBezhasId', () => {
    it('corrige las sustituciones Crockford de un id tecleado a mano', () => {
        // O→0, I→1, L→1, U→V: es justo lo que un humano teclea mal.
        expect(normalizeBezhasId('bz-k4r7m2x9pq')).toBe('BZ-K4R7M2X9PQ');
        expect(normalizeBezhasId('BZ-O4R7M2X9PQ')).toBe('BZ-04R7M2X9PQ');
        expect(normalizeBezhasId('BZ-I4R7M2X9PQ')).toBe('BZ-14R7M2X9PQ');
        expect(normalizeBezhasId('BZ-L4R7M2X9PQ')).toBe('BZ-14R7M2X9PQ');
        expect(normalizeBezhasId('BZ-U4R7M2X9PQ')).toBe('BZ-V4R7M2X9PQ');
    });

    it('tolera el prefijo implícito y los espacios', () => {
        expect(normalizeBezhasId('  K4R7M2X9PQ ')).toBe('BZ-K4R7M2X9PQ');
    });

    it('devuelve null si no hay forma de que sea válido', () => {
        expect(normalizeBezhasId('demasiado-corto')).toBeNull();
        expect(normalizeBezhasId(undefined)).toBeNull();
    });
});

describe('legacyToCanonical', () => {
    it('es determinista: el mismo legacy da siempre el mismo canónico', () => {
        // De esto depende que la migración 033 sea idempotente y que un
        // BEZ-… impreso en un documento antiguo se pueda seguir resolviendo.
        const first = legacyToCanonical(LEGACY_SAMPLE);
        for (let i = 0; i < 10; i++) {
            expect(legacyToCanonical(LEGACY_SAMPLE)).toBe(first);
        }
    });

    it('produce un id que valida como canónico', () => {
        expect(isValidBezhasId(legacyToCanonical(LEGACY_SAMPLE))).toBe(true);
    });

    it('coincide con la fórmula SQL de la migración 033', () => {
        // SQL: 'BZ-' || upper(substr(encode(sha256(convert_to(id,'UTF8')),'hex'),1,10))
        // Si esta expectativa cae, la migración y el código JS han divergido y
        // los ids convertidos en BD dejarían de resolver desde la aplicación.
        const expected = 'BZ-' + crypto.createHash('sha256')
            .update(LEGACY_SAMPLE, 'utf8').digest('hex').slice(0, 10).toUpperCase();
        expect(legacyToCanonical(LEGACY_SAMPLE)).toBe(expected);
    });

    it('no convierte ids que no sean legacy', () => {
        expect(legacyToCanonical('BZ-K4R7M2X9PQ')).toBeNull();
        expect(legacyToCanonical('cualquier cosa')).toBeNull();
    });

    it('los 10 primeros chars hex siempre caen dentro del alfabeto Crockford', () => {
        for (let i = 0; i < 300; i++) {
            const legacy = 'BEZ-' + crypto.randomBytes(4).toString('hex').toUpperCase()
                + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
            expect(isValidBezhasId(legacyToCanonical(legacy))).toBe(true);
        }
    });
});

describe('toCanonical', () => {
    it('deja pasar el canónico sin tocarlo', () => {
        expect(toCanonical('BZ-K4R7M2X9PQ')).toBe('BZ-K4R7M2X9PQ');
    });

    it('convierte el legacy', () => {
        expect(toCanonical(LEGACY_SAMPLE)).toBe(legacyToCanonical(LEGACY_SAMPLE));
    });

    it('normaliza lo que se pueda y devuelve null para el resto', () => {
        expect(toCanonical('bz-k4r7m2x9pq')).toBe('BZ-K4R7M2X9PQ');
        expect(toCanonical('nada')).toBeNull();
    });
});

describe('espejo Hub ↔ API core', () => {
    it('los dos servicios comparten byte a byte el módulo canónico', () => {
        // Están duplicados a propósito (cada servicio se empaqueta aparte), así
        // que este test es lo único que impide que se separen en silencio.
        const mirror = path.join(
            __dirname, '..', '..', "App's secundarias", 'Bezhas-Hub', 'backend', 'lib', 'bezhasId.js',
        );
        if (!fs.existsSync(mirror)) {
            throw new Error(`No se encuentra el espejo del Hub en ${mirror}`);
        }
        const here = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bezhasId.js'), 'utf8');
        expect(fs.readFileSync(mirror, 'utf8')).toBe(here);
    });
});
