import { useState, useCallback } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';

export type VisionMode = 'quality-check' | 'volumetric-3d' | 'food-safety' | 'authenticity';

export interface VisionResult {
  fingerprintHash: string;       // SIFT hash for on-chain anchoring
  verdict: 'APPROVED' | 'REJECTED' | 'PENDING' | 'REVIEW_NEEDED';
  confidence: number;            // 0.00 → 1.00
  metadata: Record<string, any>; // Mode-specific data (volume, weight, freshness, etc.)
  txReady: boolean;              // Ready for NFT minting
  imageId: string;               // Reference to the stored Golden Image
  analysisTime: number;          // Time in ms
}

const AEGIS_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_AEGIS_URL__ || 'http://localhost:8001'
  : process.env.NEXT_PUBLIC_AEGIS_URL || 'http://localhost:8001';

/**
 * useGeminiVision — Core Vision hook for RWA asset analysis.
 * 
 * Connects to the Aegis backend which proxies Gemini Vision API.
 * Supports 4 modes:
 * - quality-check:  Structural integrity, damage detection (SIFT comparison)
 * - volumetric-3d:  Length × Width × Height estimation from images
 * - food-safety:    Freshness, allergens, nutritional analysis
 * - authenticity:   High-res micro-texture verification (anti-counterfeiting)
 */
export function useGeminiVision() {
  const { jwt } = useBezhasAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeAsset = useCallback(async (
    imageInput: File | Blob | string,
    mode: VisionMode = 'quality-check'
  ): Promise<VisionResult> => {
    setIsAnalyzing(true);
    setError(null);
    const startTime = Date.now();

    try {
      const formData = new FormData();

      if (typeof imageInput === 'string') {
        // Base64 or URL
        formData.append('image_url', imageInput);
      } else {
        formData.append('image', imageInput);
      }
      formData.append('mode', mode);

      const res = await fetch(`${AEGIS_URL}/api/vision/analyze`, {
        method: 'POST',
        headers: {
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Vision analysis failed' }));
        throw new Error(errData.error || `Analysis failed: ${res.status}`);
      }

      const data = await res.json();

      const result: VisionResult = {
        fingerprintHash: data.fingerprint_hash || data.siftHash || '',
        verdict: data.verdict || 'PENDING',
        confidence: data.confidence ?? 0,
        metadata: data.extracted_data || data.metadata || {},
        txReady: data.verdict === 'APPROVED',
        imageId: data.image_id || '',
        analysisTime: Date.now() - startTime,
      };

      setLastResult(result);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, [jwt]);

  /**
   * Compare current scan against the Golden Image stored on-chain.
   * Used at destination to verify product hasn't been damaged or swapped.
   */
  const verifyAgainstGolden = useCallback(async (
    currentImage: File | Blob,
    goldenImageHash: string
  ): Promise<VisionResult> => {
    setIsAnalyzing(true);
    setError(null);
    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('image', currentImage);
      formData.append('golden_hash', goldenImageHash);
      formData.append('mode', 'verify');

      const res = await fetch(`${AEGIS_URL}/api/vision/verify`, {
        method: 'POST',
        headers: {
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Verification failed');
      const data = await res.json();

      const result: VisionResult = {
        fingerprintHash: data.current_hash || '',
        verdict: data.match_score >= 0.95 ? 'APPROVED'
               : data.match_score >= 0.80 ? 'REVIEW_NEEDED'
               : 'REJECTED',
        confidence: data.match_score ?? 0,
        metadata: {
          match_score: data.match_score,
          ssim: data.ssim,
          psnr: data.psnr,
          damage_regions: data.damage_regions || [],
          difference_map_url: data.difference_map_url,
        },
        txReady: false,
        imageId: data.image_id || '',
        analysisTime: Date.now() - startTime,
      };

      setLastResult(result);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, [jwt]);

  return { analyzeAsset, verifyAgainstGolden, isAnalyzing, lastResult, error };
}

export default useGeminiVision;
