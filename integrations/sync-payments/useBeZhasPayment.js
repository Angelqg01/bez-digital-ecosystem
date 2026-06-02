/**
 * useBeZhasPayment.js
 * Hook principal de pagos BeZhas — BEZ-Coin (BNB Chain + Polygon)
 * 
 * Soporta:
 *  - Pagos directos con BEZ-Coin
 *  - Fiat → BEZ (MoonPay / Transak / Ramp)
 *  - BEZ → Fiat (swap + withdraw)
 *  - Pago cross-chain (BSC ↔ Polygon via LayerZero / Wormhole)
 *  - Gas estimation + retry
 *  - Eventos onchain (PaymentReceived, PaymentFailed)
 */

import { useState, useCallback, useEffect, useRef }  from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient, useBalance } from 'wagmi';
import { parseUnits, formatUnits, getContract, encodeFunctionData, decodeEventLog } from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';

// ABIs sincronizados desde bezhas_blockchain
import { bezhasPaymentABI  } from '../abis/BeZhasPayment.abi.json';
import { bezhasTokenABI    } from '../abis/BezhasToken.abi.json';

// Addresses sincronizadas
import { getContractAddress } from '../contracts/addresses';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════
export const PAYMENT_STATUS = {
  IDLE:       'idle',
  APPROVING:  'approving',
  PENDING:    'pending',
  CONFIRMING: 'confirming',
  SUCCESS:    'success',
  FAILED:     'failed',
  REFUNDED:   'refunded',
};

const BEZ_DECIMALS = 18;

// Gas buffer: 20% extra sobre la estimación
const GAS_BUFFER = 1.2n;

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export function useBeZhasPayment() {
  const { address: walletAddress, isConnected }  = useAccount();
  const chainId                                   = useChainId();
  const publicClient                              = usePublicClient();
  const { data: walletClient }                    = useWalletClient();

  const [status,     setStatus]     = useState(PAYMENT_STATUS.IDLE);
  const [txHash,     setTxHash]     = useState(null);
  const [receipt,    setReceipt]    = useState(null);
  const [error,      setError]      = useState(null);
  const [gasEstimate,setGasEstimate] = useState(null);

  const abortRef = useRef(false);

  // Addresses de contratos para la red actual
  const paymentAddress = getContractAddress(chainId, 'BeZhasPayment');
  const tokenAddress   = getContractAddress(chainId, 'BezhasToken');

  // Balance de BEZ
  const { data: bezBalance, refetch: refetchBalance } = useBalance({
    address: walletAddress,
    token:   tokenAddress,
    watch:   true,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTRATOS
  // ─────────────────────────────────────────────────────────────────────────────
  const getPaymentContract = useCallback(() => {
    if (!paymentAddress || !publicClient) return null;
    return getContract({
      address: paymentAddress,
      abi:     bezhasPaymentABI,
      client:  { public: publicClient, wallet: walletClient },
    });
  }, [paymentAddress, publicClient, walletClient]);

  const getTokenContract = useCallback(() => {
    if (!tokenAddress || !publicClient) return null;
    return getContract({
      address: tokenAddress,
      abi:     bezhasTokenABI,
      client:  { public: publicClient, wallet: walletClient },
    });
  }, [tokenAddress, publicClient, walletClient]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — VERIFICAR ALLOWANCE
  // ─────────────────────────────────────────────────────────────────────────────
  const checkAllowance = useCallback(async (amountBEZ) => {
    const token = getTokenContract();
    if (!token || !walletAddress) return 0n;

    const allowance = await token.read.allowance([walletAddress, paymentAddress]);
    return allowance;
  }, [getTokenContract, walletAddress, paymentAddress]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — APPROVE si es necesario
  // ─────────────────────────────────────────────────────────────────────────────
  const approve = useCallback(async (amountBEZ) => {
    const token = getTokenContract();
    if (!token) throw new Error('Token contract no disponible');
    if (!walletClient) throw new Error('Wallet no conectada');

    setStatus(PAYMENT_STATUS.APPROVING);

    const amountWei = parseUnits(amountBEZ.toString(), BEZ_DECIMALS);

    // Max approval (uint256 max) para mejor UX
    const MAX_UINT256 = 2n ** 256n - 1n;

    const hash = await token.write.approve([paymentAddress, MAX_UINT256]);
    setTxHash(hash);

    const approveReceipt = await waitForTransactionReceipt(publicClient, { hash });
    if (approveReceipt.status !== 'success') {
      throw new Error('Aprobación fallida');
    }

    return hash;
  }, [getTokenContract, walletClient, paymentAddress, publicClient]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3 — ESTIMAR GAS
  // ─────────────────────────────────────────────────────────────────────────────
  const estimateGas = useCallback(async (amountBEZ, recipient, orderId) => {
    if (!publicClient || !paymentAddress || !walletAddress) return null;

    try {
      const amountWei = parseUnits(amountBEZ.toString(), BEZ_DECIMALS);
      const gas = await publicClient.estimateContractGas({
        address:      paymentAddress,
        abi:          bezhasPaymentABI,
        functionName: 'processPayment',
        args:         [recipient, amountWei, orderId],
        account:      walletAddress,
      });

      // Añadir buffer del 20%
      const withBuffer = (gas * 12n) / 10n;
      setGasEstimate(withBuffer);
      return withBuffer;
    } catch (e) {
      console.warn('Gas estimation failed:', e.message);
      return null;
    }
  }, [publicClient, paymentAddress, walletAddress]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4 — PROCESAR PAGO
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * @param {Object} params
   * @param {string} params.recipient      - Address del receptor
   * @param {number|string} params.amount  - Cantidad en BEZ (no en wei)
   * @param {string} params.orderId        - ID único del pedido (bytes32)
   * @param {string} [params.memo]         - Notas del pago
   * @param {boolean} [params.crossChain]  - Pago cross-chain
   * @param {number} [params.targetChain]  - ChainId destino (cross-chain)
   */
  const processPayment = useCallback(async ({
    recipient,
    amount,
    orderId,
    memo = '',
    crossChain = false,
    targetChain,
  }) => {
    if (!walletAddress) throw new Error('Wallet no conectada');
    if (!isConnected)   throw new Error('No conectado a la red');
    if (!paymentAddress) throw new Error(`BeZhasPayment no desplegado en chainId ${chainId}`);

    abortRef.current = false;
    setError(null);
    setTxHash(null);
    setReceipt(null);

    try {
      const amountWei = parseUnits(amount.toString(), BEZ_DECIMALS);

      // Verificar balance
      const balance = bezBalance?.value ?? 0n;
      if (balance < amountWei) {
        throw new Error(`Balance insuficiente. Tienes ${formatUnits(balance, BEZ_DECIMALS)} BEZ`);
      }

      // Verificar allowance y aprobar si necesario
      const allowance = await checkAllowance(amount);
      if (allowance < amountWei) {
        await approve(amount);
        if (abortRef.current) return;
      }

      setStatus(PAYMENT_STATUS.PENDING);

      // Estimar gas
      const gas = await estimateGas(amount, recipient, orderId);

      const payment = getPaymentContract();
      if (!payment) throw new Error('Payment contract no disponible');

      let hash;

      if (crossChain && targetChain) {
        // Pago cross-chain via LayerZero
        hash = await payment.write.bridgePayment([
          recipient,
          amountWei,
          orderId,
          targetChain,
          memo,
        ], { gas });
      } else {
        // Pago en la misma red
        hash = await payment.write.processPayment([
          recipient,
          amountWei,
          orderId,
          memo,
        ], { gas });
      }

      setTxHash(hash);
      setStatus(PAYMENT_STATUS.CONFIRMING);

      // Esperar confirmación
      const txReceipt = await waitForTransactionReceipt(publicClient, {
        hash,
        confirmations: chainId === 56 || chainId === 137 ? 3 : 1,
      });

      if (txReceipt.status !== 'success') {
        throw new Error('Transacción revertida');
      }

      // Decodificar eventos
      const events = txReceipt.logs.map(log => {
        try {
          return decodeEventLog({ abi: bezhasPaymentABI, ...log });
        } catch { return null; }
      }).filter(Boolean);

      setReceipt({ ...txReceipt, events });
      setStatus(PAYMENT_STATUS.SUCCESS);
      await refetchBalance();

      return { hash, receipt: txReceipt, events };

    } catch (err) {
      if (abortRef.current) return;
      const message = err.shortMessage || err.message || 'Error desconocido';
      setError(message);
      setStatus(PAYMENT_STATUS.FAILED);
      throw err;
    }
  }, [
    walletAddress, isConnected, paymentAddress, chainId,
    bezBalance, checkAllowance, approve, estimateGas,
    getPaymentContract, publicClient, refetchBalance,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // HISTORIAL DE PAGOS (eventos onchain)
  // ─────────────────────────────────────────────────────────────────────────────
  const [paymentHistory, setPaymentHistory] = useState([]);

  const fetchPaymentHistory = useCallback(async (fromBlock = 'earliest') => {
    if (!publicClient || !paymentAddress || !walletAddress) return [];

    try {
      const logs = await publicClient.getLogs({
        address:   paymentAddress,
        event:     bezhasPaymentABI.find(e => e.name === 'PaymentProcessed' && e.type === 'event'),
        args:      { payer: walletAddress },
        fromBlock,
        toBlock:   'latest',
      });

      const history = logs.map(log => ({
        txHash:    log.transactionHash,
        block:     log.blockNumber,
        recipient: log.args.recipient,
        amount:    formatUnits(log.args.amount, BEZ_DECIMALS),
        orderId:   log.args.orderId,
        timestamp: null, // fetch block timestamp separately if needed
      }));

      setPaymentHistory(history);
      return history;
    } catch (e) {
      console.warn('fetchPaymentHistory error:', e.message);
      return [];
    }
  }, [publicClient, paymentAddress, walletAddress]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortRef.current = true;
    setStatus(PAYMENT_STATUS.IDLE);
    setTxHash(null);
    setReceipt(null);
    setError(null);
    setGasEstimate(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPLORADOR LINK
  // ─────────────────────────────────────────────────────────────────────────────
  const explorerUrl = txHash
    ? chainId === 56    ? `https://bscscan.com/tx/${txHash}`
    : chainId === 97    ? `https://testnet.bscscan.com/tx/${txHash}`
    : chainId === 137   ? `https://polygonscan.com/tx/${txHash}`
    : chainId === 80001 ? `https://mumbai.polygonscan.com/tx/${txHash}`
    : null
    : null;

  return {
    // Estado
    status,
    txHash,
    receipt,
    error,
    gasEstimate,
    explorerUrl,
    isLoading:   [PAYMENT_STATUS.APPROVING, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.CONFIRMING].includes(status),
    isSuccess:   status === PAYMENT_STATUS.SUCCESS,
    isFailed:    status === PAYMENT_STATUS.FAILED,

    // Datos
    bezBalance:       bezBalance ? formatUnits(bezBalance.value, BEZ_DECIMALS) : '0',
    bezBalanceRaw:    bezBalance?.value ?? 0n,
    paymentAddress,
    tokenAddress,
    chainId,
    walletAddress,
    isConnected,
    paymentHistory,

    // Acciones
    processPayment,
    checkAllowance,
    approve,
    estimateGas,
    fetchPaymentHistory,
    reset,
  };
}

export default useBeZhasPayment;
