import React from 'react';
import { ArrowRightLeft, Lock, Unlock, ArrowDownCircle } from 'lucide-react';

export default function Bridge() {
  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <h1 className="page-title">Blockchain Bridge Transition</h1>
        <p className="page-subtitle">Move assets between BeZhas L2, Polygon, and Ethereum securely.</p>
      </div>

      <div className="form-section mx-auto" style={{ maxWidth: '600px' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Bridge Assets</h3>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-[var(--bezhas-surface-2)] rounded-lg border border-[var(--bezhas-border)]">
              <label className="text-sm text-[var(--bezhas-text-secondary)] mb-2 block">From Network</label>
              <select className="w-full bg-[var(--bezhas-surface)] p-3 rounded border border-[var(--bezhas-border)] text-white">
                <option>Polygon (PoS)</option>
                <option>Ethereum Mainnet</option>
                <option>BeZhas L2</option>
              </select>
            </div>

            <div className="flex justify-center -my-6 relative z-10">
              <div className="bg-[var(--bezhas-surface)] p-2 rounded-full border border-[var(--bezhas-border)] text-[var(--bezhas-primary)]">
                <ArrowDownCircle size={24} />
              </div>
            </div>

            <div className="p-4 bg-[var(--bezhas-surface-2)] rounded-lg border border-[var(--bezhas-border)]">
              <label className="text-sm text-[var(--bezhas-text-secondary)] mb-2 block">To Network</label>
              <select className="w-full bg-[var(--bezhas-surface)] p-3 rounded border border-[var(--bezhas-border)] text-white">
                <option>BeZhas L2</option>
                <option>Polygon (PoS)</option>
                <option>Ethereum Mainnet</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="text-sm text-[var(--bezhas-text-secondary)] mb-2 block">Amount to Bridge (BEZ)</label>
              <input type="number" className="w-full bg-[var(--bezhas-surface-2)] p-4 rounded-lg border border-[var(--bezhas-border)] text-xl font-bold text-center text-white" placeholder="0.00" />
            </div>

            <div className="flex justify-between text-sm text-[var(--bezhas-text-secondary)] mt-2">
              <span>Bridge Fee: <strong className="text-white">0.01 BEZ</strong></span>
              <span>Estimated Time: <strong className="text-white">~5 mins</strong></span>
            </div>

            <button className="btn-primary mt-6 w-full py-4 text-lg">
              Initiate Transfer <ArrowRightLeft className="inline ml-2" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 p-4 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-lg text-sm text-[var(--bezhas-success)]">
          <Lock size={20} className="shrink-0 mt-1" />
          <p>Assets are secured by BeZhas Aegis threshold signatures during transit. Your funds are never exposed to single-point vulnerabilities.</p>
        </div>
      </div>
    </div>
  );
}
