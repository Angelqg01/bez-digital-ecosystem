import React from 'react';
import { ShieldCheck, Key, Users, Settings } from 'lucide-react';

export default function SmartWallet() {
  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <h1 className="page-title">Smart Wallet & Security</h1>
        <p className="page-subtitle">Manage your vault, session keys, and recovery policies.</p>
      </div>

      <div className="balance-hero mb-8">
        <div className="balance-label">Vault Balance</div>
        <div className="balance-value">142,509.32 BEZ</div>
        <div className="balance-usd">Secured by BeZhas Aegis</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label flex items-center gap-2"><Key size={14} /> Session Keys</div>
          <div className="stat-value text-lg">One-tap active</div>
          <div className="stat-change positive">Valid for 24h</div>
        </div>
        <div className="stat-card">
          <div className="stat-label flex items-center gap-2"><Users size={14} /> Social Recovery</div>
          <div className="stat-value text-lg">Guardian Consensus</div>
          <div className="stat-change">3 / 5 Guardians active</div>
        </div>
        <div className="stat-card">
          <div className="stat-label flex items-center gap-2"><Settings size={14} /> Daily Spending Limit</div>
          <div className="stat-value text-lg">Automated</div>
          <div className="stat-change">Threshold protection ON</div>
        </div>
      </div>

      <div className="card mt-8">
        <div className="card-header">
          <h3 className="card-title">Security Log</h3>
        </div>
        <div className="tx-list">
          <div className="tx-item">
            <div className="tx-icon mint"><ShieldCheck /></div>
            <div className="tx-info">
              <div className="tx-type">Policy update initiated</div>
              <div className="tx-address">To: 0x3f1...e911</div>
            </div>
            <div className="tx-amount">
              <div className="tx-time">Just now</div>
            </div>
          </div>
          <div className="tx-item">
            <div className="tx-icon mint"><Key /></div>
            <div className="tx-info">
              <div className="tx-type">Session key generated</div>
              <div className="tx-address">Device: MacBook Pro</div>
            </div>
            <div className="tx-amount">
              <div className="tx-time">2 hours ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
