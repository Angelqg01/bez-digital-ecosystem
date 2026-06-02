/**
 * BeZhasPaymentGateway.jsx
 * UI completa del procesador de pagos BeZhas
 * Dark luxury · Teal/Gold/Pink · BEZ-Coin native
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useBeZhasPayment, PAYMENT_STATUS } from '../hooks/useBeZhasPayment';
import { formatUnits } from 'viem';

// ─── Estilos inline (sin dependencia Tailwind) ─────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');

  :root {
    --bez-bg:       #060810;
    --bez-surface:  #0d1117;
    --bez-border:   #1a2332;
    --bez-gold:     #c9a84c;
    --bez-teal:     #00d4aa;
    --bez-pink:     #ff6b9d;
    --bez-text:     #e8eaf0;
    --bez-muted:    #5a6478;
    --bez-success:  #00d4aa;
    --bez-error:    #ff4757;
    --bez-warning:  #ffa502;
  }

  .bezpay-root {
    font-family: 'Syne', sans-serif;
    background: var(--bez-bg);
    color: var(--bez-text);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .bezpay-card {
    background: var(--bez-surface);
    border: 1px solid var(--bez-border);
    border-radius: 20px;
    width: 100%;
    max-width: 480px;
    overflow: hidden;
    box-shadow: 0 0 60px rgba(0,212,170,0.06), 0 0 120px rgba(201,168,76,0.04);
  }

  .bezpay-header {
    padding: 28px 28px 20px;
    border-bottom: 1px solid var(--bez-border);
    background: linear-gradient(135deg, rgba(0,212,170,0.04) 0%, rgba(201,168,76,0.04) 100%);
  }

  .bezpay-logo-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .bezpay-coin {
    width: 40px;
    height: 40px;
  }

  .bezpay-brand {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .bezpay-brand span { color: var(--bez-teal); }

  .bezpay-subtitle {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: var(--bez-muted);
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .bezpay-body { padding: 24px 28px; }

  .bezpay-balance-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(0,212,170,0.08);
    border: 1px solid rgba(0,212,170,0.2);
    border-radius: 100px;
    padding: 6px 14px;
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    color: var(--bez-teal);
    margin-bottom: 24px;
  }

  .bezpay-balance-chip::before {
    content: '';
    width: 8px; height: 8px;
    background: var(--bez-teal);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.8); }
  }

  .bezpay-field { margin-bottom: 20px; }

  .bezpay-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--bez-muted);
    margin-bottom: 8px;
  }

  .bezpay-input {
    width: 100%;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--bez-border);
    border-radius: 12px;
    padding: 14px 16px;
    font-family: 'Space Mono', monospace;
    font-size: 13px;
    color: var(--bez-text);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }

  .bezpay-input:focus {
    border-color: var(--bez-teal);
    box-shadow: 0 0 0 3px rgba(0,212,170,0.1);
  }

  .bezpay-amount-wrapper {
    position: relative;
  }

  .bezpay-amount-wrapper .bezpay-input {
    padding-right: 64px;
    font-size: 20px;
    font-weight: 700;
  }

  .bezpay-amount-suffix {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    color: var(--bez-gold);
    letter-spacing: 1px;
  }

  .bezpay-quick-amounts {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .bezpay-quick-btn {
    flex: 1;
    background: rgba(201,168,76,0.08);
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 8px;
    padding: 6px;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: var(--bez-gold);
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }

  .bezpay-quick-btn:hover {
    background: rgba(201,168,76,0.16);
    border-color: var(--bez-gold);
  }

  .bezpay-network-row {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .bezpay-net-chip {
    flex: 1;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid var(--bez-border);
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
    font-size: 12px;
    font-weight: 600;
  }

  .bezpay-net-chip.active {
    border-color: var(--bez-teal);
    background: rgba(0,212,170,0.08);
    color: var(--bez-teal);
  }

  .bezpay-net-chip:not(.active) { color: var(--bez-muted); }

  .bezpay-crosschain {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(255,107,157,0.06);
    border: 1px solid rgba(255,107,157,0.2);
    border-radius: 10px;
    margin-bottom: 20px;
    cursor: pointer;
  }

  .bezpay-toggle {
    width: 36px; height: 20px;
    background: var(--bez-border);
    border-radius: 100px;
    position: relative;
    transition: background 0.2s;
  }

  .bezpay-toggle.on { background: var(--bez-pink); }

  .bezpay-toggle::after {
    content: '';
    position: absolute;
    width: 14px; height: 14px;
    background: white;
    border-radius: 50%;
    top: 3px; left: 3px;
    transition: left 0.2s;
  }

  .bezpay-toggle.on::after { left: 19px; }

  .bezpay-crosschain-label {
    flex: 1;
    font-size: 12px;
    color: var(--bez-text);
  }

  .bezpay-crosschain-label small {
    display: block;
    font-size: 10px;
    color: var(--bez-muted);
    margin-top: 2px;
  }

  .bezpay-fee-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 12px;
    color: var(--bez-muted);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .bezpay-fee-row:last-child { border: none; }
  .bezpay-fee-row span:last-child { color: var(--bez-text); font-family: 'Space Mono', monospace; }

  .bezpay-fees { margin-bottom: 24px; }

  .bezpay-submit {
    width: 100%;
    padding: 18px;
    border-radius: 14px;
    border: none;
    font-family: 'Syne', sans-serif;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }

  .bezpay-submit:not(:disabled) {
    background: linear-gradient(135deg, var(--bez-teal) 0%, #00a884 100%);
    color: #060810;
    box-shadow: 0 8px 24px rgba(0,212,170,0.3);
  }

  .bezpay-submit:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 32px rgba(0,212,170,0.4);
  }

  .bezpay-submit:not(:disabled):active { transform: translateY(0); }

  .bezpay-submit:disabled {
    background: var(--bez-border);
    color: var(--bez-muted);
    cursor: not-allowed;
  }

  .bezpay-submit-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .bezpay-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(6,8,16,0.3);
    border-top-color: #060810;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .bezpay-status-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: var(--bez-surface);
    z-index: 10;
    padding: 32px;
    text-align: center;
  }

  .bezpay-status-icon {
    width: 72px; height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
  }

  .bezpay-status-icon.success { background: rgba(0,212,170,0.12); }
  .bezpay-status-icon.failed  { background: rgba(255,71,87,0.12); }
  .bezpay-status-icon.pending {
    background: rgba(201,168,76,0.12);
    border: 2px solid var(--bez-gold);
    animation: spin 2s linear infinite;
  }

  .bezpay-status-title {
    font-size: 20px;
    font-weight: 800;
    margin: 0;
  }

  .bezpay-status-title.success { color: var(--bez-teal); }
  .bezpay-status-title.failed  { color: var(--bez-error); }

  .bezpay-tx-link {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: var(--vez-gold);
    text-decoration: none;
    background: rgba(201,168,76,0.08);
    border: 1px solid rgba(201,168,76,0.2);
    padding: 8px 16px;
    border-radius: 8px;
    display: inline-block;
    margin-top: 4px;
    color: var(--bez-gold);
  }

  .bezpay-tx-link:hover { background: rgba(201,168,76,0.16); }

  .bezpay-reset-btn {
    background: none;
    border: 1px solid var(--bez-border);
    color: var(--bez-muted);
    border-radius: 10px;
    padding: 10px 24px;
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    margin-top: 8px;
  }

  .bezpay-reset-btn:hover { color: var(--bez-text); border-color: var(--bez-muted); }

  .bezpay-error-msg {
    background: rgba(255,71,87,0.08);
    border: 1px solid rgba(255,71,87,0.2);
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 12px;
    color: var(--bez-error);
    margin-bottom: 16px;
  }

  .bezpay-step-bar {
    display: flex;
    gap: 4px;
    padding: 0 28px 20px;
  }

  .bezpay-step {
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: var(--bez-border);
    transition: background 0.3s;
  }

  .bezpay-step.done    { background: var(--bez-teal); }
  .bezpay-step.active  { background: var(--bez-gold); animation: shimmer 1.5s infinite; }

  @keyframes shimmer {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }

  .bezpay-fiat-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .bezpay-fiat-tab {
    flex: 1;
    padding: 10px 8px;
    border-radius: 10px;
    border: 1px solid var(--bez-border);
    background: none;
    color: var(--bez-muted);
    font-family: 'Syne', sans-serif;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .bezpay-fiat-tab.active {
    border-color: var(--bez-gold);
    background: rgba(201,168,76,0.08);
    color: var(--bez-gold);
  }

  .bezpay-divider {
    border: none;
    border-top: 1px solid var(--bez-border);
    margin: 20px 0;
  }

  .bezpay-connect-wrapper {
    padding: 24px;
    text-align: center;
  }

  .bezpay-connect-msg {
    font-size: 13px;
    color: var(--bez-muted);
    margin-bottom: 16px;
  }
`;

// ─── Componente SVG del BEZ Coin ──────────────────────────────────────────
const BEZCoinIcon = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="bezpay-coin">
    <circle cx="20" cy="20" r="19" fill="#0d1117" stroke="url(#bezGold)" strokeWidth="1.5"/>
    <defs>
      <linearGradient id="bezGold" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#c9a84c"/>
        <stop offset="1" stopColor="#00d4aa"/>
      </linearGradient>
      <linearGradient id="bezTeal" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00d4aa"/>
        <stop offset="1" stopColor="#ff6b9d"/>
      </linearGradient>
    </defs>
    {/* Yin-yang swirl BEZ logo */}
    <path d="M20 8 C20 8, 26 14, 20 20 C14 26, 20 32, 20 32" stroke="url(#bezTeal)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <circle cx="20" cy="14" r="2" fill="#00d4aa"/>
    <circle cx="20" cy="26" r="2" fill="#ff6b9d"/>
    <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="url(#bezGold)" fontSize="7" fontWeight="800" fontFamily="'Syne',sans-serif" dy="1">BEZ</text>
  </svg>
);

// ─── Utilidades ──────────────────────────────────────────────────────────────
const FIAT_PROVIDERS = [
  { id: 'moonpay',  label: 'MoonPay',  url: (addr, amt) => `https://buy.moonpay.com?walletAddress=${addr}&currencyCode=BEZ&baseCurrencyAmount=${amt}` },
  { id: 'transak',  label: 'Transak',  url: (addr, amt) => `https://global.transak.com?walletAddress=${addr}&cryptocurrency=BEZ&fiatAmount=${amt}` },
  { id: 'ramp',     label: 'Ramp',     url: (addr, amt) => `https://app.ramp.network?userAddress=${addr}&swapAsset=BEZ&fiatValue=${amt}` },
];

const QUICK_AMOUNTS = [10, 50, 100, 500];

function getStepIndex(status) {
  const steps = [PAYMENT_STATUS.APPROVING, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.CONFIRMING, PAYMENT_STATUS.SUCCESS];
  return steps.indexOf(status);
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function BeZhasPaymentGateway({
  recipientAddress = '',
  orderId           = '',
  defaultAmount     = '',
  onSuccess,
  onError,
  showFiatOnRamp    = true,
  showCrossChain    = true,
  className         = '',
}) {
  const {
    status, txHash, receipt, error,
    gasEstimate, explorerUrl,
    isLoading, isSuccess, isFailed,
    bezBalance, isConnected, walletAddress,
    chainId, processPayment, reset,
  } = useBeZhasPayment();

  const [amount,      setAmount]      = useState(defaultAmount);
  const [recipient,   setRecipient]   = useState(recipientAddress);
  const [memo,        setMemo]        = useState('');
  const [crossChain,  setCrossChain]  = useState(false);
  const [targetChain, setTargetChain] = useState(137);
  const [fiatTab,     setFiatTab]     = useState('moonpay');
  const [mode,        setMode]        = useState('crypto'); // 'crypto' | 'fiat'

  // Sync propiedades externas
  useEffect(() => { if (recipientAddress) setRecipient(recipientAddress); }, [recipientAddress]);
  useEffect(() => { if (defaultAmount)    setAmount(defaultAmount); }, [defaultAmount]);

  // Callbacks
  useEffect(() => {
    if (isSuccess && onSuccess) onSuccess({ txHash, receipt });
    if (isFailed  && onError)   onError(error);
  }, [isSuccess, isFailed]);

  const handleSubmit = useCallback(async () => {
    if (!amount || !recipient) return;
    try {
      await processPayment({
        recipient,
        amount: parseFloat(amount),
        orderId: orderId || `bezpay-${Date.now()}`,
        memo,
        crossChain,
        targetChain: crossChain ? targetChain : undefined,
      });
    } catch { /* error handled by hook */ }
  }, [amount, recipient, orderId, memo, crossChain, targetChain, processPayment]);

  const canSubmit = !isLoading && isConnected && amount && recipient &&
                    parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(bezBalance);

  const stepIdx = getStepIndex(status);

  const networkLabel = {
    56: 'BNB Chain', 97: 'BSC Testnet', 137: 'Polygon', 80001: 'Mumbai'
  }[chainId] || `Chain ${chainId}`;

  return (
    <>
      <style>{CSS}</style>
      <div className={`bezpay-root ${className}`}>
        <div className="bezpay-card" style={{ position: 'relative' }}>

          {/* ── HEADER ── */}
          <div className="bezpay-header">
            <div className="bezpay-logo-row">
              <BEZCoinIcon size={40} />
              <div>
                <div className="bezpay-brand">Be<span>Zhas</span> Pay</div>
              </div>
            </div>
            <div className="bezpay-subtitle">Native BEZ-Coin Payment Gateway · {networkLabel}</div>
          </div>

          {/* ── STEP BAR ── */}
          {isLoading && (
            <div className="bezpay-step-bar">
              {['Aprobar', 'Enviar', 'Confirmar', 'Listo'].map((label, i) => (
                <div
                  key={i}
                  className={`bezpay-step ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`}
                  title={label}
                />
              ))}
            </div>
          )}

          {/* ── BODY ── */}
          <div className="bezpay-body">

            {/* Wallet no conectada */}
            {!isConnected ? (
              <div className="bezpay-connect-wrapper">
                <div className="bezpay-connect-msg">Conecta tu wallet para pagar con BEZ-Coin</div>
                <ConnectButton />
              </div>
            ) : (
              <>
                {/* Balance */}
                <div className="bezpay-balance-chip">
                  {parseFloat(bezBalance).toLocaleString('es-ES', { maximumFractionDigits: 2 })} BEZ disponible
                </div>

                {/* Tabs crypto / fiat */}
                {showFiatOnRamp && (
                  <div className="bezpay-fiat-tabs">
                    <button className={`bezpay-fiat-tab ${mode === 'crypto' ? 'active' : ''}`} onClick={() => setMode('crypto')}>
                      🔷 Crypto BEZ
                    </button>
                    <button className={`bezpay-fiat-tab ${mode === 'fiat' ? 'active' : ''}`} onClick={() => setMode('fiat')}>
                      💳 Fiat → BEZ
                    </button>
                  </div>
                )}

                {/* ── MODO CRYPTO ── */}
                {mode === 'crypto' && (
                  <>
                    {/* Recipient */}
                    {!recipientAddress && (
                      <div className="bezpay-field">
                        <label className="bezpay-label">Dirección Receptora</label>
                        <input
                          className="bezpay-input"
                          placeholder="0x..."
                          value={recipient}
                          onChange={e => setRecipient(e.target.value)}
                        />
                      </div>
                    )}

                    {/* Amount */}
                    <div className="bezpay-field">
                      <label className="bezpay-label">Cantidad BEZ</label>
                      <div className="bezpay-amount-wrapper">
                        <input
                          className="bezpay-input"
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          min="0"
                        />
                        <span className="bezpay-amount-suffix">BEZ</span>
                      </div>
                      <div className="bezpay-quick-amounts">
                        {QUICK_AMOUNTS.map(q => (
                          <button key={q} className="bezpay-quick-btn" onClick={() => setAmount(q.toString())}>
                            {q}
                          </button>
                        ))}
                        <button className="bezpay-quick-btn" onClick={() => setAmount(bezBalance)}>
                          MAX
                        </button>
                      </div>
                    </div>

                    {/* Memo */}
                    <div className="bezpay-field">
                      <label className="bezpay-label">Nota / Referencia (opcional)</label>
                      <input
                        className="bezpay-input"
                        placeholder="Descripción del pago..."
                        value={memo}
                        onChange={e => setMemo(e.target.value)}
                        maxLength={100}
                      />
                    </div>

                    {/* Cross-chain toggle */}
                    {showCrossChain && (
                      <div className="bezpay-crosschain" onClick={() => setCrossChain(v => !v)}>
                        <div className={`bezpay-toggle ${crossChain ? 'on' : ''}`} />
                        <div className="bezpay-crosschain-label">
                          Pago Cross-Chain
                          <small>BSC ↔ Polygon via LayerZero Bridge</small>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--bez-pink)' }}>
                          {crossChain ? (targetChain === 137 ? 'Polygon' : 'BSC') : 'Off'}
                        </span>
                      </div>
                    )}

                    {/* Fee summary */}
                    {amount && parseFloat(amount) > 0 && (
                      <div className="bezpay-fees">
                        <div className="bezpay-fee-row">
                          <span>Subtotal</span>
                          <span>{parseFloat(amount).toFixed(2)} BEZ</span>
                        </div>
                        <div className="bezpay-fee-row">
                          <span>Comisión plataforma</span>
                          <span>{(parseFloat(amount) * 0.001).toFixed(4)} BEZ (0.1%)</span>
                        </div>
                        {crossChain && (
                          <div className="bezpay-fee-row">
                            <span>Bridge fee (LayerZero)</span>
                            <span>~0.002 BNB</span>
                          </div>
                        )}
                        <div className="bezpay-fee-row" style={{ color: 'var(--bez-gold)' }}>
                          <span style={{ fontWeight: 600 }}>Total</span>
                          <span style={{ fontWeight: 700, color: 'var(--bez-gold)' }}>
                            {(parseFloat(amount) * 1.001).toFixed(4)} BEZ
                          </span>
                        </div>
                        {gasEstimate && (
                          <div className="bezpay-fee-row">
                            <span>Gas estimado</span>
                            <span>{gasEstimate.toString()} units</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    {error && <div className="bezpay-error-msg">⚠ {error}</div>}

                    {/* Submit */}
                    <button
                      className="bezpay-submit"
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                    >
                      <div className="bezpay-submit-inner">
                        {isLoading ? (
                          <>
                            <div className="bezpay-spinner" />
                            {status === PAYMENT_STATUS.APPROVING  && 'Aprobando BEZ...'}
                            {status === PAYMENT_STATUS.PENDING    && 'Enviando transacción...'}
                            {status === PAYMENT_STATUS.CONFIRMING && 'Confirmando en blockchain...'}
                          </>
                        ) : (
                          <>
                            <span>⬡</span>
                            {crossChain ? `Pago Cross-Chain · ${parseFloat(amount || 0).toFixed(2)} BEZ` : `Pagar ${parseFloat(amount || 0).toFixed(2)} BEZ`}
                          </>
                        )}
                      </div>
                    </button>
                  </>
                )}

                {/* ── MODO FIAT ── */}
                {mode === 'fiat' && (
                  <>
                    <div className="bezpay-field">
                      <label className="bezpay-label">Importe en Fiat (EUR/USD)</label>
                      <div className="bezpay-amount-wrapper">
                        <input
                          className="bezpay-input"
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                        />
                        <span className="bezpay-amount-suffix">EUR</span>
                      </div>
                    </div>

                    <div className="bezpay-fiat-tabs" style={{ marginBottom: 20 }}>
                      {FIAT_PROVIDERS.map(p => (
                        <button
                          key={p.id}
                          className={`bezpay-fiat-tab ${fiatTab === p.id ? 'active' : ''}`}
                          onClick={() => setFiatTab(p.id)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <button
                      className="bezpay-submit"
                      disabled={!amount || parseFloat(amount) <= 0}
                      onClick={() => {
                        const provider = FIAT_PROVIDERS.find(p => p.id === fiatTab);
                        if (provider && walletAddress) {
                          window.open(provider.url(walletAddress, amount), '_blank');
                        }
                      }}
                    >
                      <div className="bezpay-submit-inner">
                        💳 Comprar BEZ con {FIAT_PROVIDERS.find(p => p.id === fiatTab)?.label}
                      </div>
                    </button>

                    <p style={{ fontSize: 10, color: 'var(--bez-muted)', marginTop: 12, textAlign: 'center' }}>
                      Serás redirigido a {FIAT_PROVIDERS.find(p => p.id === fiatTab)?.label} para completar la compra.
                      Los BEZ se enviarán directamente a tu wallet.
                    </p>
                  </>
                )}
              </>
            )}
          </div>

          {/* ── OVERLAY DE ESTADO ── */}
          {(isSuccess || (isFailed && txHash)) && (
            <div className="bezpay-status-overlay">
              <div className={`bezpay-status-icon ${isSuccess ? 'success' : 'failed'}`}>
                {isSuccess ? '✓' : '✗'}
              </div>
              <p className={`bezpay-status-title ${isSuccess ? 'success' : 'failed'}`}>
                {isSuccess ? '¡Pago completado!' : 'Transacción fallida'}
              </p>
              {isSuccess && (
                <p style={{ fontSize: 12, color: 'var(--bez-muted)', margin: '4px 0' }}>
                  {amount} BEZ enviado a {recipient?.slice(0,6)}...{recipient?.slice(-4)}
                </p>
              )}
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noreferrer" className="bezpay-tx-link">
                  Ver en Explorer →
                </a>
              )}
              {txHash && (
                <p style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--bez-muted)', wordBreak: 'break-all', maxWidth: 320 }}>
                  {txHash}
                </p>
              )}
              <button className="bezpay-reset-btn" onClick={reset}>
                Nuevo pago
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
