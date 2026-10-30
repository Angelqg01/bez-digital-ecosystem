/**
 * ============================================================================
 * BEZHAS SDK - RWA (REAL WORLD ASSETS) MODULE
 * ============================================================================
 *
 * Tokenización de activos reales contra el RWAFactory DESPLEGADO en Polygon
 * (ERC-1155, comisión en BEZ). Antes este módulo llamaba a `createAsset`,
 * `listAssetsByOwner` y `transferAsset`, que ese contrato no tiene: toda
 * llamada revertía. Ahora usa su ABI real.
 *
 * Dos formas de uso:
 *   · con un `signer` de ethers, el SDK firma y envía (tokenizeAsset,
 *     transferFractions);
 *   · sin firmar nada, con la api-key del Gateway: `GatewayClient.rwa.*`
 *     devuelve las transacciones preparadas para que las firme otra wallet.
 */

const { ethers } = require('ethers');

/** Fábricas de BeZhas en Polygon (mismo bytecode; registros separados). */
const RWA_FACTORIES = Object.freeze({
    activos: '0xa7e6656eFA45EB59ca247aa15F883330692C0d9A',
    industrial: '0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0',
});
const BEZ_POLYGON = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

/** Mismo orden que el enum AssetCategory del contrato. */
const RWA_CATEGORIES = Object.freeze(['inmueble', 'hotel', 'local', 'ropa', 'coche', 'barco', 'helicoptero', 'objeto']);

const ASSET_TUPLE = 'tuple(string name, uint8 category, string legalDocumentCID, string imagesCID, uint256 totalSupply, '
    + 'uint256 valuationUSD, uint256 pricePerFraction, uint256 estimatedYield, address creator, string location, '
    + 'uint256 createdAt, bool isActive)';

const RWA_FACTORY_ABI = [
    'function tokenizationFee() view returns (uint256)',
    'function tokenizeAsset(string name, uint8 category, string legalCID, string imagesCID, uint256 supply, uint256 valuationUSD, uint256 pricePerFraction, uint256 estimatedYield, string location) returns (uint256)',
    `function getAsset(uint256 assetId) view returns (${ASSET_TUPLE})`,
    'function getCreatorAssets(address creator) view returns (uint256[])',
    'function balanceOf(address account, uint256 id) view returns (uint256)',
    'function isVerified(uint256 assetId, address investor) view returns (bool)',
    'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
    'function verifyInvestor(uint256 assetId, address investor)',
    'event AssetTokenized(uint256 indexed assetId, string name, uint8 category, address indexed creator, uint256 totalSupply, uint256 valuationUSD)',
];
const ERC20_ABI = [
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
];

function formatAsset(assetId, a) {
    return {
        assetId: Number(assetId),
        name: a.name,
        category: RWA_CATEGORIES[Number(a.category)] || String(a.category),
        legalDocumentCID: a.legalDocumentCID,
        imagesCID: a.imagesCID || null,
        totalSupply: a.totalSupply.toString(),
        valuationUSD: a.valuationUSD.toString(),
        pricePerFractionBEZ: ethers.formatEther(a.pricePerFraction),
        estimatedYieldPct: Number(a.estimatedYield) / 100,
        creator: a.creator,
        location: a.location,
        createdAt: new Date(Number(a.createdAt) * 1000).toISOString(),
        isActive: a.isActive,
    };
}

class RWAManager {
    /**
     * @param {Object} [config]
     * @param {string} [config.rpcUrl]    RPC de Polygon
     * @param {'activos'|'industrial'} [config.factory] fábrica (por defecto activos)
     * @param {string} [config.rwaFactoryAddress] dirección explícita (anula `factory`)
     * @param {Object} [config.provider]  provider de ethers ya creado (tests, wallets)
     */
    constructor(config = {}) {
        this.rpcUrl = config.rpcUrl || 'https://polygon-bor-rpc.publicnode.com';
        this.rwaFactoryAddress = config.rwaFactoryAddress || RWA_FACTORIES[config.factory || 'activos'];
        if (!this.rwaFactoryAddress) throw new Error(`Fábrica RWA desconocida: ${config.factory}`);
        this.provider = config.provider || new ethers.JsonRpcProvider(this.rpcUrl, 137, { staticNetwork: true });
        this.rwaFactoryABI = RWA_FACTORY_ABI;
    }

    _factory(runner = this.provider) {
        return new ethers.Contract(this.rwaFactoryAddress, RWA_FACTORY_ABI, runner);
    }

    /**
     * Tokeniza un activo: aprueba la comisión en BEZ si hace falta y llama a tokenizeAsset.
     * @param {Object} asset
     * @param {string} asset.name
     * @param {string} asset.category       una de RWA_CATEGORIES
     * @param {string} asset.legalCID       CID de IPFS de la documentación legal (obligatorio)
     * @param {string} [asset.imagesCID]
     * @param {number|bigint} asset.supply  fracciones
     * @param {number|bigint} asset.valuationUSD
     * @param {string} asset.pricePerFractionBEZ  decimal en texto
     * @param {number} asset.estimatedYieldPct    p. ej. 8.5
     * @param {string} asset.location
     * @param {Object} signer  signer de ethers del titular
     */
    async tokenizeAsset(asset, signer) {
        try {
            const category = RWA_CATEGORIES.indexOf(asset.category);
            if (category < 0) throw new Error(`Categoría no válida. Admitidas: ${RWA_CATEGORIES.join(', ')}`);
            if (!asset.legalCID) throw new Error('legalCID es obligatorio: la documentación legal tiene que estar en IPFS');

            const factory = this._factory(signer);
            const fee = await factory.tokenizationFee();
            const owner = await signer.getAddress();
            const bez = new ethers.Contract(BEZ_POLYGON, ERC20_ABI, signer);
            if ((await bez.allowance(owner, this.rwaFactoryAddress)) < fee) {
                await (await bez.approve(this.rwaFactoryAddress, fee)).wait();
            }

            const tx = await factory.tokenizeAsset(
                asset.name, category, asset.legalCID, asset.imagesCID || '',
                BigInt(asset.supply), BigInt(asset.valuationUSD), ethers.parseEther(String(asset.pricePerFractionBEZ)),
                BigInt(Math.round(Number(asset.estimatedYieldPct || 0) * 100)), asset.location,
            );
            const receipt = await tx.wait();
            const iface = new ethers.Interface(RWA_FACTORY_ABI);
            const evento = receipt.logs
                .map((l) => { try { return iface.parseLog(l); } catch { return null; } })
                .find((e) => e && e.name === 'AssetTokenized');

            return {
                success: true,
                assetId: evento ? Number(evento.args.assetId) : null,
                feeBEZ: ethers.formatEther(fee),
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /** Ficha pública de un activo. */
    async getAssetInfo(assetId) {
        try {
            const a = await this._factory().getAsset(assetId);
            return { success: true, ...formatAsset(assetId, a) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /** Activos creados por una wallet, con su ficha. */
    async listAssets(creatorAddress) {
        try {
            const ids = await this._factory().getCreatorAssets(creatorAddress);
            const assets = (await Promise.all(ids.map((id) => this.getAssetInfo(id))))
                .filter((a) => a.success);
            return { success: true, assets, count: assets.length };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /** Fracciones de un activo que tiene una wallet. */
    async balanceOf(address, assetId) {
        return (await this._factory().balanceOf(address, assetId)).toString();
    }

    /**
     * Transfiere fracciones. En inmuebles, hoteles, barcos y helicópteros el
     * contrato exige KYC del destino si se mueve el 10 % o más del activo.
     */
    async transferFractions(assetId, toAddress, amount, signer) {
        try {
            const from = await signer.getAddress();
            const tx = await this._factory(signer).safeTransferFrom(from, toAddress, assetId, BigInt(amount), '0x');
            const receipt = await tx.wait();
            return { success: true, transactionHash: receipt.hash, assetId, to: toAddress, amount: String(amount) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /** Verifica el KYC de un inversor para un activo. Sólo el owner del factory (BeZhas). */
    async verifyInvestor(assetId, investor, signer) {
        try {
            const receipt = await (await this._factory(signer).verifyInvestor(assetId, investor)).wait();
            return { success: true, transactionHash: receipt.hash, assetId, investor };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = RWAManager;
module.exports.RWAManager = RWAManager;
module.exports.RWA_FACTORIES = RWA_FACTORIES;
module.exports.RWA_CATEGORIES = RWA_CATEGORIES;
module.exports.RWA_FACTORY_ABI = RWA_FACTORY_ABI;
