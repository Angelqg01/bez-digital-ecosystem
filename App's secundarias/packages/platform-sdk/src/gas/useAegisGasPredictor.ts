import { useState, useCallback } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';

export interface GasPrediction {
  optimal_hour: number;          // 0-23 (UTC)
  optimal_hour_local: string;    // "14:00" in user's timezone
  current_gas_gwei: number;
  predicted_low_gwei: number;
  savings_percent: number;       // e.g. 35 means 35% cheaper at optimal hour
  confidence: number;            // 0.0 - 1.0
  recommendation: 'EXECUTE_NOW' | 'WAIT_FOR_OPTIMAL' | 'CRITICAL_LOW';
}

const AEGIS_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_AEGIS_URL__ || 'http://localhost:8001'
  : process.env.NEXT_PUBLIC_AEGIS_URL || 'http://localhost:8001';

/**
 * useAegisGasPredictor — Intelligent gas timing recommendations.
 * 
 * Uses Aegis ML models to predict the cheapest time to execute 
 * heavy transactions (RWA minting, bridge operations, batch registrations).
 * Particularly valuable for Corporate Gas Tank users.
 */
export function useAegisGasPredictor() {
  const { jwt } = useBezhasAuth();
  const [prediction, setPrediction] = useState<GasPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const predict = useCallback(async (operationType: string = 'standard') => {
    setIsLoading(true);
    try {
      const res = await fetch(`${AEGIS_URL}/api/gas/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({
          operation_type: operationType,
          chain_id: 2708,
        }),
      });

      if (!res.ok) {
        // Fallback: recommend executing now
        const fallback: GasPrediction = {
          optimal_hour: new Date().getUTCHours(),
          optimal_hour_local: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          current_gas_gwei: 1,
          predicted_low_gwei: 1,
          savings_percent: 0,
          confidence: 0,
          recommendation: 'EXECUTE_NOW',
        };
        setPrediction(fallback);
        return fallback;
      }

      const data = await res.json();
      const pred: GasPrediction = {
        optimal_hour: data.optimal_hour ?? new Date().getUTCHours(),
        optimal_hour_local: data.optimal_hour_local ?? '--:--',
        current_gas_gwei: data.current_gas_gwei ?? 1,
        predicted_low_gwei: data.predicted_low_gwei ?? 1,
        savings_percent: data.savings_percent ?? 0,
        confidence: data.confidence ?? 0,
        recommendation: data.recommendation ?? 'EXECUTE_NOW',
      };
      setPrediction(pred);
      return pred;
    } catch {
      const fallback: GasPrediction = {
        optimal_hour: new Date().getUTCHours(),
        optimal_hour_local: 'Now',
        current_gas_gwei: 1,
        predicted_low_gwei: 1,
        savings_percent: 0,
        confidence: 0,
        recommendation: 'EXECUTE_NOW',
      };
      setPrediction(fallback);
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, [jwt]);

  return { prediction, isLoading, predict };
}

export default useAegisGasPredictor;
