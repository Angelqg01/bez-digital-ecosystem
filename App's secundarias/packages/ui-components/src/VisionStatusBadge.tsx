import React from 'react';
import type { VisionResult } from '@bezhas/platform-sdk';

interface VisionStatusBadgeProps {
  verdict: VisionResult['verdict'];
  confidence?: number;
  showConfidence?: boolean;
}

const VERDICT_CONFIG: Record<string, { label: string; icon: string; className: string }> = {
  APPROVED: { label: 'Approved', icon: '✅', className: 'vision-badge--approved' },
  REJECTED: { label: 'Rejected', icon: '❌', className: 'vision-badge--rejected' },
  PENDING: { label: 'Analyzing...', icon: '🔄', className: 'vision-badge--scanning' },
  REVIEW_NEEDED: { label: 'Review Needed', icon: '⚠️', className: 'vision-badge--scanning' },
};

const DEFAULT_CONFIG = VERDICT_CONFIG.PENDING;

/**
 * VisionStatusBadge — Shows the result of a Gemini Vision analysis.
 * Used in BEZ_Scaner, PureScan, and Authentic apps.
 */
export function VisionStatusBadge({ verdict, confidence, showConfidence = true }: VisionStatusBadgeProps) {
  const config = VERDICT_CONFIG[verdict as string] || DEFAULT_CONFIG;

  return React.createElement('span', {
    className: `bezhas-badge ${config.className}`,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      padding: 'var(--space-1) var(--space-3)',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
    },
  }, [
    React.createElement('span', { key: 'icon' }, config.icon),
    React.createElement('span', { key: 'label' }, config.label),
    showConfidence && confidence !== undefined && React.createElement('span', {
      key: 'conf',
      style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', opacity: 0.8 },
    }, `${(confidence * 100).toFixed(1)}%`),
  ]);
}

export default VisionStatusBadge;
