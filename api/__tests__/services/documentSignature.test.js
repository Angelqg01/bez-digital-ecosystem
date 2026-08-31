'use strict';

/**
 * Firma digital de documentos (TX008 del piloto de Algeciras, criticidad máxima).
 *
 * La prueba que importa aquí no es "¿verifica la firma?" —eso ya lo hacía—
 * sino "¿verifica que la firma es de ESTE documento?". Antes el `messageHash`
 * llegaba en el cuerpo de la petición y sólo se comprobaba que la firma
 * correspondiera a ese hash: bastaba firmar cualquier mensaje propio y
 * presentarlo como firma de un documento ajeno. La firma era
 * criptográficamente válida y semánticamente vacía.
 */

jest.mock('../../db/pool', () => ({ query: jest.fn() }));
jest.mock('../../cache/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDelete: jest.fn().mockResolvedValue(undefined),
}));

const { ethers } = require('ethers');
const { query } = require('../../db/pool');
const { addSignature, signingMessage } = require('../../services/documentService');

const DOC_ID = '11111111-2222-3333-4444-555555555555';
const OTRO_DOC = '99999999-8888-7777-6666-555555555555';
const FILE_HASH = '0x' + 'ab'.repeat(32);

const firmante = ethers.Wallet.createRandom();

function seedDocumento(status = 'approved') {
  query.mockReset();
  query.mockResolvedValueOnce({
    rows: [{ id: DOC_ID, file_hash: FILE_HASH, status }],
    rowCount: 1,
  });
}

describe('addSignature — la firma queda atada al documento', () => {
  it('acepta una firma del mensaje canónico de ESTE documento', async () => {
    seedDocumento();
    query.mockResolvedValueOnce({
      rows: [{ id: 1, signer_address: firmante.address, signed_at: new Date().toISOString() }],
      rowCount: 1,
    });

    const sig = await firmante.signMessage(signingMessage(DOC_ID, FILE_HASH));
    const res = await addSignature(DOC_ID, firmante.address, sig, null, null);

    expect(res.success).toBe(true);
  });

  it('RECHAZA una firma válida hecha sobre otro mensaje (signature misuse)', async () => {
    seedDocumento();

    // El atacante firma algo suyo, perfectamente válido...
    const sig = await firmante.signMessage('cualquier cosa que yo quiera firmar');
    // ...y lo presenta como firma de este documento.
    const res = await addSignature(DOC_ID, firmante.address, sig, null, null);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/does not match signer address/);
  });

  it('RECHAZA reutilizar la firma de un documento en otro', async () => {
    seedDocumento();

    // Firma legítima del documento OTRO_DOC...
    const sig = await firmante.signMessage(signingMessage(OTRO_DOC, FILE_HASH));
    // ...presentada como firma de DOC_ID, aunque el fichero sea idéntico.
    const res = await addSignature(DOC_ID, firmante.address, sig, null, null);

    expect(res.success).toBe(false);
  });

  it('RECHAZA un messageHash que no corresponde al documento', async () => {
    seedDocumento();

    const sig = await firmante.signMessage(signingMessage(DOC_ID, FILE_HASH));
    const hashInventado = ethers.hashMessage('otra cosa');
    const res = await addSignature(DOC_ID, firmante.address, sig, hashInventado, null);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/does not correspond to this document/);
    // Se devuelve el hash correcto para que un cliente honesto pueda corregir.
    expect(res.expectedMessageHash).toBeDefined();
  });

  it('no se puede firmar un documento revocado', async () => {
    seedDocumento('revoked');

    const sig = await firmante.signMessage(signingMessage(DOC_ID, FILE_HASH));
    const res = await addSignature(DOC_ID, firmante.address, sig, null, null);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/revoked/);
  });

  it('no se puede firmar un documento que no existe', async () => {
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const sig = await firmante.signMessage(signingMessage(DOC_ID, FILE_HASH));
    const res = await addSignature(DOC_ID, firmante.address, sig, null, null);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not found/);
  });
});
