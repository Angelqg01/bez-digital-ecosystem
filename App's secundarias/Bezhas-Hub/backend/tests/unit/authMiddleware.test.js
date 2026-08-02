/**
 * requireAuth / protect — la identidad SIEMPRE sale de un JWT firmado.
 *
 * Regresión que cubre este archivo: `requireAuth` autenticaba con la cabecera
 * `X-Wallet-Address`. Como las direcciones son públicas (están en el explorador
 * de bloques) y `admin.users.routes.js` monta `requireAuth, requireAdmin`,
 * bastaba con enviar la dirección de un admin para listar toda la base de
 * usuarios, banear cuentas o cambiar contraseñas.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_auth_middleware';

const jwt = require('jsonwebtoken');

jest.mock('../../models/pg/User', () => ({
  findById: jest.fn(),
  findByWallet: jest.fn(),
}));

// El middleware sólo usa mongoose para fabricar un ObjectId en el bypass de
// desarrollo. Cargar el driver real aquí no aporta nada y arrastra toda la
// dependencia de mongodb.
jest.mock('mongoose', () => ({
  Types: { ObjectId: function ObjectId() { return 'mock-object-id'; } },
}));

const User = require('../../models/pg/User');
const { requireAuth, protect } = require('../../middleware/auth.middleware');
const { JWT_SECRET } = require('../../config/authSecrets');

const VICTIM_WALLET = '0xAdm1n0000000000000000000000000000000001';
const ATTACKER_WALLET = '0xBadBad0000000000000000000000000000000002';

function makeUser(overrides = {}) {
  return {
    _id: 'user-1',
    walletAddress: VICTIM_WALLET,
    username: 'admin',
    roles: ['ADMIN'],
    role: 'ADMIN',
    isVerified: true,
    isVIP: true,
    subscription: 'PREMIUM',
    vipTier: 'platinum',
    isBanned: false,
    save: jest.fn(),
    ...overrides,
  };
}

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function tokenFor(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '1h' });
}

beforeEach(() => {
  jest.clearAllMocks();
  // `select('-password')` encadenado, como hace el modelo real.
  User.findById.mockReturnValue({ select: () => Promise.resolve(makeUser()) });
});

describe('requireAuth — la cabecera ya no autentica', () => {
  it('rechaza una petición que SÓLO trae X-Wallet-Address', async () => {
    // El ataque original: dirección de admin, cero pruebas de poseerla.
    const req = { headers: { 'x-wallet-address': VICTIM_WALLET }, body: {} };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    // Y no debe ni consultar al usuario por wallet: esa vía ya no existe.
    expect(User.findByWallet).not.toHaveBeenCalled();
  });

  it('rechaza si no hay ninguna credencial', async () => {
    const req = { headers: {}, body: {} };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const forged = jwt.sign({ id: 'user-1' }, 'otro-secreto-cualquiera');
    const req = { headers: { authorization: `Bearer ${forged}` }, body: {} };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rechaza un token caducado', async () => {
    const expired = jwt.sign({ id: 'user-1' }, JWT_SECRET, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${expired}` }, body: {} };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar un JWT válido y adjunta el usuario', async () => {
    const req = { headers: { authorization: `Bearer ${tokenFor('user-1')}` }, body: {} };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user.walletAddress).toBe(VICTIM_WALLET);
  });

  it('acepta el JWT aunque venga acompañado de su propia cabecera', async () => {
    // El interceptor del frontend manda siempre x-wallet-address; coincidir no
    // debe estorbar.
    const req = {
      headers: { authorization: `Bearer ${tokenFor('user-1')}`, 'x-wallet-address': VICTIM_WALLET },
      body: {},
    };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rechaza con 403 si la cabecera contradice al token', async () => {
    // Sesión cruzada o intento de actuar en nombre de otro: no se ignora, se corta.
    const req = {
      headers: { authorization: `Bearer ${tokenFor('user-1')}`, 'x-wallet-address': ATTACKER_WALLET },
      body: {},
    };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rechaza también si la contradicción viene en el body', async () => {
    const req = {
      headers: { authorization: `Bearer ${tokenFor('user-1')}` },
      body: { walletAddress: ATTACKER_WALLET },
    };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('compara la wallet sin distinguir mayúsculas', async () => {
    const req = {
      headers: {
        authorization: `Bearer ${tokenFor('user-1')}`,
        'x-wallet-address': VICTIM_WALLET.toLowerCase(),
      },
      body: {},
    };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rechaza si el usuario del token ya no existe', async () => {
    User.findById.mockReturnValue({ select: () => Promise.resolve(null) });
    const req = { headers: { authorization: `Bearer ${tokenFor('borrado')}` }, body: {} };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('sigue bloqueando cuentas baneadas', async () => {
    User.findById.mockReturnValue({
      select: () => Promise.resolve(makeUser({ isBanned: true, walletAddress: ATTACKER_WALLET })),
    });
    const req = { headers: { authorization: `Bearer ${tokenFor('user-1')}` }, body: {} };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('protect', () => {
  it('deja pasar un JWT válido', async () => {
    const req = { headers: { authorization: `Bearer ${tokenFor('user-1')}` } };
    const res = makeRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.username).toBe('admin');
  });

  it('devuelve 401 sin cabecera Authorization', async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('devuelve 401, no 500, cuando la petición no trae req.log', async () => {
    // Regresión: el catch llamaba a req.log.error sin comprobar que existiera,
    // así que un token inválido en una ruta montada antes del logger explotaba
    // en TypeError y la petición se quedaba colgada.
    const req = { headers: { authorization: 'Bearer token-basura' } };
    const res = makeRes();
    const next = jest.fn();

    await expect(protect(req, res, next)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('sólo responde una vez', async () => {
    const req = { headers: {} };
    const res = makeRes();

    await protect(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledTimes(1);
  });
});
