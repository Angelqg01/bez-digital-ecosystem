import React from 'react';
import { Server, Activity, ArrowUpRight, ShieldCheck } from 'lucide-react';

export default function Validators() {
  return (
    <div className="page-container animate-in">
      <div className="page-header flex justify-between items-end">
        <div>
          <h1 className="page-title">Validator Dashboard</h1>
          <p className="page-subtitle">Monitor L2 nodes and your staked assets.</p>
        </div>
        <button className="btn-primary" style={{width: 'auto', padding: '0.75rem 1.5rem'}}>
          <Server size={18} className="mr-2" /> Become Validator
        </button>
      </div>

      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-label">Total Staked (Network)</div>
          <div className="stat-value">12.5M BEZ</div>
          <div className="stat-change positive flex items-center"><ArrowUpRight size={12}/> +2.4% this week</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Nodes</div>
          <div className="stat-value">42 / 50</div>
          <div className="stat-change text-[var(--bezhas-success)]">Network Healthy</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average APY</div>
          <div className="stat-value text-[var(--bezhas-primary)]">8.2%</div>
          <div className="stat-change">Variable yield</div>
        </div>
      </div>

      <div className="card mb-8">
        <div className="card-header border-b border-[var(--bezhas-border)] pb-4 mb-4">
          <h3 className="card-title text-white font-bold text-lg">My Delegations</h3>
        </div>
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1 text-center md:text-left">
            <div className="text-sm text-[var(--bezhas-text-secondary)] mb-1">Total Delegated</div>
            <div className="text-3xl font-display font-bold text-white mb-2">5,000 BEZ</div>
            <div className="text-sm text-[var(--bezhas-success)]">+124.50 BEZ earned</div>
          </div>
          <div className="flex-1">
            <button className="btn-secondary w-full mb-3">Claim Rewards</button>
            <button className="btn-secondary w-full border-[var(--bezhas-primary)] text-[var(--bezhas-primary)]">Undelegate</button>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-4 font-display">Top Validator Nodes</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--bezhas-border)] text-sm text-[var(--bezhas-text-secondary)]">
              <th className="py-3 px-4 font-normal">Node Operator</th>
              <th className="py-3 px-4 font-normal">Uptime</th>
              <th className="py-3 px-4 font-normal">Total Staked</th>
              <th className="py-3 px-4 font-normal">Commission</th>
              <th className="py-3 px-4 font-normal text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--bezhas-border-subtle)] hover:bg-[var(--bezhas-surface-2)] transition-colors">
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--bezhas-primary)] flex items-center justify-center text-black font-bold">A</div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">BeZhas Foundation <ShieldCheck size={14} className="text-[var(--bezhas-success)]"/></div>
                    <div className="text-xs text-[var(--bezhas-text-muted)] font-mono">0x12a...b4c</div>
                  </div>
                </div>
              </td>
              <td className="py-4 px-4 text-[var(--bezhas-success)]">99.99%</td>
              <td className="py-4 px-4 font-mono">2,500,000 BEZ</td>
              <td className="py-4 px-4">5%</td>
              <td className="py-4 px-4 text-right">
                <button className="text-[var(--bezhas-primary)] text-sm font-bold hover:underline">Delegate</button>
              </td>
            </tr>
            <tr className="border-b border-[var(--bezhas-border-subtle)] hover:bg-[var(--bezhas-surface-2)] transition-colors">
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--bezhas-secondary)] flex items-center justify-center text-white font-bold">O</div>
                  <div>
                    <div className="font-bold text-white">Ocean Nodes</div>
                    <div className="text-xs text-[var(--bezhas-text-muted)] font-mono">0x88f...1a2</div>
                  </div>
                </div>
              </td>
              <td className="py-4 px-4 text-[var(--bezhas-success)]">99.95%</td>
              <td className="py-4 px-4 font-mono">1,150,000 BEZ</td>
              <td className="py-4 px-4">8%</td>
              <td className="py-4 px-4 text-right">
                <button className="text-[var(--bezhas-primary)] text-sm font-bold hover:underline">Delegate</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
