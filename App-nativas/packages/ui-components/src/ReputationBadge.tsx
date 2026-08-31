import React from 'react';

interface ReputationBadgeProps {
  score: number;         // 0-1000
  verifiedAssets: number;
  compact?: boolean;
}

/**
 * ReputationBadge — Shows cross-app reputation score.
 * Score grows as users scan assets, complete verdicts, and operate on BeZhas.
 */
export function ReputationBadge({ score, verifiedAssets, compact = false }: ReputationBadgeProps) {
  const tier = score >= 800 ? 'DIAMOND' : score >= 600 ? 'GOLD' : score >= 400 ? 'SILVER' : 'BRONZE';
  const tierColors: Record<string, string> = {
    DIAMOND: '#00D4FF',
    GOLD: '#F59E0B',
    SILVER: '#9CA3AF',
    BRONZE: '#B45309',
  };

  if (compact) {
    return React.createElement('span', {
      className: 'bezhas-reputation-compact',
      title: `Reputation: ${score}/1000 (${tier})`,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 'var(--space-1) var(--space-2)',
        background: 'var(--bezhas-surface)',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: tierColors[tier],
        border: `1px solid ${tierColors[tier]}33`,
      },
    }, [
      React.createElement('span', { key: 'icon' }, '⭐'),
      React.createElement('span', { key: 'score' }, score),
    ]);
  }

  return React.createElement('div', {
    className: 'bezhas-reputation-badge',
    style: {
      padding: 'var(--space-4)',
      background: 'var(--bezhas-surface)',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${tierColors[tier]}33`,
    },
  }, [
    React.createElement('div', {
      key: 'tier',
      style: {
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        color: tierColors[tier],
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        marginBottom: 'var(--space-1)',
      },
    }, `⭐ ${tier}`),
    React.createElement('div', {
      key: 'score',
      style: { fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--bezhas-text)' },
    }, `${score}`),
    React.createElement('div', {
      key: 'label',
      style: { fontSize: 'var(--text-xs)', color: 'var(--bezhas-text-muted)', marginTop: 'var(--space-1)' },
    }, `${verifiedAssets} verified assets`),
  ]);
}

export default ReputationBadge;
