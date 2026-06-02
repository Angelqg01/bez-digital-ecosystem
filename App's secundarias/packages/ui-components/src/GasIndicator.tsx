import React from 'react';

interface GasIndicatorProps {
  balanceUsd: number;
  estimatedTxs: number;
  isLow: boolean;
  compact?: boolean;
}

/**
 * GasIndicator — Shows gas tank balance in all sub-apps.
 * Appears in the header/toolbar. Red when low, green when healthy.
 */
export function GasIndicator({ balanceUsd, estimatedTxs, isLow, compact = false }: GasIndicatorProps) {
  const percentage = Math.min((balanceUsd / 100) * 100, 100); // Assumes $100 = full

  if (compact) {
    return React.createElement('div', {
      className: 'bezhas-gas-indicator-compact',
      title: `$${balanceUsd.toFixed(2)} — ~${estimatedTxs} txs remaining`,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-1) var(--space-3)',
        background: 'var(--bezhas-surface)',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        color: isLow ? 'var(--bezhas-error)' : 'var(--bezhas-success)',
        border: `1px solid ${isLow ? 'var(--bezhas-error)' : 'var(--bezhas-border-subtle)'}`,
      },
    }, [
      React.createElement('span', { key: 'icon' }, '⛽'),
      React.createElement('span', { key: 'val', style: { fontFamily: 'var(--font-mono)', fontWeight: 600 } },
        `$${balanceUsd.toFixed(2)}`
      ),
    ]);
  }

  return React.createElement('div', {
    className: 'bezhas-gas-indicator',
    style: {
      padding: 'var(--space-4)',
      background: 'var(--bezhas-surface)',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${isLow ? 'var(--bezhas-error)' : 'var(--bezhas-border-subtle)'}`,
    },
  }, [
    React.createElement('div', {
      key: 'header',
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' },
    }, [
      React.createElement('span', { key: 'label', style: { fontSize: 'var(--text-sm)', color: 'var(--bezhas-text-secondary)' } }, '⛽ Gas Tank'),
      React.createElement('span', {
        key: 'value',
        style: { fontFamily: 'var(--font-mono)', fontWeight: 700, color: isLow ? 'var(--bezhas-error)' : 'var(--bezhas-text)' },
      }, `$${balanceUsd.toFixed(2)}`),
    ]),
    React.createElement('div', {
      key: 'bar-bg',
      style: { height: '4px', background: 'var(--bezhas-surface-2)', borderRadius: 'var(--radius-full)', overflow: 'hidden' },
    }, React.createElement('div', {
      style: {
        height: '100%',
        width: `${percentage}%`,
        background: isLow
          ? 'var(--bezhas-error)'
          : `linear-gradient(90deg, var(--bezhas-primary), var(--bezhas-secondary))`,
        borderRadius: 'var(--radius-full)',
        transition: 'width var(--transition-slow)',
      },
    })),
    React.createElement('div', {
      key: 'footer',
      style: { marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--bezhas-text-muted)' },
    }, `~${estimatedTxs.toLocaleString()} transactions remaining`),
  ]);
}

export default GasIndicator;
