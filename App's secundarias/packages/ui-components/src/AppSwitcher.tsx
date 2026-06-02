import React, { useState } from 'react';
import { ROUTES, getActiveRoutes, type AppRoute } from '@bezhas/platform-sdk';

interface AppSwitcherProps {
  currentAppId?: string;
  onNavigate?: (route: AppRoute) => void;
  compact?: boolean;
}

/**
 * AppSwitcher — Cross-app navigation component.
 * Shows all available sub-apps with status indicators.
 * Appears in the sidebar or header of every sub-app.
 */
export function AppSwitcher({ currentAppId, onNavigate, compact = false }: AppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const routes = getActiveRoutes();

  const statusColors: Record<string, string> = {
    'active': 'var(--bezhas-success)',
    'beta': 'var(--bezhas-warning)',
    'coming-soon': 'var(--bezhas-text-muted)',
  };

  const handleClick = (route: AppRoute) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        const portMap: Record<string, string> = {
          'hub': '3000',
          'wallet': '3010',
          'gas-tank': '3011',
          'edge-node': '3012',
          'scanner': '3013',
          'capital': '3014',
          'authentic': '3015',
          'customs': '3016',
        };
        const port = portMap[route.id];
        if (port) {
          window.location.href = `http://localhost:${port}/`;
          setIsOpen(false);
          return;
        }
      }
      window.location.href = route.basePath;
    }
    setIsOpen(false);
  };

  if (compact) {
    return React.createElement('div', {
      className: 'bezhas-app-switcher-compact',
      style: {
        position: 'relative',
      },
    }, [
      React.createElement('button', {
        key: 'trigger',
        onClick: () => setIsOpen(!isOpen),
        style: {
          background: 'var(--bezhas-surface)',
          border: '1px solid var(--bezhas-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2) var(--space-3)',
          color: 'var(--bezhas-text)',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        },
      }, '⬡ Apps'),
      isOpen && React.createElement('div', {
        key: 'dropdown',
        style: {
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 'var(--space-2)',
          background: 'var(--bezhas-surface)',
          border: '1px solid var(--bezhas-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-2)',
          minWidth: '240px',
          zIndex: 'var(--z-dropdown)',
          boxShadow: 'var(--shadow-lg)',
        },
      }, routes.map(route =>
        React.createElement('button', {
          key: route.id,
          onClick: () => handleClick(route),
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            background: route.id === currentAppId ? 'var(--bezhas-surface-2)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--bezhas-text)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            textAlign: 'left' as const,
          },
        }, [
          React.createElement('span', { key: 'icon' }, route.icon),
          React.createElement('span', { key: 'name', style: { flex: 1 } }, route.name),
          React.createElement('span', {
            key: 'status',
            style: {
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: statusColors[route.status] || statusColors['coming-soon'],
            },
          }),
        ])
      )),
    ]);
  }

  // Full sidebar version
  return React.createElement('nav', {
    className: 'bezhas-app-switcher',
    style: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 'var(--space-1)',
      padding: 'var(--space-4)',
    },
  }, [
    React.createElement('h3', {
      key: 'title',
      style: {
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-xs)',
        color: 'var(--bezhas-text-muted)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        marginBottom: 'var(--space-2)',
      },
    }, 'Ecosystem'),
    ...routes.map(route =>
      React.createElement('button', {
        key: route.id,
        onClick: () => handleClick(route),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          background: route.id === currentAppId
            ? 'linear-gradient(135deg, rgba(var(--bezhas-primary-rgb), 0.15), rgba(var(--bezhas-secondary-rgb), 0.1))'
            : 'transparent',
          border: route.id === currentAppId ? '1px solid rgba(var(--bezhas-primary-rgb), 0.3)' : '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          color: route.id === currentAppId ? 'var(--bezhas-primary)' : 'var(--bezhas-text-secondary)',
          cursor: route.status === 'coming-soon' ? 'default' : 'pointer',
          opacity: route.status === 'coming-soon' ? 0.4 : 1,
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          textAlign: 'left' as const,
          transition: 'all var(--transition-base)',
        },
      }, [
        React.createElement('span', { key: 'icon', style: { fontSize: '1.2em' } }, route.icon),
        React.createElement('div', { key: 'info', style: { flex: 1 } }, [
          React.createElement('div', { key: 'name', style: { fontWeight: 500 } }, route.name),
        ]),
        route.status === 'beta' && React.createElement('span', {
          key: 'badge',
          className: 'bezhas-badge bezhas-badge--warning',
          style: { fontSize: '0.6rem', padding: '1px 6px' },
        }, 'BETA'),
      ])
    ),
  ]);
}

export default AppSwitcher;
