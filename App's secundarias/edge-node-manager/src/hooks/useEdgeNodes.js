import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthProvider';
import {
  registerValidatorNode,
  claimRewards as claimBlockchainRewards,
  getValidatorInfo,
  getPendingRewards,
  getNetworkStats as getBlockchainNetworkStats,
} from '../services/nodeBlockchainService';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3001/api';

export function useEdgeNodes() {
  const { token } = useAuth();
  const [networkStats, setNetworkStats] = useState(null);
  const [myNodes, setMyNodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNetworkStats = useCallback(async () => {
    try {
      // Try blockchain first, fall back to REST
      const blockchainStats = await getBlockchainNetworkStats(token);
      if (blockchainStats && blockchainStats.source !== 'fallback') {
        setNetworkStats(blockchainStats);
        return;
      }

      const res = await fetch(`${GATEWAY_URL}/nodes/network`);
      if (!res.ok) throw new Error('Failed to fetch network stats');
      const data = await res.json();
      setNetworkStats(data);
    } catch (err) {
      console.error('[useEdgeNodes] Network stats error:', err);
    }
  }, [token]);

  const fetchMyNodes = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${GATEWAY_URL}/nodes/mine`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch user nodes');
      const data = await res.json();
      setMyNodes(data.nodes || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  }, [token]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchNetworkStats(), fetchMyNodes()]);
    setIsLoading(false);
  }, [fetchNetworkStats, fetchMyNodes]);

  useEffect(() => {
    loadData();
    // Poll every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  /**
   * Register a node — tries on-chain first, falls back to REST API.
   */
  const registerNode = async (nodeData) => {
    // Try blockchain registration first
    try {
      if (nodeData.walletAddress && nodeData.stakeBEZ) {
        const blockchainResult = await registerValidatorNode(
          nodeData.walletAddress,
          nodeData.stakeBEZ,
          { name: nodeData.name, type: nodeData.type, location: nodeData.location }
        );
        if (blockchainResult.status === 'registered') {
          fetchMyNodes();
          return blockchainResult;
        }
      }
    } catch (err) {
      console.warn('[useEdgeNodes] On-chain registration failed, falling back to REST:', err.message);
    }

    // Fallback to REST API
    try {
      const res = await fetch(`${GATEWAY_URL}/nodes/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(nodeData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register node');
      
      fetchMyNodes();
      return data;
    } catch (err) {
      throw err;
    }
  };

  /**
   * Claim rewards — tries on-chain first, falls back to REST API.
   */
  const claimRewards = async (nodeId) => {
    // Try blockchain claim first
    try {
      const blockchainResult = await claimBlockchainRewards();
      if (blockchainResult.status === 'claimed') {
        fetchMyNodes();
        return blockchainResult;
      }
    } catch (err) {
      console.warn('[useEdgeNodes] On-chain claim failed, falling back to REST:', err.message);
    }

    // Fallback to REST API
    try {
      const res = await fetch(`${GATEWAY_URL}/nodes/${nodeId}/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to claim rewards');
      
      fetchMyNodes();
      return data;
    } catch (err) {
      throw err;
    }
  };

  /**
   * Get validator on-chain info for an address.
   */
  const getNodeValidatorInfo = async (address) => {
    return getValidatorInfo(address);
  };

  /**
   * Get pending on-chain rewards.
   */
  const getNodeRewards = async (address) => {
    return getPendingRewards(address);
  };

  return {
    networkStats,
    myNodes,
    isLoading,
    error,
    refresh: loadData,
    registerNode,
    claimRewards,
    getNodeValidatorInfo,
    getNodeRewards,
  };
}
