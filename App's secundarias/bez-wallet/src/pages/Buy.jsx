import React, { useState } from 'react';
import { useBEZBalance } from '@bezhas/platform-sdk/wallet';
import { C, Card, Btn, Input, Chip } from '../components/ui/DesignSystem';

export default function Buy() {
  const [method, setMethod] = useState('card'); // card, bank, crypto
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle'); // idle, processing, success
  const { refresh } = useBEZBalance();

  const handlePurchase = () => {
    setStatus('processing');
    // Simulate payment processing
    setTimeout(() => {
      setStatus('success');
      refresh(); // Update the global balance
    }, 2000);
  };

  const getEstBEZ = () => {
    const val = parseFloat(amount) || 0;
    return (val / 0.07).toFixed(2); // Mock rate: 1 BEZ = $0.07
  };

  if (status === 'success') {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: '4rem' }}>
        <Card glow color={C.primary} style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: C.primary }}>Top-Up Successful</h2>
          <p style={{ color: C.muted, fontFamily: C.mono, fontSize: '1rem', marginBottom: '2rem' }}>
            +{getEstBEZ()} BEZ has been added to your wallet.
          </p>
          <Btn variant="fill" color={C.primary} onClick={() => { setStatus('idle'); setAmount(''); }}>
            Buy More
          </Btn>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header animate-in">
        <h1 className="page-title">Buy BEZ-Coin</h1>
        <p className="page-subtitle">Add funds to your wallet using fiat or crypto</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }} className="animate-in-delay-1">
        
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Methods selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <MethodCard 
              id="card" 
              title="Credit Card" 
              icon="💳" 
              desc="Instant · Stripe" 
              active={method === 'card'} 
              onClick={() => setMethod('card')} 
            />
            <MethodCard 
              id="bank" 
              title="Bank Transfer" 
              icon="🏦" 
              desc="1-3 Days · SEPA/Wire" 
              active={method === 'bank'} 
              onClick={() => setMethod('bank')} 
            />
            <MethodCard 
              id="crypto" 
              title="Crypto Bridge" 
              icon="⛓️" 
              desc="5 mins · USDC/USDT" 
              active={method === 'crypto'} 
              onClick={() => setMethod('crypto')} 
            />
          </div>

          <Card>
            {/* CARD FLOW */}
            {method === 'card' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ color: C.text, fontSize: '1.2rem', fontWeight: 600 }}>Stripe Express Checkout</h3>
                  <Chip color={C.primary}>Powered by Stripe</Chip>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <Btn variant="outline" color={C.text} style={{ flex: 1, background: C.card2 }}> Pay</Btn>
                  <Btn variant="outline" color={C.text} style={{ flex: 1, background: C.card2 }}>G Pay</Btn>
                </div>
                
                <div style={{ textAlign: 'center', color: C.muted, fontSize: 12, marginBottom: '1.5rem' }}>Or pay with card</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Input 
                    label="Amount (USD)" 
                    sym="$" 
                    value={amount} 
                    onChange={setAmount} 
                    usd={`≈ ${getEstBEZ()} BEZ`}
                  />
                  
                  <div style={{ padding: '12px', background: C.card2, borderRadius: 10, border: `1px solid ${C.border2}` }}>
                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>Card Information</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input type="text" placeholder="Card number" style={inputStyle} disabled />
                      <input type="text" placeholder="MM/YY" style={{...inputStyle, width: '80px'}} disabled />
                      <input type="text" placeholder="CVC" style={{...inputStyle, width: '70px'}} disabled />
                    </div>
                  </div>
                </div>

                <Btn 
                  full 
                  color={C.gold} 
                  style={{ marginTop: '2rem' }} 
                  disabled={!amount || status === 'processing'}
                  onClick={handlePurchase}
                >
                  {status === 'processing' ? 'Processing...' : `Pay $${amount || '0.00'} securely`}
                </Btn>
              </div>
            )}

            {/* BANK FLOW */}
            {method === 'bank' && (
              <div>
                <h3 style={{ color: C.text, fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.5rem' }}>Bank Transfer (B2B)</h3>
                <p style={{ color: C.muted, fontSize: 14, marginBottom: '1.5rem' }}>
                  Send funds to your dedicated Virtual IBAN. Funds will automatically convert to BEZ-Coin upon receipt.
                </p>

                <div style={{ background: C.card2, borderRadius: 12, padding: '1rem', border: `1px solid ${C.border2}`, marginBottom: '1.5rem' }}>
                  <BankRow label="Beneficiary" value="BeZhas Corporate Ltd." />
                  <BankRow label="IBAN" value="LT82 3500 0100 0000 0270 88" />
                  <BankRow label="BIC / SWIFT" value="REVOLT21" />
                  <BankRow label="Reference" value="BZ-AC-8492" />
                </div>
                <Btn full variant="outline" color={C.blue}>Download Instructions (PDF)</Btn>
              </div>
            )}

            {/* CRYPTO FLOW */}
            {method === 'crypto' && (
              <div>
                <h3 style={{ color: C.text, fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.5rem' }}>Deposit Crypto</h3>
                <p style={{ color: C.muted, fontSize: 14, marginBottom: '1.5rem' }}>
                  Send USDC or USDT on Ethereum or Polygon. It will be bridged automatically to BEZ L2.
                </p>
                
                <div style={{ background: C.card2, borderRadius: 12, padding: '1rem', border: `1px solid ${C.border2}`, textAlign: 'center' }}>
                  <div style={{ background: '#fff', width: 160, height: 160, margin: '0 auto 1rem', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{color: '#000', fontSize: 12}}>QR Code</span>
                  </div>
                  <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Your Deposit Address</div>
                  <div style={{ color: C.text, fontFamily: C.mono, fontSize: 14, marginTop: 4 }}>0x8a2F...c3D1</div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar Order Summary */}
        <div>
          <Card>
            <h4 style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: '1rem' }}>Order Summary</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: C.muted, fontSize: 12 }}>
              <span>You Pay</span>
              <span>{method === 'card' && amount ? `$${parseFloat(amount).toFixed(2)}` : '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: C.muted, fontSize: 12 }}>
              <span>Fees</span>
              <span style={{ color: C.primary }}>$0.00</span>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, margin: '1rem 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: C.gold, fontSize: 14, fontWeight: 600 }}>
              <span>You Receive</span>
              <span>{method === 'card' && amount ? `${getEstBEZ()} BEZ` : '-'}</span>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}

// Subcomponents
const MethodCard = ({ title, icon, desc, active, onClick }) => (
  <div 
    onClick={onClick}
    style={{ 
      background: active ? `${C.primary}11` : C.card, 
      border: `1px solid ${active ? C.primary : C.border}`,
      borderRadius: 12, 
      padding: '1rem', 
      cursor: 'pointer',
      transition: 'all 0.2s'
    }}
  >
    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{icon}</div>
    <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{title}</div>
    <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{desc}</div>
  </div>
);

const BankRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
    <span style={{ color: C.muted, fontSize: 12 }}>{label}</span>
    <span style={{ color: C.text, fontFamily: C.mono, fontSize: 12 }}>{value}</span>
  </div>
);

const inputStyle = {
  flex: 1, background: 'transparent', border: 'none', color: C.text, fontSize: 14, fontFamily: C.mono, outline: 'none'
};
