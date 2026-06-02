import { useCallback, useMemo } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';
import { BeZhasBillingClient, type AIUsagePayload, type AIChargeRequest } from './client';

export function useUnifiedBilling(gatewayUrl?: string) {
  const { address, jwt, isAuthenticated } = useBezhasAuth();

  const client = useMemo(() => new BeZhasBillingClient({
    gatewayUrl,
    token: jwt || undefined,
    walletAddress: address || undefined,
  }), [gatewayUrl, jwt, address]);

  const getBalance = useCallback(() => client.getBalance(), [client]);
  const getCoreMetadata = useCallback(() => client.getCoreMetadata(), [client]);
  const getCoreBEZBalance = useCallback(() => client.getCoreBEZBalance(), [client]);
  const getCreditPackages = useCallback(() => client.getCreditPackages(), [client]);
  const checkoutCreditPackage = useCallback((packageId: string) => client.checkoutCreditPackage(packageId), [client]);
  const getHistory = useCallback((params?: Record<string, string | number | undefined>) => client.getHistory(params), [client]);
  const getAIUsageSummary = useCallback(() => client.getAIUsageSummary(), [client]);
  const estimateAIUsage = useCallback((model: string, usage: AIUsagePayload) => client.estimateAIUsage(model, usage), [client]);
  const chargeAIUsage = useCallback((params: AIChargeRequest) => client.chargeAIUsage(params), [client]);
  const addFiatFunds = useCallback((amount: number) => client.addFiatFunds(amount), [client]);
  const addBezFunds = useCallback((amount: number, txHash: string) => client.addBezFunds(amount, txHash), [client]);

  return {
    client,
    address,
    isAuthenticated,
    getCoreMetadata,
    getCoreBEZBalance,
    getCreditPackages,
    checkoutCreditPackage,
    getBalance,
    getHistory,
    getAIUsageSummary,
    estimateAIUsage,
    chargeAIUsage,
    addFiatFunds,
    addBezFunds,
  };
}
