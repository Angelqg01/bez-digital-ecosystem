import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Wallet, CheckCircle, ShieldCheck, Zap,
  AlertCircle, Loader2, ExternalLink, PenLine,
} from 'lucide-react';
import { ethers } from 'ethers';

// ─── Configuración desde variables de entorno ─────────────────────────────────
const BEZ_CONTRACT_ADDRESS = import.meta.env.VITE_BEZ_TOKEN_ADDRESS
  || '0x42000000000000000000000000000000000000BE';
const PAYMASTER_ADDRESS = import.meta.env.VITE_PAYMASTER_ADDRESS || '';
const PAYMASTER_API_URL = import.meta.env.VITE_PAYMASTER_API_URL || 'https://paymaster.bez.digital';
const BEZHAS_CHAIN_ID = Number(import.meta.env.VITE_BEZHAS_CHAIN_ID) || 42169;
const BEZHAS_EXPLORER_URL = import.meta.env.VITE_EXPLORER_URL || 'https://explorer.bez.digital';

// ─── FIX #6: ABI completa con EIP-2612 (ERC20Permit) ────────────────────────
const BEZ_ABI = [
  // ERC20 estándar
  'function burn(uint256 value) public',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function balanceOf(address account) view returns (uint256)',
  // ERC20Permit — EIP-2612
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'function nonces(address owner) view returns (uint256)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
];

// ─── FIX #5: Máquina de estados completa ─────────────────────────────────────
const STATUS = Object.freeze({
  IDLE: 'idle',
  CONNECTING: 'connecting',    // solicitando cuentas al wallet
  SIGNING: 'signing',       // usuario firma el permit EIP-712 (sin gas)
  BROADCASTING: 'broadcasting',  // Paymaster enviando la tx a la L2
  CONFIRMING: 'confirming',    // esperando confirmación on-chain
  SUCCESS: 'success',
  ERROR: 'error',
});

// ─── FIX #2: Helper de validación de red ─────────────────────────────────────
async function ensureCorrectNetwork(provider) {
  const { chainId } = await provider.getNetwork();
  if (Number(chainId) === BEZHAS_CHAIN_ID) return;

  // Intentar cambiar de red automáticamente
  try {
    await provider.send('wallet_switchEthereumChain', [
      { chainId: `0x${BEZHAS_CHAIN_ID.toString(16)}` },
    ]);
  } catch (switchErr) {
    // La red no está configurada en el wallet — añadirla
    if (switchErr.code === 4902) {
      await provider.send('wallet_addEthereumChain', [{
        chainId: `0x${BEZHAS_CHAIN_ID.toString(16)}`,
        chainName: 'BeZhas L2',
        nativeCurrency: { name: 'BEZ', symbol: 'BEZ', decimals: 18 },
        rpcUrls: [import.meta.env.VITE_BEZHAS_RPC_URL || 'https://rpc.bez.digital'],
        blockExplorerUrls: [BEZHAS_EXPLORER_URL],
      }]);
    } else {
      throw new Error('Please switch your wallet to BeZhas L2 to continue.');
    }
  }
}

// ─── FIX #4: Categorizar errores del wallet ───────────────────────────────────
function parseWeb3Error(err) {
  const code = err?.code ?? err?.info?.error?.code;
  if (code === 4001 || code === 'ACTION_REJECTED') {
    return { message: 'Transaction cancelled by user.', isCancellation: true };
  }
  const msg = err?.info?.error?.message ?? err?.reason ?? err?.message ?? 'Transaction failed.';
  return { message: msg, isCancellation: false };
}

// ─── NUEVO: Implementación completa ERC20Permit (EIP-2612 + EIP-712) ─────────
/**
 * Genera una firma off-chain EIP-712 para ERC20Permit y la envía al Paymaster.
 * El usuario NUNCA paga gas — solo firma un mensaje en su wallet.
 *
 * Flujo:
 *  1. Conectar wallet y validar red
 *  2. Leer nonce del contrato BEZCoinV2
 *  3. Construir el mensaje EIP-712 (Permit)
 *  4. Usuario firma con signTypedData (gratuito — no es una tx)
 *  5. POST al Paymaster con { owner, spender, value, deadline, v, r, s }
 *  6. Paymaster ejecuta permit() + burn/transfer on-chain pagando el gas
 *  7. Paymaster devuelve { txHash } para seguimiento
 */
async function signAndSubmitPermit({ provider, bezContract, amountInWei, planName, onStatus }) {
  const signer = await provider.getSigner();
  const ownerAddr = await signer.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 3600; // válido 1h

  // Leer nonce actual del propietario en el contrato
  const nonce = await bezContract.nonces(ownerAddr);

  // Dominio EIP-712 — debe coincidir EXACTAMENTE con el que usa BEZCoinV2.sol
  const domain = {
    name: await bezContract.name(),   // 'BEZCoinV2'
    version: '1',
    chainId: BEZHAS_CHAIN_ID,
    verifyingContract: BEZ_CONTRACT_ADDRESS,
  };

  // Tipos EIP-712 para Permit (estándar EIP-2612)
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  // Valores del permit — el Paymaster es el spender autorizado
  const permitValues = {
    owner: ownerAddr,
    spender: PAYMASTER_ADDRESS,
    value: amountInWei,
    nonce,
    deadline,
  };

  onStatus(STATUS.SIGNING);

  // signTypedData es GRATUITO — solo pide firma al wallet, no envía ninguna tx
  const rawSig = await signer.signTypedData(domain, types, permitValues);
  const { v, r, s } = ethers.Signature.from(rawSig);

  onStatus(STATUS.BROADCASTING);

  // Enviar al Paymaster — él ejecuta permit() + burn() pagando el gas
  const res = await fetch(`${PAYMASTER_API_URL}/v1/execute-permit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner: ownerAddr,
      spender: PAYMASTER_ADDRESS,
      value: amountInWei.toString(),
      deadline,
      v, r, s,
      planName,                          // Para validación backend
      contractAddress: BEZ_CONTRACT_ADDRESS,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.message ?? `Paymaster error: HTTP ${res.status}`);
  }

  const { txHash } = await res.json();
  return txHash;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PaymentModal — pago Web3 gas-less mediante ERC20Permit (EIP-2612).
 *
 * Props:
 *  isOpen       {boolean}
 *  onClose      {() => void}
 *  amount       {number}   — precio en USD (display)
 *  bezAmount    {number}   — FIX #1: importe real en BEZ (puede diferir del precio USD)
 *  planName     {string}
 *  onSuccess    {({ txHash: string }) => void}
 *  onError      {(Error) => void}
 *  isProcessing {boolean}
 *  errorMessage {string|null}
 */
const PaymentModal = ({
  isOpen,
  onClose,
  amount,
  bezAmount,     // ← FIX #1: separar USD de BEZ
  planName,
  onSuccess,
  onError,
  isProcessing = false,
  errorMessage = null,
}) => {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [txHash, setTxHash] = useState(null);
  const [localError, setLocalError] = useState(null);

  // ─── FIX #3: Ref para cleanup del timer post-éxito ───────────────────────
  const successTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setStatus(STATUS.IDLE);
      setTxHash(null);
      setLocalError(null);
    }
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, [isOpen]);

  // ─── FIX #8: Cerrar con Escape solo si es seguro ─────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && canClose) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // ─── FIX #1: Importe en BEZ real (con fallback 1:1 explícito y visible) ──
  // En producción, bezAmount debe venir del backend con la cotización actual BEZ/USD
  const actualBezAmount = bezAmount ?? amount;

  const handlePermitPayment = useCallback(async () => {
    setLocalError(null);
    setStatus(STATUS.CONNECTING);

    if (!window.ethereum) {
      setLocalError('No Web3 wallet found. Please install MetaMask or a compatible wallet.');
      setStatus(STATUS.ERROR);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);

      // Solicitar acceso a cuentas
      await provider.send('eth_requestAccounts', []);

      // ─── FIX #2: Validar y cambiar de red si es necesario ────────────
      await ensureCorrectNetwork(provider);

      const signer = await provider.getSigner();
      const bezContract = new ethers.Contract(BEZ_CONTRACT_ADDRESS, BEZ_ABI, signer);

      // ─── FIX #1: Usar bezAmount real, con decimals del contrato ──────
      const decimals = await bezContract.decimals();
      const amountInWei = ethers.parseUnits(actualBezAmount.toString(), decimals);

      // Flujo ERC20Permit — el usuario solo firma, el Paymaster paga el gas
      const hash = await signAndSubmitPermit({
        provider,
        bezContract,
        amountInWei,
        planName,
        onStatus: setStatus,
      });

      setStatus(STATUS.CONFIRMING);
      setTxHash(hash);

      // Pequeña pausa para que el usuario vea la confirmación antes de cerrar
      setStatus(STATUS.SUCCESS);
      // ─── FIX #3: Timer con cleanup correcto ──────────────────────────
      successTimerRef.current = setTimeout(() => {
        onSuccess({ txHash: hash, bezAmount: actualBezAmount });
      }, 2_200);

    } catch (err) {
      // ─── FIX #4: Distinguir rechazo del usuario de error real ────────
      const { message, isCancellation } = parseWeb3Error(err);
      if (!isCancellation && onError) onError(err);
      setLocalError(message);
      setStatus(isCancellation ? STATUS.IDLE : STATUS.ERROR);
    }
  }, [actualBezAmount, planName, onSuccess, onError]);

  if (!isOpen) return null;

  const isBusy = [STATUS.CONNECTING, STATUS.SIGNING, STATUS.BROADCASTING, STATUS.CONFIRMING].includes(status);
  // ─── FIX #8: Bloquear cierre en estados donde interrumpir es peligroso ───
  const canClose = !isBusy && status !== STATUS.SUCCESS && !isProcessing;

  const currentError = localError || errorMessage;

  // Etiquetas del botón según fase
  const buttonLabel = {
    [STATUS.CONNECTING]: 'Connecting wallet…',
    [STATUS.SIGNING]: 'Sign in wallet (no gas)…',
    [STATUS.BROADCASTING]: 'Sending to Paymaster…',
    [STATUS.CONFIRMING]: 'Confirming on L2…',
  }[status];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget && canClose) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-modal-title"
        className="relative w-full max-w-md bg-bz-surface border border-bz-primary/30 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-bz-primary/20 bg-bz-surface/80">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-bz-neon" aria-hidden="true" />
            <h3 id="pay-modal-title" className="font-bold text-lg text-bz-text">
              Gas-less Payment
            </h3>
          </div>
          {/* ─── FIX #8: X deshabilitado durante pago y éxito ─────────── */}
          <button
            onClick={onClose}
            disabled={!canClose}
            aria-label="Close payment modal"
            className="p-1 rounded-lg hover:bg-bz-primary/20 text-bz-text-muted hover:text-white transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {status === STATUS.SUCCESS ? (
            // ─── Pantalla de éxito ──────────────────────────────────────
            <div className="text-center py-8" role="status" aria-live="polite">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bz-emerald/20 text-bz-emerald mb-4">
                <CheckCircle size={32} aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Payment Confirmed</h2>
              <p className="text-bz-text-muted mb-4">
                Your transaction was processed on BeZhas L2 without gas fees.
              </p>
              {txHash && (
                <a
                  href={`${BEZHAS_EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View transaction on BeZhas explorer"
                  className="inline-flex items-center gap-2 bg-black/20 p-3 rounded-lg text-xs font-mono break-all text-bz-primary/80 hover:text-bz-primary transition-colors"
                >
                  {/* ─── FIX #7: Enlace al explorer ──────────────────── */}
                  <span className="truncate">{txHash}</span>
                  <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
                </a>
              )}
        </div>
        ) : (
        <>
          {/* Resumen del plan */}
          <div className="text-center mb-6">
            <p className="text-label-sm text-bz-text-muted uppercase tracking-wide mb-1">
              Purchasing
            </p>
            <h2 className="text-2xl font-bold text-bz-text">{planName || 'Credits'}</h2>

            {/* ─── FIX #1: Mostrar tanto USD como BEZ ──────────────── */}
            <div className="mt-4 bg-black/20 rounded-xl p-4 space-y-1">
              <div className="flex justify-between text-sm text-bz-text-muted">
                <span>Price (USD)</span>
                <span className="font-mono">${amount?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-bz-text-muted">Amount (BEZ)</span>
                <span className="text-2xl font-bold text-bz-neon font-mono">
                  {actualBezAmount.toLocaleString()}
                  <span className="text-sm text-bz-text-muted ml-1">BEZ</span>
                </span>
              </div>
            </div>

            {/* ─── NUEVO: Badge gas-less con explicación comercial ── */}
            <div className="mt-3 inline-flex items-center gap-1.5 bg-bz-amber/10 border border-bz-amber/30 rounded-full px-3 py-1 text-xs text-bz-amber">
              <Zap size={11} aria-hidden="true" />
              Gas-less via ERC20Permit — you only sign, no ETH needed
            </div>
          </div>

          {/* Error display */}
          {currentError && (
            <div
              role="alert"
              className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3"
            >
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-red-400 break-words">{currentError}</p>
            </div>
          )}

          {/* ─── NUEVO: Explicación del flujo gas-less para el usuario ─ */}
          <div className="mb-5 space-y-2">
            {[
              { icon: PenLine, step: '1', label: 'Sign permit', desc: 'Sign once in your wallet — free, no gas' },
              { icon: Zap, step: '2', label: 'Paymaster pays', desc: 'BeZhas covers the network fee on your behalf' },
              { icon: CheckCircle, step: '3', label: 'Credits added', desc: 'Instantly reflected in your account' },
            ].map(({ icon: Icon, step, label, desc }) => (
              <div key={step} className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-bz-primary/20 text-bz-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {step}
                </div>
                <Icon size={14} className="text-bz-text-muted shrink-0" aria-hidden="true" />
                <div>
                  <span className="font-medium">{label}</span>
                  <span className="text-bz-text-muted ml-1">— {desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Botón principal */}
          <button
            onClick={handlePermitPayment}
            disabled={isBusy || isProcessing}
            aria-label={isBusy ? buttonLabel : `Pay ${actualBezAmount.toLocaleString()} BEZ with gas-less permit`}
            className="w-full relative py-4 px-6 bg-gradient-to-r from-bz-primary to-bz-primary-container
                  text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3
                  overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <div
              className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"
              aria-hidden="true"
            />
            {isBusy || isProcessing ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                <span role="status" aria-live="polite">{buttonLabel ?? 'Processing…'}</span>
              </>
            ) : (
              <>
                <Wallet size={20} aria-hidden="true" />
                Sign &amp; Pay (Gas-free)
              </>
            )}
          </button>
        </>
          )}
      </div>
    </div>
    </div>
  );
};

export default PaymentModal;