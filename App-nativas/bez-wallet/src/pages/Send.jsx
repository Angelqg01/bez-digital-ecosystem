import React, { useState } from 'react';
import { useBEZBalance, useSmartWallet } from '@bezhas/platform-sdk/wallet';
import { C, Card, Btn, Input, StatusBadge, Chip } from '../components/ui/DesignSystem';

export default function Send() {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState('form'); // form | confirm | success
  
  // Custom SDK Hooks
  const { formatted: balance, usd_value: usdBalance, isLoading: isBalanceLoading, refresh } = useBEZBalance();
  const { sendBEZ, isPending } = useSmartWallet();

  const usdRate = balance > 0 ? (usdBalance / balance) : 0.07; // Dynamic or fallback rate
  const estimatedUsd = (parseFloat(amount) || 0) * usdRate;
  
  // Real limits and validation
  const maxBalance = balance || 0;
  const isValid = recipient.startsWith('0x') && recipient.length === 42 && parseFloat(amount) > 0 && parseFloat(amount) <= maxBalance;

  if (step === 'success') {
    return (
      <div>
        <div className="page-header animate-in">
          <h1 className="page-title">Transaction Sent ✅</h1>
        </div>
        <Card glow color={C.primary} style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '3rem 2rem' }} className="animate-in-delay-1">
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: C.primary }}>{amount} BEZ Sent</h2>
          <p style={{ color: C.muted, fontFamily: C.mono, fontSize: '0.85rem' }}>
            To: {recipient.slice(0, 6)}...{recipient.slice(-4)}
          </p>
          <p style={{ color: C.muted, fontSize: '0.8rem', marginTop: '1rem' }}>
            Gas paid via Corporate Gas Tank · $0.003
          </p>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Btn variant="outline" color={C.muted} onClick={() => { setStep('form'); setAmount(''); setRecipient(''); }}>
              Send More
            </Btn>
            <Btn variant="fill" color={C.primary} onClick={() => window.location.href = '/'}>
              Dashboard
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div>
        <div className="page-header animate-in">
          <h1 className="page-title">Confirm Transaction</h1>
        </div>
        <Card style={{ maxWidth: 520, margin: '0 auto', padding: '2rem' }} className="animate-in-delay-1">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', fontFamily: C.mono, fontWeight: 800, color: C.gold }}>
              {parseFloat(amount).toLocaleString()} BEZ
            </div>
            <div style={{ color: C.muted, fontFamily: C.mono, fontSize: '0.9rem' }}>
              ≈ ${estimatedUsd.toFixed(2)} USD
            </div>
          </div>

          <div style={{ background: C.card2, borderRadius: 12, padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: C.muted, fontSize: '0.8rem' }}>Recipient</span>
              <span style={{ fontFamily: C.mono, fontSize: '0.8rem', color: C.text }}>
                {recipient.slice(0, 10)}...{recipient.slice(-6)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: C.muted, fontSize: '0.8rem' }}>Network</span>
              <span style={{ fontSize: '0.8rem', color: C.text }}>BeZhas L2 (Chain 2708)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: C.muted, fontSize: '0.8rem' }}>Gas Fee</span>
              <span style={{ fontSize: '0.8rem', color: C.primary }}>~$0.003 (Gas Tank)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted, fontSize: '0.8rem' }}>Speed</span>
              <span style={{ fontSize: '0.8rem', color: C.text }}>~2 seconds</span>
            </div>
          </div>

          <Btn full size="lg" color={C.gold} disabled={isPending} onClick={async () => {
            try {
              await sendBEZ(recipient, amount);
              refresh();
              setStep('success');
            } catch (err) {
              console.error("Error enviando BEZ:", err);
              alert("Error en la transacción. Revisa la consola o asegúrate de que el Gas Tank tenga fondos.");
            }
          }}>
            {isPending ? 'Processing via Paymaster...' : 'Confirm & Send'}
          </Btn>
          <Btn
            variant="outline"
            color={C.muted}
            full
            style={{ marginTop: '0.75rem' }}
            onClick={() => setStep('form')}
          >
            ← Back
          </Btn>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Send BEZ</h1>
        <p className="page-subtitle">Transfer BEZ-Coin a cualquier dirección · Gas abstracto via Gas Tank</p>
      </div>

      <div className="form-section animate-in-delay-1">
        <Card style={{ padding: '2rem' }}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'block' }}>Recipient Address</label>
            <input
              style={{ width: '100%', background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 11, fontFamily: C.mono, outline: 'none', boxSizing: 'border-box' }}
              type="text"
              placeholder="0x..."
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
            />
            <div style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>Wallet address o DID (did:bezhas:0x...)</div>
          </div>

          <div className="form-group">
            <Input 
              value={amount} 
              onChange={setAmount} 
              label="Amount (BEZ)" 
              sym="BEZ" 
              usd={estimatedUsd} 
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <span className="form-hint">≈ ${estimatedUsd.toFixed(2)} USD</span>
              <span style={{ color: C.muted, fontSize: 11 }}>
                Balance: {isBalanceLoading ? '...' : maxBalance.toLocaleString()} BEZ
                <button
                  style={{
                    background: 'none', border: 'none', color: C.primary,
                    cursor: 'pointer', marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 600
                  }}
                  onClick={() => setAmount(String(maxBalance))}
                >
                  MAX
                </button>
              </span>
            </div>
          </div>

          <div style={{
            padding: '0.75rem 1rem', background: `${C.primary}22`, color: C.primary,
            borderRadius: 12, marginBottom: '1.5rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', border: `1px solid ${C.primary}44`
          }}>
            <span>⛽</span>
            <span>Gas Fee: ~$0.003 · Paid from Corporate Gas Tank</span>
          </div>

          <Btn full size="lg" color={C.gold} disabled={!isValid} onClick={() => setStep('confirm')}>
            {!recipient ? 'Enter recipient address' :
             !amount || parseFloat(amount) <= 0 ? 'Enter amount' :
             parseFloat(amount) > maxBalance ? 'Insufficient balance' :
             `Send ${parseFloat(amount).toLocaleString()} BEZ →`}
          </Btn>
        </Card>
      </div>
    </div>
  );
}
