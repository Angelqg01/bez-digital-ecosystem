/**
 * useBezPayTransaction.js
 *
 * Hook real de transacciones on-chain para BezPayModal v2.
 * Implementa el flujo completo con wagmi v2 + viem:
 *
 *  1. ERC-20 approval → transfer (USDT, USDC, BEZ)
 *  2. Native transfer (MATIC, ETH)
 *  3. Hot Wallet (backend dispenseTokens) — principal para compra BEZ
 *  4. TokenSale contract (buyTokens) — venta primaria
 *  5. Quality Escrow (createService)
 *  6. Farming deposit (depositBEZ)
 *  7. Subscription on-chain (via backend + webhook)
 *
 * Contratos Polygon Mainnet / Amoy Testnet:
 *   BEZ Token:       0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 *   TokenSale:       0x00fd1C8558Ede152AF61e6Dacd547668C23420B0
 *   QualityEscrow:   0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
 *   Treasury:        0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4
 *
 * Backend: https://api.bez.digital / wss://ws.bez.digital:3002
 */

import { useState, useCallback } from 'react';
import {
  useAccount,
  useBalance,
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useChainId,
  useSwitchChain,
} from 'wagmi';
import { parseEther, parseUnits, formatUnits } from 'viem';

// ─── CONTRATOS ────────────────────────────────────────────────────────────────
export const CONTRACTS = {
  BEZ_POLYGON:  '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
  BEZ_BNB:      '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
  TOKEN_SALE:   '0x00fd1C8558Ede152AF61e6Dacd547668C23420B0',
  STAKING_POOL: '0x5c9bd3136fBAA3861DeAE71e689AD8792202c7Df',
  ESCROW:       '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
  TREASURY:     '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
  USDC_POLYGON: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  USDT_POLYGON: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  USDT_BNB:     '0x55d398326f99059fF775485246999027B3197955',
};

// ─── DECIMALES POR TOKEN ──────────────────────────────────────────────────────
const TOKEN_DECIMALS = {
  BEZ:  18,
  USDT: 6,
  USDC: 6,
  MATIC: 18,
  ETH:  18,
  BNB:  18,
};

// ─── ABIs MÍNIMOS ─────────────────────────────────────────────────────────────
export const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
];

export const TOKEN_SALE_ABI = [
  {
    name: 'buyTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'price',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

export const QUALITY_ESCROW_ABI = [
  {
    name: 'createService',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'clientWallet', type: 'address' },
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'initialQuality', type: 'uint256' },
    ],
    outputs: [{ name: 'serviceId', type: 'uint256' }],
  },
  {
    name: 'finalizeService',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'serviceId', type: 'uint256' },
      { name: 'finalQuality', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'raiseDispute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'serviceId', type: 'uint256' }],
    outputs: [],
  },
];

export const STAKING_POOL_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'pid', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'pid', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'pendingReward',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'pid', type: 'uint256' }, { name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'userInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'pid', type: 'uint256' }, { name: 'user', type: 'address' }],
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'rewardDebt', type: 'uint256' },
      { name: 'lockUntil', type: 'uint256' },
    ],
  },
];

// ─── ESTADOS DE TRANSACCIÓN ───────────────────────────────────────────────────
export const TX_STATE = {
  IDLE:        'idle',
  APPROVING:   'approving',    // Aprobando ERC-20 allowance
  TRANSACTING: 'transacting',  // TX enviada, esperando hash
  CONFIRMING:  'confirming',   // Esperando confirmaciones en la cadena
  NOTIFYING:   'notifying',    // Notificando backend vía webhook
  SUCCESS:     'success',
  ERROR:       'error',
};

// ─── CUSTOM HOOK ──────────────────────────────────────────────────────────────
export function useBezPayTransaction() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // wagmi write hooks
  const {
    writeContractAsync,
    isPending: isContractPending,
    data: contractTxHash,
    error: contractError,
    reset: resetContract,
  } = useWriteContract();

  const {
    sendTransactionAsync,
    isPending: isNativePending,
    data: nativeTxHash,
    error: nativeError,
    reset: resetNative,
  } = useSendTransaction();

  // Estado interno
  const [txState, setTxState]     = useState(TX_STATE.IDLE);
  const [txHash, setTxHash]       = useState(null);
  const [txResult, setTxResult]   = useState(null);
  const [txError, setTxError]     = useState(null);
  const [txLogs, setTxLogs]       = useState([]);

  const log = (msg, type = 'info') => {
    const ts = new Date().toISOString().slice(11, 22);
    setTxLogs(prev => [...prev.slice(-9), { ts, msg, type }]);
    if (import.meta.env.DEV) console.log(`[BezPay ${type.toUpperCase()}] ${msg}`);
  };

  const resetAll = useCallback(() => {
    setTxState(TX_STATE.IDLE);
    setTxHash(null);
    setTxResult(null);
    setTxError(null);
    setTxLogs([]);
    resetContract?.();
    resetNative?.();
  }, [resetContract, resetNative]);

  // ── Esperar minado con polling ───────────────────────────────────────────
  const waitForTx = async (hash, description = '') => {
    log(`Esperando confirmación${description ? ': ' + description : ''}...`);
    setTxState(TX_STATE.CONFIRMING);
    setTxHash(hash);

    // Polling cada 3s (fallback robusto sin depender del hook useWaitForTransactionReceipt)
    const RPC_URL = chainId === 137
      ? (import.meta.env.VITE_POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com')
      : 'https://rpc-amoy.polygon.technology';

    for (let attempt = 0; attempt < 40; attempt++) {  // Max 2 minutos
      await new Promise(r => setTimeout(r, 3000));
      try {
        const resp = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', method: 'eth_getTransactionReceipt',
            params: [hash], id: 1,
          }),
        });
        const data = await resp.json();
        if (data?.result?.status) {
          const success = data.result.status === '0x1';
          return {
            success,
            blockNumber: parseInt(data.result.blockNumber, 16),
            gasUsed: parseInt(data.result.gasUsed, 16),
          };
        }
      } catch (_) { /* sigue esperando */ }
    }
    throw new Error('TX timeout — puede que aún esté pendiente. Verifica en polygonscan.com');
  };

  // ── Notificar backend ────────────────────────────────────────────────────
  const notifyBackend = async (payload) => {
    log('Notificando backend...', 'info');
    setTxState(TX_STATE.NOTIFYING);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('https://api.bez.digital/api/payment/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...payload, source: 'bezpay_v2', ts: Date.now() }),
      });
      const data = await resp.json().catch(() => ({}));
      log(`Backend confirmado: ${JSON.stringify(data).slice(0, 80)}`, 'success');
      return data;
    } catch (err) {
      log(`Backend no disponible (TX válida en chain): ${err.message}`, 'warn');
      return null;  // No es fatal: la TX on-chain ya se ha confirmado
    }
  };

  // ── FLUJO NATIVO (MATIC / ETH) ───────────────────────────────────────────
  const sendNativePayment = async ({ amountEther, to = CONTRACTS.TREASURY, meta = {} }) => {
    log(`Enviando ${amountEther} ETH/MATIC a ${to.slice(0, 8)}...`);
    setTxState(TX_STATE.TRANSACTING);
    const hash = await sendTransactionAsync({
      to,
      value: parseEther(String(amountEther)),
    });
    log(`TX enviada: ${hash.slice(0, 12)}...`);
    const receipt = await waitForTx(hash, 'pago nativo');
    if (!receipt.success) throw new Error('TX fallida en la cadena');
    await notifyBackend({ type: 'native_payment', txHash: hash, ...meta });
    return { txHash: hash, blockNumber: receipt.blockNumber };
  };

  // ── FLUJO ERC-20 TRANSFER ────────────────────────────────────────────────
  const sendERC20Payment = async ({
    tokenAddress,
    tokenSymbol,
    amountUnits,    // ya en unidades del token (parseUnits)
    to = CONTRACTS.TREASURY,
    meta = {},
  }) => {
    log(`Transfiriendo ${formatUnits(amountUnits, TOKEN_DECIMALS[tokenSymbol] || 18)} ${tokenSymbol}...`);
    setTxState(TX_STATE.TRANSACTING);
    const hash = await writeContractAsync({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, amountUnits],
    });
    log(`TX ERC-20 enviada: ${hash.slice(0, 12)}...`);
    const receipt = await waitForTx(hash, `${tokenSymbol} transfer`);
    if (!receipt.success) throw new Error(`TX ${tokenSymbol} fallida en la cadena`);
    await notifyBackend({ type: 'erc20_payment', txHash: hash, tokenSymbol, ...meta });
    return { txHash: hash, blockNumber: receipt.blockNumber };
  };

  // ── FLUJO HOT WALLET (api.bez.digital/api/payment) ─────────────────────────
  // El usuario primero transfiere fondos al treasury, luego el backend dispensa BEZ.
  // Es la forma más segura y más usada para comprar BEZ con cualquier token.
  const sendHotWalletPayment = async ({
    payToken,
    amountUSD,
    walletAddress,
    planId,
    poolId,
    lockDays,
    type,
    meta = {},
  }) => {
    const token = localStorage.getItem('token');
    log(`Iniciando Hot Wallet payment: ${amountUSD} USD en ${payToken}...`);
    setTxState(TX_STATE.NOTIFYING);

    const resp = await fetch('https://api.bez.digital/api/payment/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        payToken, amountUSD, walletAddress,
        planId, poolId, lockDays, type,
        source: 'bezpay_v2', ...meta,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.message || `Backend error ${resp.status}`);
    }

    const { paymentAddress, amountToSend, decimals, bezAmount, paymentId } = await resp.json();

    // Si el backend devuelve una dirección + monto → TX on-chain
    if (paymentAddress && amountToSend) {
      let txResult;
      if (['MATIC', 'ETH'].includes(payToken)) {
        txResult = await sendNativePayment({
          amountEther: amountToSend,
          to: paymentAddress,
          meta: { paymentId, type },
        });
      } else {
        const tokenAddr = TOKEN_ADDRESSES_MAP[payToken];
        if (!tokenAddr) throw new Error(`Token ${payToken} no soportado on-chain`);
        txResult = await sendERC20Payment({
          tokenAddress: tokenAddr,
          tokenSymbol: payToken,
          amountUnits: parseUnits(String(amountToSend), decimals || 6),
          to: paymentAddress,
          meta: { paymentId, type },
        });
      }

      // Confirmar al backend que la TX está en cadena
      await notifyBackend({
        type: 'payment_confirmed',
        paymentId,
        txHash: txResult.txHash,
        walletAddress,
      });

      return { ...txResult, bezAmount: bezAmount || 0, paymentId };
    }

    // Backend handled entirely server-side (subscriptions, algunas fiat)
    return { txHash: null, bezAmount: bezAmount || 0, paymentId, serverSide: true };
  };

  // ── FLUJO ESCROW ─────────────────────────────────────────────────────────
  const createEscrow = async ({ clientWallet, collateralBEZ, quality = 85 }) => {
    const collateralUnits = parseUnits(String(collateralBEZ), 18);

    // Paso 1: approve
    log(`Aprobando ${collateralBEZ} BEZ para QualityEscrow...`);
    setTxState(TX_STATE.APPROVING);
    const approveHash = await writeContractAsync({
      address: CONTRACTS.BEZ_POLYGON,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ESCROW, collateralUnits],
    });
    log(`Approve TX: ${approveHash.slice(0, 12)}...`);
    const approveReceipt = await waitForTx(approveHash, 'BEZ approve');
    if (!approveReceipt.success) throw new Error('Approve fallido');

    // Paso 2: createService
    log(`Creando escrow (quality=${quality}%)...`);
    setTxState(TX_STATE.TRANSACTING);
    const escrowHash = await writeContractAsync({
      address: CONTRACTS.ESCROW,
      abi: QUALITY_ESCROW_ABI,
      functionName: 'createService',
      args: [clientWallet, collateralUnits, BigInt(quality)],
    });
    log(`Escrow TX: ${escrowHash.slice(0, 12)}...`);
    const receipt = await waitForTx(escrowHash, 'createService');
    if (!receipt.success) throw new Error('Escrow TX fallida');

    await notifyBackend({
      type: 'escrow_created',
      txHash: escrowHash,
      clientWallet,
      collateralBEZ,
      quality,
    });

    return { txHash: escrowHash, blockNumber: receipt.blockNumber };
  };

  // ── FLUJO FARMING DEPOSIT ────────────────────────────────────────────────
  const depositFarming = async ({ pid = 0, amountBEZ, lockDays = 30 }) => {
    const amountUnits = parseUnits(String(amountBEZ), 18);

    // Paso 1: approve
    log(`Aprobando ${amountBEZ} BEZ para StakingPool (pid=${pid})...`);
    setTxState(TX_STATE.APPROVING);
    const approveHash = await writeContractAsync({
      address: CONTRACTS.BEZ_POLYGON,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.STAKING_POOL, amountUnits],
    });
    const approveReceipt = await waitForTx(approveHash, 'BEZ approve');
    if (!approveReceipt.success) throw new Error('Approve fallido');

    // Paso 2: deposit
    log(`Depositando en pool ${pid}, lock=${lockDays}d...`);
    setTxState(TX_STATE.TRANSACTING);
    const depositHash = await writeContractAsync({
      address: CONTRACTS.STAKING_POOL,
      abi: STAKING_POOL_ABI,
      functionName: 'deposit',
      args: [BigInt(pid), amountUnits],
    });
    log(`Deposit TX: ${depositHash.slice(0, 12)}...`);
    const receipt = await waitForTx(depositHash, 'farming deposit');
    if (!receipt.success) throw new Error('Deposit TX fallida');

    await notifyBackend({
      type: 'farming_deposit',
      txHash: depositHash,
      pid, amountBEZ, lockDays,
      walletAddress: address,
    });

    return { txHash: depositHash, blockNumber: receipt.blockNumber };
  };

  // ── TOKEN ADDRESSES MAP ───────────────────────────────────────────────────
  const TOKEN_ADDRESSES_MAP = {
    USDT: CONTRACTS.USDT_POLYGON,
    USDC: CONTRACTS.USDC_POLYGON,
    BEZ:  CONTRACTS.BEZ_POLYGON,
    USDT_BNB: CONTRACTS.USDT_BNB,
    BEZ_BNB:  CONTRACTS.BEZ_BNB,
  };

  // ── SELECTOR PRINCIPAL ────────────────────────────────────────────────────
  // Decide el flujo correcto según el tipo de pago y el token
  const executePayment = useCallback(async ({
    type,              // BEZ_PAY_TYPES value
    payToken,          // 'BEZ', 'USDT', 'USDC', 'MATIC', 'ETH', 'USD', 'EUR'
    amount,            // Cantidad en USD (base)
    walletAddress,     // Override de address para fiat
    // Escrow-specific
    clientWallet,
    collateral,
    quality,
    // Farming-specific
    poolId,
    lockDays,
    amountBEZ,
    // Subscription-specific
    planId,
    // Metadata
    metadata = {},
  }) => {
    if (!isConnected && !['USD', 'EUR'].includes(payToken)) {
      throw new Error('Wallet no conectada');
    }

    resetAll();
    const userAddr = address || walletAddress;

    try {
      let result;

      // FIAT → devolver datos bancarios (no hay TX on-chain)
      if (['USD', 'EUR'].includes(payToken)) {
        return { fiat: true, currency: payToken };
      }

      // ESCROW
      if (type === 'escrow') {
        result = await createEscrow({
          clientWallet,
          collateralBEZ: collateral || amount,
          quality: quality || 85,
        });
        setTxResult({ ...result, type });
        setTxState(TX_STATE.SUCCESS);
        return result;
      }

      // FARMING DEPOSIT
      if (type === 'farming') {
        result = await depositFarming({
          pid: poolId ?? 0,
          amountBEZ: amountBEZ || amount,
          lockDays: lockDays ?? 30,
        });
        setTxResult({ ...result, type });
        setTxState(TX_STATE.SUCCESS);
        return result;
      }

      // NATIVO (MATIC / ETH) → transfer directo al treasury
      if (['MATIC', 'ETH'].includes(payToken)) {
        // Calcular monto en la moneda nativa desde el valor USD
        // En prod: usar precio oracle. Por ahora: pasamos el amount directamente
        result = await sendNativePayment({
          amountEther: String(amount),
          to: CONTRACTS.TREASURY,
          meta: { type, planId, walletAddress: userAddr, ...metadata },
        });
        setTxResult({ ...result, type });
        setTxState(TX_STATE.SUCCESS);
        return result;
      }

      // ERC-20 CON HOT WALLET (USDT, USDC, BEZ → compra BEZ vía backend)
      // El backend recibe USD value, devuelve la dirección y el monto exacto del token
      result = await sendHotWalletPayment({
        payToken,
        amountUSD: amount,
        walletAddress: userAddr,
        planId,
        poolId,
        lockDays,
        type,
        meta: metadata,
      });

      setTxResult({ ...result, type });
      setTxState(TX_STATE.SUCCESS);
      return result;

    } catch (err) {
      const errMsg = err?.shortMessage || err?.message || 'Error desconocido';
      setTxError(errMsg);
      setTxState(TX_STATE.ERROR);
      log(`❌ Error: ${errMsg}`, 'error');
      throw err;
    }
  }, [address, isConnected, chainId, writeContractAsync, sendTransactionAsync]);

  // ── BEZ BALANCE READER ────────────────────────────────────────────────────
  // Leer balance BEZ real del usuario
  const { data: bezBalanceRaw, refetch: refetchBezBalance } = useReadContract({
    address: CONTRACTS.BEZ_POLYGON,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: !!address, staleTime: 10_000 },
  });

  const bezBalance = bezBalanceRaw ? formatUnits(bezBalanceRaw, 18) : '0';

  // ── ENSURE POLYGON ────────────────────────────────────────────────────────
  const ensurePolygon = useCallback(async () => {
    if (chainId !== 137 && chainId !== 80002) {
      try {
        await switchChain({ chainId: 137 }); // Polygon Mainnet
        return true;
      } catch (err) {
        log('Cambia manualmente a Polygon Mainnet', 'warn');
        return false;
      }
    }
    return true;
  }, [chainId, switchChain]);

  return {
    // Actions
    executePayment,
    resetAll,
    ensurePolygon,
    refetchBezBalance,
    // State
    txState,
    txHash,
    txResult,
    txError,
    txLogs,
    // Wagmi state
    isProcessing: [
      TX_STATE.APPROVING,
      TX_STATE.TRANSACTING,
      TX_STATE.CONFIRMING,
      TX_STATE.NOTIFYING,
    ].includes(txState),
    isSuccess:    txState === TX_STATE.SUCCESS,
    isError:      txState === TX_STATE.ERROR,
    isIdle:       txState === TX_STATE.IDLE,
    // Wallet info
    address,
    isConnected,
    chainId,
    bezBalance,
    // Constants
    CONTRACTS,
    TX_STATE,
    TOKEN_ADDRESSES_MAP: {
      USDT: CONTRACTS.USDT_POLYGON,
      USDC: CONTRACTS.USDC_POLYGON,
      BEZ:  CONTRACTS.BEZ_POLYGON,
    },
  };
}
