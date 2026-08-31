import React, { type ReactNode } from 'react';
import { useBezhasAuth } from './useBezhasAuth';

interface PlatformGuardProps {
  children: ReactNode;
  /** Minimum tier required to access this route */
  requiredTier?: 'free' | 'pro' | 'enterprise';
  /** Custom component to show when not authenticated */
  fallback?: ReactNode;
  /** Custom component to show when tier is insufficient */
  tierFallback?: ReactNode;
}

const TIER_LEVELS = { free: 0, pro: 1, enterprise: 2 } as const;

/**
 * PlatformGuard — HOC for route protection across all sub-apps.
 * Wraps any route that requires authentication and/or a minimum tier.
 */
export function PlatformGuard({ 
  children, 
  requiredTier = 'free', 
  fallback,
  tierFallback 
}: PlatformGuardProps) {
  const { isAuthenticated, isLoading, tier } = useBezhasAuth();

  if (isLoading) {
    return React.createElement('div', { 
      className: 'bezhas-guard-loading',
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }
    }, 'Loading BeZhas...');
  }

  if (!isAuthenticated) {
    return (fallback as React.ReactElement) || React.createElement('div', {
      className: 'bezhas-guard-login',
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }
    }, 'Please connect your wallet to continue.');
  }

  if (tier && TIER_LEVELS[tier] < TIER_LEVELS[requiredTier]) {
    return (tierFallback as React.ReactElement) || React.createElement('div', {
      className: 'bezhas-guard-tier',
    }, `This feature requires a ${requiredTier} plan.`);
  }

  return React.createElement(React.Fragment, null, children);
}

export default PlatformGuard;
