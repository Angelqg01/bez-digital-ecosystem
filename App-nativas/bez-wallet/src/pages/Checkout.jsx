import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBEZBalance } from '@bezhas/platform-sdk/wallet';
import { useSmartWallet } from '@bezhas/platform-sdk/wallet';
import { C, Card, Chip, Btn, StatusBadge } from '../components/ui/DesignSystem';

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const amount = searchParams.get('amount') || '0';
  const currency = searchParams.get('currency') || 'BEZ';
  const recipient = searchParams.get('recipient') || '';
  const merchant = searchParams.get('merchant') || 'Merchant';

  const { balance, usd_value } = useBEZBalance();
  const { sendBEZ } = useSmartWallet();
  const [status, setStatus] = useState('pending'); // pending, processing, completed, failed
  const [errorMsg, setErrorMsg] = useState('');
  const [txHash, setTxHash] = useState('');

  const usdTotal = parseFloat(amount) * (usd_value || 1.24);

  useEffect(() => {
    // Notify parent window that checkout is ready
    if (window.opener) {
      window.opener.postMessage({ type: 'checkout_ready' }, '*');
    }
  }, []);

  const handlePay = async () => {
    try {
      setStatus('processing');
      setErrorMsg('');

      if (!recipient) throw new Error("No recipient address provided");
      
      const tx = await sendBEZ(recipient, amount);
      setTxHash(tx.hash);
      setStatus('completed');
      
      // Notify parent window
      if (window.opener) {
        window.opener.postMessage({ 
          type: 'checkout_completed', 
          txHash: tx.hash,
          amount,
          currency
        }, '*');
        
        // Auto-close after 3 seconds
        setTimeout(() => window.close(), 3000);
      }
    } catch (error) {
      console.error("Payment failed:", error);
      setStatus('failed');
      setErrorMsg(error.message || 'Error al procesar el pago');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '1rem', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Card glow color={C.gold}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>💳</span>
          <div>
            <div style={{ color: C.gold, fontWeight: 800, fontSize: 15 }}>BEZHAS CHECKOUT</div>
            <div style={{ color: C.muted, fontSize: 10 }}>Powered by BeZhas Smart Wallet</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <Chip color={C.primary}>SECURE</Chip>
          </div>
        </div>

        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Pagando a</div>
          <div style={{ color: C.text, fontSize: 16, fontWeight: 600, marginTop: 4 }}>{merchant}</div>
          
          <div style={{ color: C.gold, fontFamily: C.mono, fontSize: 36, fontWeight: 800, margin: '1rem 0' }}>
            {amount} {currency}
          </div>
          <div style={{ color: C.muted, fontSize: 12 }}>≈ ${usdTotal.toFixed(2)} USD</div>
        </div>

        {/* Info Box */}
        <div style={{ background: `${C.gold}0a`, border: `1px solid ${C.gold}33`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              ["Tu Balance", `${balance || '0.00'} BEZ`],
              ["Fee de Red", "0 BEZ (Patrocinado)"],
              ["Red", "Polygon Amoy L2"],
              ["Destino", recipient ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}` : '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ background: C.card, borderRadius: 8, padding: "7px 10px" }}>
                <div style={{ color: C.muted, fontSize: 9 }}>{k}</div>
                <div style={{ color: C.text2, fontFamily: C.mono, fontSize: 11, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <Btn 
          onClick={handlePay} 
          disabled={status === 'processing' || status === 'completed'}
          color={status === 'completed' ? C.primary : C.gold} 
          full 
          size="lg"
        >
          {status === 'processing' ? "Procesando Transacción..." : 
           status === 'completed' ? "Pago Completado ✓" : 
           `Pagar ${amount} ${currency}`}
        </Btn>

        {status !== 'pending' && (
          <div style={{ 
            marginTop: 12, 
            background: status === "completed" ? "#052a0a99" : "#1a050599",
            border: `1px solid ${status === "completed" ? C.primary : C.red}`, 
            borderRadius: 12, padding: 14 
          }}>
            <StatusBadge status={status} />
            {status === "completed" && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: C.primary, fontWeight: 800, fontSize: 14 }}>
                  🎉 {amount} {currency} pagados con éxito
                </div>
                <div style={{ color: C.muted, fontSize: 10, fontFamily: C.mono, marginTop: 4 }}>
                  TX: {txHash}
                </div>
                <div style={{ color: C.muted, fontSize: 10, marginTop: 6 }}>
                  Esta ventana se cerrará automáticamente...
                </div>
              </div>
            )}
            {status === "failed" && <div style={{ color: C.red, marginTop: 6, fontSize: 11 }}>{errorMsg}</div>}
          </div>
        )}
      </Card>
    </div>
  );
}
