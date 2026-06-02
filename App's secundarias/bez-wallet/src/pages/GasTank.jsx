import React from 'react';
import { Fuel, RefreshCw, Zap } from 'lucide-react';
import { useGasTank } from '@bezhas/platform-sdk/gas';

export default function GasTank() {
  const { balance_usd, balance_bez, estimated_txs_remaining, isLoading } = useGasTank();

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <h1 className="page-title">Gas Tank (Paymaster)</h1>
        <p className="page-subtitle">Sponsor your transaction fees on BeZhas L2.</p>
      </div>

      <div className="balance-hero mb-8" style={{ background: 'linear-gradient(145deg, var(--bezhas-surface), rgba(16, 185, 129, 0.05))', borderColor: 'rgba(16, 185, 129, 0.15)' }}>
        <div className="balance-label flex items-center justify-center gap-2">
          <Fuel size={16} /> Paymaster Balance
        </div>
        <div className="balance-value">{isLoading ? '...' : (balance_bez || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} BEZ</div>
        <div className="balance-usd">~ {isLoading ? '...' : (estimated_txs_remaining || 0).toLocaleString()} txs sponsored (${isLoading ? '...' : (balance_usd || 0).toFixed(2)})</div>
      </div>

      <div className="action-grid mb-8">
        <button className="action-btn">
          <div className="action-btn-icon bridge"><Fuel /></div>
          <span>Refill Tank</span>
        </button>
        <button className="action-btn">
          <div className="action-btn-icon send"><RefreshCw /></div>
          <span>Auto-refill</span>
        </button>
        <button className="action-btn">
          <div className="action-btn-icon scan"><Zap /></div>
          <span>Gas Station API</span>
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Sponsored Transactions</h3>
        </div>
        <div className="tx-list">
          <div className="tx-item">
            <div className="tx-icon out"><Fuel size={14}/></div>
            <div className="tx-info">
              <div className="tx-type">DeFi Swap Execution</div>
              <div className="tx-address">Router: 0x1A2...4B9</div>
            </div>
            <div className="tx-amount">
              <div className="tx-amount-value out">-0.00012 BEZ</div>
              <div className="tx-time">2 mins ago</div>
            </div>
          </div>
          <div className="tx-item">
            <div className="tx-icon in"><Fuel size={14}/></div>
            <div className="tx-info">
              <div className="tx-type">Tank Refill</div>
              <div className="tx-address">From: 0xMain...Wallet</div>
            </div>
            <div className="tx-amount">
              <div className="tx-amount-value in">+1,000.00 BEZ</div>
              <div className="tx-time">1 day ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
