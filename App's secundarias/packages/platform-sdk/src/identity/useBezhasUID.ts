import { useState, useEffect } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';

export interface VerifiableCredential {
  type: string;           // "LogisticsLicense", "QualityCertificate", "FoodSafety"
  issuer: string;         // DID of the issuer
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: Record<string, any>;
}

export interface BeZhasIdentity {
  // Identifiers
  did: string;                        // "did:bezhas:0x7a3...f4b2"
  platform_id: string;                // "BZH-2026-XXXXX"
  wallet_address: string;

  // Tier & Access
  tier: 'enterprise' | 'pro' | 'free';
  sectors: string[];
  edge_nodes: number;

  // Economy
  gas_tank_balance_usd: number;
  bez_balance: number;
  staked_bez: number;

  // Reputation (cross-app)
  reputation_score: number;           // 0–1000
  verified_assets: number;
  quality_verdicts: number;

  // Verifiable Credentials
  credentials: VerifiableCredential[];
}

const GATEWAY_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_GATEWAY_URL__ || 'http://localhost:3001/api/gateway/v1'
  : process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001/api/gateway/v1';

/**
 * useBezhasUID — Retrieve the full identity profile of the current user.
 * Aggregates on-chain data (balance, staking, assets) with off-chain profile (reputation, credentials).
 */
export function useBezhasUID() {
  const { isAuthenticated, jwt, did, address } = useBezhasAuth();
  const [identity, setIdentity] = useState<BeZhasIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !jwt || !did) {
      setIdentity(null);
      return;
    }

    const fetchIdentity = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${GATEWAY_URL}/identity/${did}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });

        if (!res.ok) throw new Error(`Identity fetch failed: ${res.status}`);

        const data = await res.json();
        setIdentity({
          did,
          platform_id: data.platform_id || `BZH-${new Date().getFullYear()}-${address?.slice(-5)?.toUpperCase()}`,
          wallet_address: address || '',
          tier: data.tier || 'free',
          sectors: data.sectors || [],
          edge_nodes: data.edge_nodes || 0,
          gas_tank_balance_usd: data.gas_tank_balance_usd || 0,
          bez_balance: data.bez_balance || 0,
          staked_bez: data.staked_bez || 0,
          reputation_score: data.reputation_score || 0,
          verified_assets: data.verified_assets || 0,
          quality_verdicts: data.quality_verdicts || 0,
          credentials: data.credentials || [],
        });
      } catch (err: any) {
        setError(err.message);
        // Provide minimal identity from auth data
        setIdentity({
          did,
          platform_id: `BZH-${new Date().getFullYear()}-${address?.slice(-5)?.toUpperCase() || 'XXXXX'}`,
          wallet_address: address || '',
          tier: 'free',
          sectors: [],
          edge_nodes: 0,
          gas_tank_balance_usd: 0,
          bez_balance: 0,
          staked_bez: 0,
          reputation_score: 0,
          verified_assets: 0,
          quality_verdicts: 0,
          credentials: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchIdentity();
  }, [isAuthenticated, jwt, did, address]);

  return { identity, isLoading, error, credentials: identity?.credentials || [] };
}

export default useBezhasUID;
