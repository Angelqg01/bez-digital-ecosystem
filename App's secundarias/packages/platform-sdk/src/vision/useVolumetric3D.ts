import { useCallback } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';

interface VolumetricResult {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  volume_cm3: number;
  volume_m3: number;
  weight_estimate_kg: number | null;
  shape_classification: string;  // 'box' | 'cylinder' | 'irregular' | 'pallet'
  confidence: number;
  bounding_box_3d: {
    center: { x: number; y: number; z: number };
    rotation: { roll: number; pitch: number; yaw: number };
  } | null;
}

const AEGIS_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_AEGIS_URL__ || 'http://localhost:8001'
  : process.env.NEXT_PUBLIC_AEGIS_URL || 'http://localhost:8001';

/**
 * useVolumetric3D — 3D volumetric estimation from images.
 * 
 * Uses Gemini Vision + ARCore concepts to calculate L×W×H
 * from multi-angle photos. Critical for:
 * - Freight tarification (aduanas)
 * - Warehouse space optimization
 * - ASYCUDA customs declarations
 */
export function useVolumetric3D() {
  const { jwt } = useBezhasAuth();

  /**
   * Estimate volume from one or more images.
   * For best accuracy, provide 2-4 images from different angles.
   */
  const estimateVolume = useCallback(async (
    images: (File | Blob)[],
    referenceObject?: { type: string; size_cm: number }
  ): Promise<VolumetricResult> => {
    const formData = new FormData();
    images.forEach((img, i) => formData.append(`image_${i}`, img));
    formData.append('image_count', String(images.length));

    if (referenceObject) {
      formData.append('reference_type', referenceObject.type);
      formData.append('reference_size_cm', String(referenceObject.size_cm));
    }

    const res = await fetch(`${AEGIS_URL}/api/vision/volumetric`, {
      method: 'POST',
      headers: {
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) throw new Error('Volumetric estimation failed');
    const data = await res.json();

    const l = data.length_cm ?? 0;
    const w = data.width_cm ?? 0;
    const h = data.height_cm ?? 0;

    return {
      length_cm: l,
      width_cm: w,
      height_cm: h,
      volume_cm3: data.volume_cm3 ?? (l * w * h),
      volume_m3: data.volume_m3 ?? ((l * w * h) / 1_000_000),
      weight_estimate_kg: data.weight_estimate_kg ?? null,
      shape_classification: data.shape ?? 'box',
      confidence: data.confidence ?? 0,
      bounding_box_3d: data.bounding_box_3d ?? null,
    };
  }, [jwt]);

  return { estimateVolume };
}

export default useVolumetric3D;
