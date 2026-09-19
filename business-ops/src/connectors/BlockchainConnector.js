'use strict';
const crypto = require('crypto');
const BaseConnector = require('./BaseConnector');

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
];

/**
 * BlockchainConnector — transferencias de BEZ-Coin desde la tesorería.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  YA NO FIRMA AQUÍ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes cargaba DISBURSEMENT_WALLET_PRIVATE_KEY en este mismo proceso —el de
 * los agentes— y `transfer()` firmaba «asumiendo ya aprobado por HITL». Es el
 * antipatrón del documento de seguridad (§54): el firmante se fiaba de quien lo
 * llamaba. Si alguien comprometía business-ops, la aprobación humana dejaba de
 * existir: bastaba con llamar a `transfer` directamente.
 *
 * Ahora `transfer()` crea una INTENCIÓN en la API de BeZhas
 * (/api/gateway/v1/tx/intents) con una credencial de agente (bzag_…). Esa
 * intención pasa simulación, riesgo y política, y sólo se ejecuta con firmas
 * EIP-712 de aprobadores de tesorería; firma el tx-signer aislado con la clave
 * en KMS. La aprobación de OPERANT (Telegram/panel) sigue haciendo falta para
 * llegar hasta aquí: son dos puertas, y la segunda no la abre este proceso.
 *
 * La clave privada, si sigue en el entorno, se IGNORA y se avisa: hay que
 * retirarla y rotarla.
 *
 * Sin API ni credencial de agente → modo simulado, como el resto de conectores.
 */
class BlockchainConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'blockchain';
    this.rpcUrl = config.rpcUrl || process.env.POLYGON_RPC_URL || '';
    this.tokenAddress = config.tokenAddress || process.env.BEZCOIN_CONTRACT_ADDRESS || '';
    this.apiUrl = config.apiUrl || process.env.BEZHAS_API_URL || '';
    this.agentKey = config.agentKey || process.env.OPERANT_TX_AGENT_KEY || '';
    this.network = config.network || process.env.OPERANT_TX_NETWORK || 'polygon';
    this.treasuryAddress = config.treasuryAddress || process.env.DISBURSEMENT_WALLET_ADDRESS || '';
    this.fetch = config.fetchImpl || globalThis.fetch;
    if (config.privateKey || process.env.DISBURSEMENT_WALLET_PRIVATE_KEY) {
      console.warn(`[blockchain:${tenantId}] DISBURSEMENT_WALLET_PRIVATE_KEY se IGNORA: la firma vive en tx-signer. `
        + 'Retírala del entorno y rota esa wallet.');
    }
    this.simulated = !(this.apiUrl && this.agentKey);
  }

  async execute(method, args = {}) {
    switch (method) {
      case 'transfer': return this.transfer(args);
      case 'balance': return this.balance(args);
      default: throw new Error(`blockchain: método desconocido ${method}`);
    }
  }

  /** Clave de idempotencia estable: reintentar la tarea nunca abre un segundo pago. */
  claveIdempotencia({ to, amount, reference }) {
    const base = `${this.tenantId}|${String(to).toLowerCase()}|${amount}|${reference || ''}`;
    return `operant-${crypto.createHash('sha256').update(base).digest('hex').slice(0, 40)}`;
  }

  /**
   * Solicita la transferencia de `amount` BEZ a `to`. Devuelve el estado de la
   * intención, no un tx hash: el envío ocurre cuando los aprobadores de
   * tesorería firman y alguien autorizado lo ejecuta.
   */
  async transfer({ to, amount, reference, counterparty } = {}) {
    if (!to) throw new Error('blockchain: destinatario (to) requerido');
    if (!amount || Number(amount) <= 0) throw new Error('blockchain: amount requerido y > 0');

    if (this.simulated) {
      const txHash = `0xsim_${Math.random().toString(16).slice(2)}`;
      console.log(`[blockchain:${this.tenantId}] (simulado) transfer ${amount} BEZ → ${to} (${txHash})`);
      return { sent: true, simulated: true, to, amount, txHash };
    }

    const cuerpo = {
      rail: 'crypto_transfer',
      asset: 'BEZ',
      amount: String(amount),
      network: this.network,
      source: { type: 'bezhas_treasury' },
      destination: { type: 'evm_address', value: to },
      purpose: 'token_purchase',
      idempotencyKey: this.claveIdempotencia({ to, amount, reference }),
    };
    if (counterparty?.legalName && counterparty?.country) cuerpo.counterparty = counterparty;
    if (reference) cuerpo.reference = String(reference).replace(/[^A-Za-z0-9 /\-?:().,'+]/g, '').slice(0, 140);

    const res = await this.fetch(new URL('/api/gateway/v1/tx/intents', this.apiUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.agentKey },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(20000),
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`blockchain: la API rechazó la intención (${datos.code || res.status}): ${datos.error || ''}`.trim());
    }
    const i = datos.intencion || {};
    return {
      sent: false,
      to,
      amount,
      intentId: i.id,
      status: i.estado,
      decision: i.decision,
      approvalsRequired: i.aprobacionesRequeridas,
      motivos: (i.motivos || []).map((m) => m.code),
      nota: 'Pendiente de aprobación firmada de tesorería en BeZhas; el envío no lo hace OPERANT.',
    };
  }

  /** Balance de BEZ-Coin de una dirección (o de la wallet de dispersión). Sólo lectura. */
  async balance({ address } = {}) {
    const addr = address || this.treasuryAddress || null;
    if (!this.rpcUrl || !this.tokenAddress || !addr) return { address: addr, balance: 0, simulated: true };
    const { ethers } = require('ethers');
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    const token = new ethers.Contract(this.tokenAddress, ERC20_ABI, provider);
    const [raw, decimals] = await Promise.all([token.balanceOf(addr), token.decimals()]);
    return { address: addr, balance: ethers.formatUnits(raw, decimals) };
  }
}
module.exports = BlockchainConnector;
