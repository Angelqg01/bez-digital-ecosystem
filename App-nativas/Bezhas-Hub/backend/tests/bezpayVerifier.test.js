/**
 * Tests del verificador on-chain de BezPay.
 *
 * Es la pieza que decide si un pago existió, así que se prueba contra recibos
 * fabricados a mano: transferencias al destinatario correcto, al incorrecto,
 * de menos, del token equivocado, y los casos reintentables.
 */

// ⚠️ El orden de este bloque importa. jest.config.js usa `transform: {}`, que
// desactiva babel-jest y con él el hoisting automático de jest.mock(): aquí
// las llamadas se ejecutan en el orden en que están escritas. Si se hiciera
// require('ethers') antes del jest.mock, se capturaría el módulo real y los
// tests fallarían todos como "RPC caído".

const mockProvider = {
  getTransactionReceipt: jest.fn(),
  getTransaction: jest.fn(),
  getBlockNumber: jest.fn(),
};

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    ethers: { ...actual.ethers, JsonRpcProvider: jest.fn() },
  };
});

const { ethers } = require('ethers');
const { verifyIncomingPayment, VerificationError } = require('../services/bezpayVerifier');

const TX = '0x' + 'ab'.repeat(32);
const PAYER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const TREASURY = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const FAKE_TOKEN = '0x9999999999999999999999999999999999999999';

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const pad = (addr) => '0x' + addr.slice(2).toLowerCase().padStart(64, '0');

/** Log de Transfer ERC-20 tal y como lo emite la cadena. */
function transferLog({ token, from = PAYER, to, amount }) {
  return {
    address: token,
    topics: [TRANSFER_TOPIC, pad(from), pad(to)],
    data: ethers.zeroPadValue(ethers.toBeHex(amount), 32),
  };
}

function setChain({ receipt, tx, head = 110 }) {
  mockProvider.getTransactionReceipt.mockResolvedValue(receipt);
  mockProvider.getTransaction.mockResolvedValue(tx);
  mockProvider.getBlockNumber.mockResolvedValue(head);
}

const erc20Args = {
  txHash: TX, chainId: 137, payer: PAYER, recipient: TREASURY,
  tokenAddress: USDT, minAmountWei: 100_000_000n,   // 100 USDT
};

// jest.config.js tiene `resetMocks: true`, así que antes de cada test Jest
// vacía la implementación de TODOS los mocks — incluida la de la factoría
// JsonRpcProvider creada en jest.mock(). Si no se reinstala aquí, `new
// JsonRpcProvider()` devuelve un objeto pelado y cada caso falla como
// "RPC_UNAVAILABLE" en vez de por lo que el test quería comprobar.
//
// Se copia sobre `this` en lugar de devolver el objeto porque un jest.fn()
// invocado con `new` descarta su valor de retorno.
beforeEach(() => {
  ethers.JsonRpcProvider.mockImplementation(function () {
    Object.assign(this, mockProvider);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('pagos ERC-20', () => {
  it('acepta una transferencia correcta al Treasury', async () => {
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX,
        logs: [transferLog({ token: USDT, to: TREASURY, amount: 100_000_000n })] },
      tx: { from: PAYER, to: USDT, value: 0n },
    });

    const proof = await verifyIncomingPayment(erc20Args);
    expect(proof.paidWei).toBe(100_000_000n);
    expect(proof.payer).toBe(PAYER);
    expect(proof.blockNumber).toBe(100);
  });

  it('acepta pagar de más', async () => {
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX,
        logs: [transferLog({ token: USDT, to: TREASURY, amount: 150_000_000n })] },
      tx: { from: PAYER, to: USDT, value: 0n },
    });
    await expect(verifyIncomingPayment(erc20Args)).resolves.toMatchObject({ paidWei: 150_000_000n });
  });

  it('suma varias transferencias al Treasury en la misma TX', async () => {
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX, logs: [
        transferLog({ token: USDT, to: TREASURY, amount: 60_000_000n }),
        transferLog({ token: USDT, to: TREASURY, amount: 40_000_000n }),
      ] },
      tx: { from: PAYER, to: USDT, value: 0n },
    });
    await expect(verifyIncomingPayment(erc20Args)).resolves.toMatchObject({ paidWei: 100_000_000n });
  });

  it('rechaza pagar de menos', async () => {
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX,
        logs: [transferLog({ token: USDT, to: TREASURY, amount: 99_999_999n })] },
      tx: { from: PAYER, to: USDT, value: 0n },
    });
    await expect(verifyIncomingPayment(erc20Args)).rejects.toMatchObject({ code: 'UNDERPAID' });
  });

  it('rechaza una transferencia a otra dirección', async () => {
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX,
        logs: [transferLog({ token: USDT, to: OTHER, amount: 100_000_000n })] },
      tx: { from: PAYER, to: USDT, value: 0n },
    });
    await expect(verifyIncomingPayment(erc20Args)).rejects.toMatchObject({ code: 'WRONG_RECIPIENT' });
  });

  it('ignora los Transfer de un token falso con el mismo importe', async () => {
    // Un token cualquiera puede emitir Transfer(100 USDT→Treasury) gratis.
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX,
        logs: [transferLog({ token: FAKE_TOKEN, to: TREASURY, amount: 999_000_000n })] },
      tx: { from: PAYER, to: FAKE_TOKEN, value: 0n },
    });
    await expect(verifyIncomingPayment(erc20Args)).rejects.toMatchObject({ code: 'WRONG_RECIPIENT' });
  });

  it('rechaza si la TX la firmó otra wallet', async () => {
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX,
        logs: [transferLog({ token: USDT, to: TREASURY, amount: 100_000_000n })] },
      tx: { from: OTHER, to: USDT, value: 0n },
    });
    await expect(verifyIncomingPayment(erc20Args)).rejects.toMatchObject({ code: 'WRONG_PAYER' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('pagos nativos', () => {
  const nativeArgs = {
    txHash: TX, chainId: 137, payer: PAYER, recipient: TREASURY,
    tokenAddress: null, minAmountWei: ethers.parseEther('10'),
  };

  it('acepta un envío al Treasury por el importe pedido', async () => {
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX, logs: [] },
      tx: { from: PAYER, to: TREASURY, value: ethers.parseEther('10') },
    });
    await expect(verifyIncomingPayment(nativeArgs)).resolves.toMatchObject({ payer: PAYER });
  });

  it('rechaza si fue a otra dirección', async () => {
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX, logs: [] },
      tx: { from: PAYER, to: OTHER, value: ethers.parseEther('10') },
    });
    await expect(verifyIncomingPayment(nativeArgs)).rejects.toMatchObject({ code: 'WRONG_RECIPIENT' });
  });

  it('rechaza si envió de menos', async () => {
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX, logs: [] },
      tx: { from: PAYER, to: TREASURY, value: ethers.parseEther('9.99') },
    });
    await expect(verifyIncomingPayment(nativeArgs)).rejects.toMatchObject({ code: 'UNDERPAID' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('estado de la TX', () => {
  it('TX revertida → TX_REVERTED, no reintentable', async () => {
    setChain({
      receipt: { status: 0, blockNumber: 100, hash: TX, logs: [] },
      tx: { from: PAYER, to: TREASURY, value: 0n },
    });
    await expect(verifyIncomingPayment(erc20Args)).rejects.toMatchObject({
      code: 'TX_REVERTED', retryable: false,
    });
  });

  it('TX aún sin minar → reintentable', async () => {
    setChain({ receipt: null, tx: null });
    await expect(verifyIncomingPayment(erc20Args)).rejects.toMatchObject({
      code: 'TX_NOT_FOUND', retryable: true,
    });
  });

  it('pocas confirmaciones → reintentable', async () => {
    setChain({
      receipt: { status: 1, blockNumber: 100, hash: TX,
        logs: [transferLog({ token: USDT, to: TREASURY, amount: 100_000_000n })] },
      tx: { from: PAYER, to: USDT, value: 0n },
      head: 100,   // 1 confirmación, hacen falta 3
    });
    await expect(verifyIncomingPayment(erc20Args)).rejects.toMatchObject({
      code: 'INSUFFICIENT_CONFIRMATIONS', retryable: true,
    });
  });

  it('RPC caído → reintentable, jamás aceptado', async () => {
    mockProvider.getTransactionReceipt.mockRejectedValue(new Error('ECONNREFUSED'));
    mockProvider.getTransaction.mockRejectedValue(new Error('ECONNREFUSED'));
    mockProvider.getBlockNumber.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(verifyIncomingPayment(erc20Args)).rejects.toMatchObject({
      code: 'RPC_UNAVAILABLE', retryable: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('entradas inválidas', () => {
  it('txHash malformado', async () => {
    await expect(verifyIncomingPayment({ ...erc20Args, txHash: '0x123' }))
      .rejects.toMatchObject({ code: 'BAD_TXHASH' });
  });

  it('sin importe esperado no se verifica nada', async () => {
    await expect(verifyIncomingPayment({ ...erc20Args, minAmountWei: 0n }))
      .rejects.toMatchObject({ code: 'NO_EXPECTED_AMOUNT' });
  });

  it('cadena no soportada', async () => {
    await expect(verifyIncomingPayment({ ...erc20Args, chainId: 42161 }))
      .rejects.toMatchObject({ code: 'CHAIN_UNSUPPORTED' });
  });
});
