/**
 * txSimulator contra una cadena de verdad (Anvil): la simulación en fork tiene
 * que detectar un token que entrega menos de lo que se envía.
 *
 * Es lo que un eth_call no ve: `transfer` devuelve true y no revierte, pero el
 * destino recibe un 1 % menos. Firmar eso sería pagar de menos a un proveedor
 * (o, con un contrato hostil, algo peor). Se salta si Anvil no está instalado.
 */
const { execSync, spawn } = require('child_process');
const { ethers } = require('ethers');
const { simularEnFork, ERC20 } = require('../../services/txSimulator');
const fixture = require('../fixtures/token-prueba.json');

let anvilDisponible = true;
try { execSync('anvil --version', { stdio: 'ignore' }); } catch { anvilDisponible = false; }
const describeSi = anvilDisponible ? describe : describe.skip;

describeSi('txSimulator en fork (Anvil)', () => {
    const puerto = 18545 + Math.floor(Math.random() * 1000);
    const url = `http://127.0.0.1:${puerto}`;
    let anvil;
    let provider;
    let emisor;

    beforeAll(async () => {
        anvil = spawn('anvil', ['--port', String(puerto), '--silent'], { stdio: 'ignore' });
        provider = new ethers.JsonRpcProvider(url);
        for (let i = 0; i < 50; i += 1) {
            try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
        }
        // Primera cuenta por defecto de Anvil (clave pública y conocida de desarrollo).
        emisor = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);
    }, 20000);

    afterAll(() => { provider?.destroy(); anvil?.kill(); });

    async function desplegar(feeBps) {
        const f = new ethers.ContractFactory(fixture.abi, fixture.bytecode, emisor);
        const c = await f.deploy(feeBps, emisor.address);
        await c.waitForDeployment();
        return c.getAddress();
    }

    async function simular(token) {
        const destino = ethers.Wallet.createRandom().address;
        const cantidad = ethers.parseUnits('1000', 18);
        const tx = { to: token, data: ERC20.encodeFunctionData('transfer', [destino, cantidad]) };
        const r = await simularEnFork({ forkUrl: url, tx, desde: emisor.address, destino, cantidad });
        return { r, destino };
    }

    it('token normal: sin discrepancia y sin tocar el estado real', async () => {
        const token = await desplegar(0);
        const { r, destino } = await simular(token);
        expect(r.estado).toBe('ok');
        expect(r.discrepancia).toBe(false);
        expect(r.recibidoPorDestino).toBe(ethers.parseUnits('1000', 18).toString());
        // evm_revert: la simulación no dejó rastro.
        const saldo = ERC20.decodeFunctionResult('balanceOf', await provider.call({ to: token, data: ERC20.encodeFunctionData('balanceOf', [destino]) }))[0];
        expect(saldo).toBe(0n);
    });

    it('token con comisión por transferencia: DISCREPANCIA', async () => {
        const token = await desplegar(100); // 1 %
        const { r } = await simular(token);
        expect(r.estado).toBe('ok');
        expect(r.discrepancia).toBe(true);
        expect(r.recibidoPorDestino).toBe(ethers.parseUnits('990', 18).toString());
    });
});
