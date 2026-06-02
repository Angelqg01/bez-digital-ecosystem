import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, Clock, ShieldCheck, Zap, ArrowRight, ArrowLeft } from 'lucide-react';

const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

function Gateway() {
  const navigate = useNavigate();
  const amount = 142509.32;
  return (
    <div className="pay-container animate-in">
      <div className="pay-header">
        <div className="logo-badge">BZ</div>
        <h2>BeZhas Pay Gateway</h2>
        <p className="pay-subtitle">Secure Merchant Checkout</p>
      </div>

      <div className="amount-display">
        <span className="currency">BEZ</span>
        <span className="value">142,509.32</span>
        <div className="usd-value">≈ $142,509.32 USD</div>
      </div>

      <div className="payment-details">
        <div className="detail-row">
          <span>Merchant</span>
          <strong>BeZhas Enterprise</strong>
        </div>
        <div className="detail-row">
          <span>Network</span>
          <strong>BeZhas L2 <Zap size={14} className="inline-icon" /></strong>
        </div>
        <div className="detail-row">
          <span>Gas Fee (Paymaster)</span>
          <strong className="free">Sponsored</strong>
        </div>
      </div>

      <div className="payment-methods">
        <h3>Select Payment Method</h3>
        <button className="method-btn active">
          <div className="method-icon"><CreditCard /></div>
          <div className="method-info">
            <span className="method-title">Smart Wallet Balance</span>
            <span className="method-desc">Instant · Zero Gas</span>
          </div>
          <div className="method-radio"></div>
        </button>
        <button className="method-btn">
          <div className="method-icon" style={{background: 'rgba(255, 107, 53, 0.1)', color: '#FF6B35'}}><ShieldCheck /></div>
          <div className="method-info">
            <span className="method-title">Card via Stripe</span>
            <span className="method-desc">+1.5% fee · Fiat onramp</span>
          </div>
          <div className="method-radio empty"></div>
        </button>
      </div>

      <button className="btn-primary mt-4" onClick={() => navigate('/processing')}>
        Pay Now <ArrowRight size={18} />
      </button>
      
      <div className="security-footer">
        <ShieldCheck size={16} /> Secured by BeZhas Aegis
      </div>
    </div>
  );
}

function Processing() {
  const navigate = useNavigate();
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/success');
    }, 4000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="pay-container text-center animate-in">
      <div className="processing-circle">
        <div className="spinner"></div>
        <Clock size={32} className="processing-icon" />
      </div>
      <h2>Processing Transaction</h2>
      <p className="pay-subtitle">Confirming on BeZhas L2...</p>

      <div className="steps-container mt-6">
        <div className="step completed">
          <div className="step-dot"></div>
          <div className="step-text">Initiated</div>
        </div>
        <div className="step active">
          <div className="step-dot"></div>
          <div className="step-text">Aegis Security Check</div>
        </div>
        <div className="step pending">
          <div className="step-dot"></div>
          <div className="step-text">Block Confirmation</div>
        </div>
      </div>
    </div>
  );
}

function Success() {
  const navigate = useNavigate();
  return (
    <div className="pay-container text-center animate-in">
      <div className="success-circle">
        <CheckCircle size={48} />
      </div>
      <h2>Payment Successful</h2>
      <p className="pay-subtitle">Your transaction is complete.</p>

      <div className="receipt-card mt-6">
        <div className="detail-row">
          <span>Amount Paid</span>
          <strong className="success-text">142,509.32 BEZ</strong>
        </div>
        <div className="detail-row">
          <span>Tx Hash</span>
          <a href="#" className="hash-link">0x8a9...f4e2 ↗</a>
        </div>
        <div className="detail-row">
          <span>Date</span>
          <strong>{new Date().toLocaleString()}</strong>
        </div>
      </div>

      <button className="btn-secondary mt-6 w-full" onClick={() => navigate('/')}>
        <ArrowLeft size={18} /> Return to Merchant
      </button>
    </div>
  );
}

export default function App() {
  return (
    <div className="pay-app-wrapper">
      <Routes>
        <Route path="/" element={<Gateway />} />
        <Route path="/processing" element={<Processing />} />
        <Route path="/success" element={<Success />} />
      </Routes>
    </div>
  );
}
