/**
 * Unit tests del BeZhas_ID único: formato del id, hash de email, y la lógica de
 * resolución/fusión (email + wallet + OAuth → 1 identidad). Sin BD (DI).
 */
const Identity = require('../../models/pg/Identity');
const { createIdentityService } = require('../../services/identity.service');

describe('Identity — generación y hashing', () => {
  test('genera BeZhas_ID con formato BZ-XXXXXXXXXX (sin I,L,O,U)', () => {
    const id = Identity.generateBezhasId();
    expect(id).toMatch(/^BZ-[0-9A-HJKMNP-TV-Z]{10}$/);
  });
  test('IDs distintos en llamadas sucesivas', () => {
    const a = Identity.generateBezhasId();
    const b = Identity.generateBezhasId();
    expect(a).not.toBe(b);
  });
  test('hashEmail normaliza (trim + minúsculas) y es estable', () => {
    expect(Identity.hashEmail('  User@BeZhas.com ')).toBe(Identity.hashEmail('user@bezhas.com'));
    expect(Identity.hashEmail(null)).toBeNull();
  });
});

describe('identity.service.resolveOrCreate', () => {
  function build(overrides = {}) {
    const Mock = {
      hashEmail: Identity.hashEmail,
      findByWallet: jest.fn().mockResolvedValue(null),
      findByEmailHash: jest.fn().mockResolvedValue(null),
      findByUserId: jest.fn().mockResolvedValue(null),
      link: jest.fn(async (id, f) => ({ bezhas_id: id, ...f })),
      create: jest.fn(async (d) => ({ bezhas_id: 'BZ-NEW0000001', ...d })),
      ...overrides,
    };
    return { svc: createIdentityService({ Identity: Mock }), Mock };
  }

  test('sin identificadores → error NO_IDENTIFIER', async () => {
    const { svc } = build();
    await expect(svc.resolveOrCreate({})).rejects.toMatchObject({ code: 'NO_IDENTIFIER' });
  });

  test('actor nuevo por wallet → crea identidad', async () => {
    const { svc, Mock } = build();
    const r = await svc.resolveOrCreate({ wallet: '0xABC' });
    expect(r.created).toBe(true);
    expect(r.bezhasId).toBe('BZ-NEW0000001');
    expect(Mock.create).toHaveBeenCalledTimes(1);
  });

  test('wallet ya existente → reutiliza la misma identidad (no crea)', async () => {
    const existing = { bezhas_id: 'BZ-EXISTING01', wallet_address: '0xabc', email_hash: null };
    const { svc, Mock } = build({ findByWallet: jest.fn().mockResolvedValue(existing) });
    const r = await svc.resolveOrCreate({ wallet: '0xABC' });
    expect(r.created).toBe(false);
    expect(r.bezhasId).toBe('BZ-EXISTING01');
    expect(Mock.create).not.toHaveBeenCalled();
  });

  test('FUSIÓN: usuario de email que conecta wallet → misma identidad + link', async () => {
    const emailIdentity = { bezhas_id: 'BZ-EMAILUSER1', email_hash: Identity.hashEmail('a@b.com'), wallet_address: null };
    const { svc, Mock } = build({
      findByWallet: jest.fn().mockResolvedValue(null),       // la wallet aún no existe
      findByEmailHash: jest.fn().mockResolvedValue(emailIdentity),
    });
    const r = await svc.resolveOrCreate({ email: 'a@b.com', wallet: '0xNEW' });
    expect(r.created).toBe(false);
    expect(r.merged).toBe(true);
    expect(r.bezhasId).toBe('BZ-EMAILUSER1');
    expect(Mock.link).toHaveBeenCalledWith('BZ-EMAILUSER1', expect.objectContaining({ walletAddress: '0xNEW' }));
  });

  test('identidad ya completa → no re-linka (merged=false)', async () => {
    const full = { bezhas_id: 'BZ-FULL000001', email_hash: Identity.hashEmail('a@b.com'), wallet_address: '0xabc', user_id: 'u1' };
    const { svc, Mock } = build({ findByWallet: jest.fn().mockResolvedValue(full) });
    const r = await svc.resolveOrCreate({ email: 'a@b.com', wallet: '0xABC', userId: 'u1' });
    expect(r.merged).toBe(false);
    expect(Mock.link).not.toHaveBeenCalled();
  });

  test('precedencia: wallet gana sobre email al resolver', async () => {
    const byWallet = { bezhas_id: 'BZ-WALLET0001', wallet_address: '0xabc' };
    const byEmail = { bezhas_id: 'BZ-EMAIL00001', email_hash: 'x' };
    const { svc, Mock } = build({
      findByWallet: jest.fn().mockResolvedValue(byWallet),
      findByEmailHash: jest.fn().mockResolvedValue(byEmail),
    });
    const r = await svc.resolveOrCreate({ email: 'a@b.com', wallet: '0xABC' });
    expect(r.bezhasId).toBe('BZ-WALLET0001');
    expect(Mock.findByEmailHash).not.toHaveBeenCalled(); // ni siquiera consulta por email
  });
});
