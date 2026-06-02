import { useCallback } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';

interface SIFTResult {
  hash: string;              // Cryptographic hash of SIFT descriptor vector
  keypoints_count: number;   // Number of keypoints detected
  descriptor_size: number;   // Descriptor vector dimension
  scale_invariant: boolean;
  rotation_invariant: boolean;
}

const AEGIS_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_AEGIS_URL__ || 'http://localhost:8001'
  : process.env.NEXT_PUBLIC_AEGIS_URL || 'http://localhost:8001';

/**
 * useSIFTFingerprint — Visual fingerprinting for anti-counterfeiting.
 * 
 * Uses Scale-Invariant Feature Transform (SIFT) to create a unique
 * visual "fingerprint" of any physical asset. This hash is anchored
 * to the blockchain as the "Golden Image" reference.
 * 
 * Properties:
 * - Invariant to rotation, scale, and partial illumination changes
 * - Detects micro-textures invisible to the naked eye
 * - Hash is deterministic: same product always produces the same fingerprint
 */
export function useSIFTFingerprint() {
  const { jwt } = useBezhasAuth();

  /**
   * Generate a SIFT fingerprint hash from an image.
   * This is the "Golden Image" step — done at the point of origin.
   */
  const generateFingerprint = useCallback(async (image: File | Blob): Promise<SIFTResult> => {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('algorithm', 'sift');

    const res = await fetch(`${AEGIS_URL}/api/vision/fingerprint`, {
      method: 'POST',
      headers: {
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) throw new Error('SIFT fingerprint generation failed');
    const data = await res.json();

    return {
      hash: data.hash || data.fingerprint_hash,
      keypoints_count: data.keypoints_count ?? 0,
      descriptor_size: data.descriptor_size ?? 128,
      scale_invariant: true,
      rotation_invariant: true,
    };
  }, [jwt]);

  /**
   * Compare two images using SIFT matching.
   * Returns a match score (0.0 = no match, 1.0 = identical).
   */
  const compareFingerprints = useCallback(async (
    currentImage: File | Blob,
    referenceHash: string
  ): Promise<{ matchScore: number; verdict: string; details: Record<string, any> }> => {
    const formData = new FormData();
    formData.append('image', currentImage);
    formData.append('reference_hash', referenceHash);

    const res = await fetch(`${AEGIS_URL}/api/vision/fingerprint/compare`, {
      method: 'POST',
      headers: {
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) throw new Error('SIFT comparison failed');
    const data = await res.json();

    const matchScore = data.match_score ?? 0;
    return {
      matchScore,
      verdict: matchScore >= 0.95 ? 'IDENTICAL'
             : matchScore >= 0.80 ? 'MINOR_DAMAGE'
             : matchScore >= 0.50 ? 'SIGNIFICANT_DAMAGE'
             : 'COUNTERFEIT_SUSPECTED',
      details: data.details || {},
    };
  }, [jwt]);

  return { generateFingerprint, compareFingerprints };
}

export default useSIFTFingerprint;
