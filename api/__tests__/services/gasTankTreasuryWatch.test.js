const { ethers } = require('ethers');
const { createWatch, loadTargets } = require('../../services/gasTank/treasuryWatch');

const ADDR = '0x52Df82920CBAE522880dD7657e43d1A754eD044E';
const mk = (balances, env = {}, clock = { t: 1_000_000 }) => {
    const sendMail = jest.fn().mockResolvedValue({ sent: true });
    const getProvider = () => ({ getBalance: async (a) => { const b = balances[a]; if (b instanceof Error) throw b; return ethers.parseEther(String(b)); } });
    const w = createWatch({
        env: { GAS_TREASURY_WATCH: JSON.stringify([{ label: 'operador', address: ADDR, minNative: 5 }]), GAS_TREASURY_ALERT_EMAIL: 'ops@bezhas.test', ...env },
        getProvider, sendMail, now: () => clock.t,
    });
    return { w, sendMail, clock };
};

describe('treasuryWatch', () => {
    test('saldo suficiente: sin aviso', async () => {
        const { w, sendMail } = mk({ [ADDR]: 20 });
        const [r] = await w.check();
        expect(r).toMatchObject({ label: 'operador', balanceNative: 20, low: false });
        expect(sendMail).not.toHaveBeenCalled();
    });

    test('saldo bajo: avisa una vez y no repite dentro del cooldown, sí después', async () => {
        const { w, sendMail, clock } = mk({ [ADDR]: 1 });
        await w.check(); await w.check();
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'ops@bezhas.test', subject: expect.stringContaining('operador') });
        clock.t += 7 * 3600 * 1000;
        await w.check();
        expect(sendMail).toHaveBeenCalledTimes(2);
    });

    test('nunca transfiere: el proveedor sólo expone getBalance', async () => {
        const { w } = mk({ [ADDR]: 0 });
        await expect(w.check()).resolves.toHaveLength(1);
    });

    test('un error de RPC se registra en la lectura y no tumba el barrido ni avisa', async () => {
        const { w, sendMail } = mk({ [ADDR]: new Error('rpc caído') });
        const [r] = await w.check();
        expect(r.error).toBe('rpc caído');
        expect(sendMail).not.toHaveBeenCalled();
    });

    test('sin GAS_TREASURY_WATCH vigila la dirección derivada de DEPLOYER_PRIVATE_KEY, sin exponer la clave', () => {
        const key = ethers.Wallet.createRandom().privateKey;
        const t = loadTargets({ DEPLOYER_PRIVATE_KEY: key });
        expect(t).toEqual([{ label: 'operador-api', address: new ethers.Wallet(key).address, minNative: 5 }]);
        expect(JSON.stringify(t)).not.toContain(key.slice(2));
        expect(loadTargets({})).toEqual([]);
    });

    test('configuración inválida falla en claro', () => {
        expect(() => loadTargets({ GAS_TREASURY_WATCH: '{' })).toThrow(/JSON/);
        expect(() => loadTargets({ GAS_TREASURY_WATCH: '[{"label":"x","address":"nope"}]' })).toThrow(/no válida/);
    });
});
