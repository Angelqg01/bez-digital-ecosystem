/**
 * BeZhas-Hub — useGovernance hook
 * Maneja la lógica de votación, propuestas y delegación de poder de voto.
 * Integra con el contrato BeZhasGovernor.sol y BeZhasToken.sol (ERC20Votes).
 */

import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

// Direcciones de contratos (fallback si no están en .env)
const GOVERNOR_ADDR = process.env.REACT_APP_GOVERNOR_ADDRESS || '0x0000000000000000000000000000000000000001';
const TOKEN_ADDR    = process.env.REACT_APP_BEZ_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000002';

export function useGovernance(userAddress) {
  const [loading,    setLoading]    = useState(false);
  const [stats,      setStats]      = useState({
    totalProposals: 0,
    activeProposals: 0,
    executedProposals: 0,
    totalVotingPower: '0',
  });
  const [proposals,  setProposals]  = useState([]);
  const [userPower,  setUserPower]  = useState('0');
  const [delegated,  setDelegated]  = useState(null);

  const refresh = useCallback(async () => {
    if (!userAddress) return;
    setLoading(true);
    try {
      // Mock de carga de datos desde el contrato/indexer
      // En una implementación real usaríamos wagmi/ethers para leer el estado del Governor
      
      const mockProposals = [
        {
          id: '1',
          title: 'Actualización del Protocolo v2.1',
          description: 'Ajuste de los parámetros de staking y reducción de fees de bridge en un 0.05%.',
          proposer: '0x1234...5678',
          state: 1, // Active
          forVotes: '1250000',
          againstVotes: '150000',
          abstainVotes: '12000',
          quorum: '1000000',
          startTime: Date.now() - 86400000,
          endTime: Date.now() + 172800000,
          isActive: true,
        },
        {
          id: '2',
          title: 'Expansión a Arbitrum One',
          description: 'Despliegue del ecosistema BeZhas en Arbitrum para mejorar la escalabilidad y reducir costos de gas.',
          proposer: '0x8888...9999',
          state: 5, // Executed
          forVotes: '4500000',
          againstVotes: '50000',
          abstainVotes: '5000',
          quorum: '1000000',
          startTime: Date.now() - 1000000000,
          endTime: Date.now() - 500000000,
          isActive: false,
        }
      ];

      setProposals(mockProposals);
      setUserPower('25000.45'); // Mock de voting power (BEZ con delegación)
      setDelegated('0x0000000000000000000000000000000000000000'); // Self-delegated
      setStats({
        totalProposals: 14,
        activeProposals: 2,
        executedProposals: 11,
        totalVotingPower: '15000000',
      });
    } catch (e) {
      console.error('Error fetching governance data:', e);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const castVote = useCallback(async (proposalId, support, reason = "") => {
    setLoading(true);
    try {
      console.log(`Votando en propuesta ${proposalId}: ${support} (Reason: ${reason})`);
      // Simulación de transacción
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, txHash: '0x' + Math.random().toString(16).slice(2) };
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const delegate = useCallback(async (delegatee) => {
    setLoading(true);
    try {
      console.log(`Delegando poder a: ${delegatee}`);
      await new Promise(r => setTimeout(r, 1500));
      setDelegated(delegatee);
      return { success: true };
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const createProposal = useCallback(async (targets, values, signatures, calldatas, description) => {
    setLoading(true);
    try {
      console.log('Creando propuesta:', description);
      await new Promise(r => setTimeout(r, 3000));
      return { success: true, proposalId: Math.floor(Math.random() * 1000).toString() };
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    stats,
    proposals,
    userPower,
    delegated,
    refresh,
    castVote,
    delegate,
    createProposal,
  };
}
