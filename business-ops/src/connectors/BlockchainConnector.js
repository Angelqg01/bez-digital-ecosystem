'use strict';
const BaseConnector = require('./BaseConnector');

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
];

/**
 * BlockchainConnector — transferencias ERC20 (BEZ-Coin) en Polygon.
 *
 * Firma con la wallet de DISPERSIÓN dedicada (float limitado, recargado
 * periódicamente por el Treasury DAO) — nunca con la clave maestra del
 * Treasury. Así, si este proceso se ve comprometido, el daño máximo es el
 * float cargado en esta wallet, no el tesoro completo.
 *
 * LÍNEA ROJA: toda llamada a `transfer` pasa antes por RedLines
 * (crypto_asset_movement) vía BaseAgent.act() → HITL. Este conector solo
 * ejecuta el "sí" ya aprobado por un humano; nunca decide por su cuenta.
 *
 * Sin RPC/contrato/clave configurados → modo simulado (igual que el resto
 * de conectores del proyecto).
 */
class BlockchainConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'blockchain';
    this.rpcUrl = config.rpcUrl || process.env.POLYGON_RPC_URL || '';
    this.tokenAddress = config.tokenAddress || process.env.BEZCOIN_CONTRACT_ADDRESS || '';
    this.privateKey = config.privateKey || process.env.DISBURSEMENT_WALLET_PRIVATE_KEY || '';
    this.simulated = !(this.rpcUrl && this.tokenAddress && this.privateKey);
  }

  async execute(method, args = {}) {
    switch (method) {
      case 'transfer': return this.transfer(args);
      case 'balance': return this.balance(args);
      default: throw new Error(`blockchain: método desconocido ${method}`);
    }
  }

  /** Transfiere `amount` BEZ-Coin a `to`. Se asume ya aprobado por HITL. */
  async transfer({ to, amount } = {}) {
    if (!to) throw new Error('blockchain: destinatario (to) requerido');
    if (!amount || Number(amount) <= 0) throw new Error('blockchain: amount requerido y > 0');

    if (this.simulated) {
      const txHash = `0xsim_${Math.random().toString(16).slice(2)}`;
      console.log(`[blockchain:${this.tenantId}] (simulado) transfer ${amount} BEZ → ${to} (${txHash})`);
      return { sent: true, simulated: true, to, amount, txHash };
    }

    const { ethers } = require('ethers');
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    const wallet = new ethers.Wallet(this.privateKey, provider);
    const token = new ethers.Contract(this.tokenAddress, ERC20_ABI, wallet);
    const decimals = await token.decimals();
    const value = ethers.parseUnits(String(amount), decimals);
    const tx = await token.transfer(to, value);
    const receipt = await tx.wait();
    return { sent: true, to, amount, txHash: receipt.hash, blockNumber: receipt.blockNumber };
  }

  /** Consulta el balance de BEZ-Coin de una dirección (o de la wallet de dispersión). */
  async balance({ address } = {}) {
    const { ethers } = require('ethers');
    const addr = address || (this.privateKey ? new ethers.Wallet(this.privateKey).address : null);
    if (this.simulated || !addr) return { address: addr, balance: 0, simulated: true };
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    const token = new ethers.Contract(this.tokenAddress, ERC20_ABI, provider);
    const [raw, decimals] = await Promise.all([token.balanceOf(addr), token.decimals()]);
    return { address: addr, balance: ethers.formatUnits(raw, decimals) };
  }
}
module.exports = BlockchainConnector;
