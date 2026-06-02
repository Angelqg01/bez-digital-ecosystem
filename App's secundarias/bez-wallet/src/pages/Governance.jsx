import React from 'react';
import { Landmark, Vote, CheckCircle2, XCircle } from 'lucide-react';

export default function Governance() {
  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <h1 className="page-title">DAO Governance</h1>
        <p className="page-subtitle">Participate in shaping the future of the BeZhas ecosystem.</p>
      </div>

      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-label">Your Voting Power</div>
          <div className="stat-value">25,400 vBEZ</div>
          <div className="stat-change positive">Active Participant</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Proposals</div>
          <div className="stat-value">3</div>
          <div className="stat-change">Needs your vote</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Proposals Passed</div>
          <div className="stat-value">142</div>
          <div className="stat-change">Lifetime</div>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-4 font-display">Active Proposals</h3>
      
      <div className="flex flex-col gap-4">
        {/* Proposal 1 */}
        <div className="card hover:border-[var(--bezhas-primary)] transition-all cursor-pointer">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="inline-block px-2 py-1 bg-[var(--bezhas-primary)] text-black text-xs font-bold rounded mb-2 uppercase">Core Protocol</span>
              <h4 className="text-lg font-bold">BIP-42: Adjust Validator Staking Yields</h4>
            </div>
            <div className="text-right">
              <div className="text-sm text-[var(--bezhas-text-secondary)]">Ends in</div>
              <div className="font-mono font-bold text-[var(--bezhas-warning)]">2d 14h</div>
            </div>
          </div>
          
          <p className="text-sm text-[var(--bezhas-text-secondary)] mb-6">Proposal to optimize the current emission curve for L2 validators to maintain long-term sustainability while keeping yields competitive.</p>
          
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--bezhas-success)]"><CheckCircle2 size={14} className="inline mr-1" /> For (68%)</span>
              <span className="text-[var(--bezhas-error)]">Against (32%) <XCircle size={14} className="inline ml-1" /></span>
            </div>
            <div className="w-full h-2 rounded-full flex overflow-hidden">
              <div className="bg-[var(--bezhas-success)] h-full" style={{width: '68%'}}></div>
              <div className="bg-[var(--bezhas-error)] h-full" style={{width: '32%'}}></div>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary flex-1 border-[var(--bezhas-success)] text-[var(--bezhas-success)] hover:bg-[var(--bezhas-success)] hover:text-white">Vote For</button>
            <button className="btn-secondary flex-1 border-[var(--bezhas-error)] text-[var(--bezhas-error)] hover:bg-[var(--bezhas-error)] hover:text-white">Vote Against</button>
          </div>
        </div>

        {/* Proposal 2 */}
        <div className="card hover:border-[var(--bezhas-primary)] transition-all cursor-pointer opacity-75">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="inline-block px-2 py-1 bg-[var(--bezhas-secondary)] text-white text-xs font-bold rounded mb-2 uppercase">Ecosystem</span>
              <h4 className="text-lg font-bold">BIP-43: Treasury Grant for Supply Chain DApp</h4>
            </div>
            <div className="text-right">
              <div className="text-sm text-[var(--bezhas-text-secondary)]">Ends in</div>
              <div className="font-mono font-bold text-[var(--bezhas-warning)]">5d 2h</div>
            </div>
          </div>
          <div className="text-sm text-[var(--bezhas-success)] font-bold mb-4">
            ✓ You voted FOR
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[var(--bezhas-success)]">For (92%)</span>
            <span className="text-[var(--bezhas-error)]">Against (8%)</span>
          </div>
          <div className="w-full h-2 rounded-full flex overflow-hidden">
            <div className="bg-[var(--bezhas-success)] h-full" style={{width: '92%'}}></div>
            <div className="bg-[var(--bezhas-error)] h-full" style={{width: '8%'}}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
