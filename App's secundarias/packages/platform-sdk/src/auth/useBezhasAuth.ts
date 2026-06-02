import { useState, useEffect, useCallback } from 'react';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  address: string | null;
  jwt: string | null;
  did: string | null;
  tier: 'enterprise' | 'pro' | 'free' | null;
  error: string | null;
}

const GATEWAY_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_GATEWAY_URL__ || 'http://localhost:3001/api/gateway/v1'
  : process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001/api/gateway/v1';

/**
 * useBezhasAuth — Unified SIWE + JWT authentication hook.
 * 
 * Flow: Connect Wallet → Sign SIWE message → Get JWT → Resolve/Create DID
 * Used by ALL sub-apps for SSO (Single Sign-On) across the ecosystem.
 */
export function useBezhasAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    address: null,
    jwt: null,
    did: null,
    tier: null,
    error: null,
  });

  // Check existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem('bezhas_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        // Validate JWT hasn't expired
        if (session.jwt && session.expiry > Date.now()) {
          setState({
            isAuthenticated: true,
            isLoading: false,
            address: session.address,
            jwt: session.jwt,
            did: session.did,
            tier: session.tier,
            error: null,
          });
          return;
        }
      } catch { /* Invalid session, proceed to unauthenticated */ }
    }
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  const login = useCallback(async (walletAddress: string, signMessage: (msg: string) => Promise<string>) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      // 1. Request SIWE nonce from Gateway
      const nonceRes = await fetch(`${GATEWAY_URL}/auth/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress }),
      });
      const { nonce, message: siweMessage } = await nonceRes.json();

      // 2. Sign the SIWE message with user's wallet
      const signature = await signMessage(siweMessage || `BeZhas Login — Nonce: ${nonce}`);

      // 3. Verify signature & get JWT + DID
      const verifyRes = await fetch(`${GATEWAY_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, signature, nonce }),
      });
      const { jwt, did, tier } = await verifyRes.json();

      // 4. Persist session
      const session = {
        address: walletAddress,
        jwt,
        did: did || `did:bezhas:${walletAddress}`,
        tier: tier || 'free',
        expiry: Date.now() + (24 * 60 * 60 * 1000), // 24h
      };
      localStorage.setItem('bezhas_session', JSON.stringify(session));

      setState({
        isAuthenticated: true,
        isLoading: false,
        address: walletAddress,
        jwt,
        did: session.did,
        tier: session.tier,
        error: null,
      });

      return session;
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Authentication failed',
      }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('bezhas_session');
    setState({
      isAuthenticated: false,
      isLoading: false,
      address: null,
      jwt: null,
      did: null,
      tier: null,
      error: null,
    });
  }, []);

  return { ...state, login, logout };
}

export default useBezhasAuth;
