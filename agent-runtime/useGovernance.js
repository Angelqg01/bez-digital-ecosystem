/**
 * BeZhas Web3 — useGovernance + useCompliance
 * Hooks para GovernanceSystem.sol · TreasuryVault.sol · ComplianceAgent
 */

import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Mock proposals (hasta que GovernanceSystem.sol tenga subgraph/events) ──
const MOCK_PROPOSALS = [
  {
    id: '1',
    title: 'BIP-001: Aumentar APY staking al 22%',
    description: 'Propuesta para incrementar el APY del StakingPool de 18.5% a 22% durante el Q3 2026, con cargo al Treasury.',
    proposer: '0x52Df82920CBAE522880dD7657e43d1A754eD044E',
    status: 'active',
    forVotes:     '12500000',
    againstVotes: '3200000',
    abstainVotes: '800000',
    totalVotes:   '16500000',
    quorum:       '10000000',
    quorumReached: true,
    deadline: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
    created:  new Date(Date.now() - 4 * 86400 * 1000).toISOString(),
    targets: ['0x3EfC42095E8503d41Ad8001328FC23388E00e8a3'],
    category: 'tokenomics',
  },
  {
    id: '2',
    title: 'BIP-002: Integrar nuevo sector (Turismo)',
    description: 'Añadir módulo de tokenización para el sector turístico en la plataforma BeZhas, con contratos dedicados para reservas, ratings y loyalty.',
    proposer: '0x89c23890c742d710265dD61be789C71dC8999b12',
    status: 'succeeded',
    forVotes:     '25000000',
    againstVotes: '1500000',
    abstainVotes: '500000',
    totalVotes:   '27000000',
    quorum:       '10000000',
    quorumReached: true,
    deadline: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
    created:  new Date(Date.now() - 9 * 86400 * 1000).toISOString(),
    targets: [],
    category: 'platform',
  },
  {
    id: '3',
    title: 'BIP-003: Destinar 500K BEZ del Treasury a bug bounty',
    description: 'Asignar 500,000 BEZ del Treasury DAO para un programa de bug bounty durante 6 meses, gestionado por el SecurityAgent + AEGIS.',
    proposer: '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
    status: 'pending',
    forVotes:     '0',
    againstVotes: '0',
    abstainVotes: '0',
    totalVotes:   '0',
    quorum:       '10000000',
    quorumReached: false,
    deadline: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    created:  new Date(Date.now() - 1 * 86400 * 1000).toISOString(),
    targets: ['0x89c23890c742d710265dD61be789C71dC8999b12'],
    category: 'security',
  },
];

// ─── useGovernance ─────────────────────────────────────────────────────────

export function useGovernance(userAddress = null) {
  const [proposals,    setProposals]    = useState(MOCK_PROPOSALS);
  const [govStats,     setGovStats]     = useState(null);
  const [votingPower,  setVotingPower]  = useState('0');
  const [treasury,     setTreasury]     = useState(null);
  const [loading,      setLoading]      = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const urls = [
        `${API}/api/tokenomics/governance/stats`,
        userAddress ? `${API}/api/tokenomics/governance/power/${userAddress}` : null,
      ].filter(Boolean);

      const results = await Promise.allSettled(urls.map(u => fetch(u).then(r => r.json())));

      if (results[0]?.status === 'fulfilled') setGovStats(results[0].value?.stats);
      if (userAddress && results[1]?.status === 'fulfilled') {
        setVotingPower(results[1].value?.votingPower || '0');
      }

      setLoading(false);
    } catch { setLoading(false); }
  }, [userAddress]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30_000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const castVote = useCallback(async (proposalId, support) => {
    // support: 0=against, 1=for, 2=abstain
    const r = await fetch(`${API}/api/tasks`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        type:    'workflow:execute',
        priority:'normal',
        payload: { action: 'castVote', proposalId, support, userAddress },
      }),
    });
    const result = await r.json();

    // Actualizar UI optimísticamente
    if (result.ok) {
      setProposals(prev => prev.map(p => {
        if (p.id !== proposalId) return p;
        const voteKey = support === 1 ? 'forVotes' : support === 0 ? 'againstVotes' : 'abstainVotes';
        const power   = parseFloat(votingPower);
        return {
          ...p,
          [voteKey]:  String(parseFloat(p[voteKey]) + power),
          totalVotes: String(parseFloat(p.totalVotes) + power),
        };
      }));
    }
    return result;
  }, [userAddress, votingPower]);

  return { proposals, govStats, votingPower, treasury, loading, castVote, refresh: fetchAll };
}

// ─── useCompliance ─────────────────────────────────────────────────────────

export function useCompliance() {
  const [lastReport,   setLastReport]   = useState(null);
  const [checkResult,  setCheckResult]  = useState(null);
  const [loading,      setLoading]      = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/tokenomics/compliance/report`);
      const d = await r.json();
      setLastReport(d.report);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const runCheck = useCallback(async (payload) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/tokenomics/compliance/check`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const result = await r.json();
      setCheckResult(result);
      return result;
    } finally { setLoading(false); }
  }, []);

  const generateAEAT = useCallback(async (payload) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/tokenomics/compliance/aeat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      return r.json();
    } finally { setLoading(false); }
  }, []);

  return { lastReport, checkResult, loading, runCheck, generateAEAT, refresh: fetchReport };
}
