'use strict';

/**
 * Integración con MarketplaceSettlement.sol (paso 5): pago en BEZ sin custodia.
 *
 *   registrarListing()  el admin da de alta en el contrato un listing ya aprobado, con la cuenta
 *                       de cobro del proveedor (marketplace_providers.payout_address) y su precio
 *                       en BEZ. Lo envía la wallet REGISTRAR, que no tiene acceso a fondos.
 *   verificarPago()     el consumidor paga desde su wallet y manda el txHash; aquí se lee el
 *                       recibo en Polygon, se exige el evento Paid del contrato correcto, del
 *                       listing correcto y con confirmaciones suficientes.
 *
 * Config: POLYGON_RPC_URL, MARKETPLACE_SETTLEMENT_ADDRESS (o deployments/137.json), MARKETPLACE_REGISTRAR_KEY (sólo para
 * registrar) y MARKETPLACE_MIN_CONFIRMATIONS (por defecto 30 bloques, ~1 min en Polygon).
 */

const { ethers } = require('ethers');

const CHAIN_ID = 137;
const ABI = [
    'function registerListing(bytes32 listingId, address provider, uint128 price)',
    'function setListingActive(bytes32 listingId, bool active)',
    'function listings(bytes32) view returns (address provider, uint128 price, bool active)',
    'function balanceOf(address) view returns (uint256)',
    'function treasury() view returns (address)',
    'function feeBps() view returns (uint16)',
    'event Paid(bytes32 indexed purchaseId, bytes32 indexed listingId, address indexed payer, address provider, uint256 price, uint256 fee)',
];
const iface = new ethers.Interface(ABI);

class SettlementError extends Error {
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

function desplegada() {
    try {
        const d = JSON.parse(require('fs').readFileSync(
            require('path').resolve(__dirname, '../../../smart-contracts/deployments/137.json'), 'utf8'));
        return d?.marketplace?.MarketplaceSettlement || null;
    } catch {
        return null;
    }
}

/** MARKETPLACE_SETTLEMENT_ADDRESS o, si no, `marketplace.MarketplaceSettlement` de deployments/137.json. */
const direccion = () => {
    const a = process.env.MARKETPLACE_SETTLEMENT_ADDRESS || desplegada();
    return a && ethers.isAddress(a) ? ethers.getAddress(a) : null;
};

/** bytes32 del listing en el contrato: no revela el UUID y no colisiona con otras claves. */
const claveListing = (listingId) => ethers.id(`mkt:${listingId}`);

let proveedorRpc = () => (process.env.POLYGON_RPC_URL ? new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL) : null);

function configurado() {
    return Boolean(direccion() && process.env.POLYGON_RPC_URL);
}

async function comprobarCadena(provider) {
    const red = await provider.getNetwork();
    if (Number(red.chainId) !== CHAIN_ID) {
        throw new SettlementError('WRONG_CHAIN', `El RPC es la cadena ${red.chainId}, no Polygon.`, 503);
    }
}

function aWei(precioBez) {
    if (!/^\d{1,12}(\.\d{1,18})?$/.test(String(precioBez || ''))) {
        throw new SettlementError('PRICE_INVALID', 'price_bez: decimal positivo, hasta 18 decimales.');
    }
    const wei = ethers.parseUnits(String(precioBez), 18);
    if (wei <= 0n || wei >= 2n ** 128n) throw new SettlementError('PRICE_INVALID', 'price_bez fuera de rango.');
    return wei;
}

async function registrarListing({ listingId, provider, precioBez }) {
    if (!configurado()) throw new SettlementError('SETTLEMENT_NOT_CONFIGURED', 'MarketplaceSettlement no está configurado.', 503);
    const clave = process.env.MARKETPLACE_REGISTRAR_KEY;
    if (!clave) throw new SettlementError('REGISTRAR_NOT_CONFIGURED', 'Falta MARKETPLACE_REGISTRAR_KEY.', 503);
    if (!ethers.isAddress(provider)) throw new SettlementError('PAYOUT_ADDRESS_MISSING', 'El proveedor no tiene payout_address.', 409);
    const wei = aWei(precioBez);
    const rpc = proveedorRpc();
    await comprobarCadena(rpc);
    const contrato = new ethers.Contract(direccion(), ABI, new ethers.Wallet(clave, rpc));
    const tx = await contrato.registerListing(claveListing(listingId), ethers.getAddress(provider), wei);
    const recibo = await tx.wait();
    if (Number(recibo.status) !== 1) throw new SettlementError('REGISTER_REVERTED', 'El alta en el contrato revirtió.', 502);
    return { chainId: CHAIN_ID, contract: direccion(), listingKey: claveListing(listingId), priceWei: wei.toString(), txHash: recibo.hash };
}

/**
 * Lee el pago `txHash` y lo devuelve si es un Paid válido del listing. No decide
 * quién es el consumidor: eso lo comprueba la ruta contra las wallets de la app.
 */
async function verificarPago({ txHash, listingId }) {
    if (!configurado()) throw new SettlementError('SETTLEMENT_NOT_CONFIGURED', 'El pago en BEZ no está disponible.', 503);
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash || ''))) throw new SettlementError('TX_HASH_INVALID', 'txHash no válido.');
    const rpc = proveedorRpc();
    await comprobarCadena(rpc);
    const recibo = await rpc.getTransactionReceipt(txHash);
    if (!recibo) throw new SettlementError('TX_NOT_FOUND', 'La transacción no existe o aún no está minada.', 404);
    if (Number(recibo.status) !== 1) throw new SettlementError('TX_REVERTED', 'La transacción revirtió.', 409);

    const minimas = Math.max(parseInt(process.env.MARKETPLACE_MIN_CONFIRMATIONS, 10) || 30, 1);
    const actual = await rpc.getBlockNumber();
    const confirmaciones = actual - Number(recibo.blockNumber) + 1;
    if (confirmaciones < minimas) {
        throw new SettlementError('TX_NOT_CONFIRMED', `Faltan confirmaciones (${confirmaciones}/${minimas}).`, 409);
    }

    const contrato = direccion().toLowerCase();
    const clave = claveListing(listingId);
    for (const log of recibo.logs || []) {
        // Sólo cuentan los eventos emitidos POR el contrato: otro contrato puede emitir un Paid idéntico.
        if (String(log.address).toLowerCase() !== contrato) continue;
        let ev;
        try { ev = iface.parseLog(log); } catch { continue; }
        if (ev?.name !== 'Paid' || ev.args.listingId !== clave) continue;
        return {
            purchaseId: ev.args.purchaseId,
            payer: String(ev.args.payer).toLowerCase(),
            provider: String(ev.args.provider).toLowerCase(),
            priceWei: ev.args.price.toString(),
            feeWei: ev.args.fee.toString(),
            blockNumber: Number(recibo.blockNumber),
            txHash: recibo.hash,
            chainId: CHAIN_ID,
        };
    }
    throw new SettlementError('PAYMENT_NOT_FOUND', 'La transacción no contiene un pago de este listing.', 409);
}

/** Comisión acumulada de BeZhas en el contrato (lectura, para el panel de tesorería). */
async function comisionAcumulada() {
    if (!configurado()) return null;
    const rpc = proveedorRpc();
    const c = new ethers.Contract(direccion(), ABI, rpc);
    const [tesoreria, feeBps] = await Promise.all([c.treasury(), c.feeBps()]);
    const saldo = await c.balanceOf(tesoreria);
    return { contract: direccion(), treasury: tesoreria, feeBps: Number(feeBps), owedWei: saldo.toString() };
}

module.exports = {
    CHAIN_ID, ABI, SettlementError, claveListing, configurado, registrarListing, verificarPago, comisionAcumulada, aWei,
    _setProveedorRpc: (f) => { proveedorRpc = f; },
};
