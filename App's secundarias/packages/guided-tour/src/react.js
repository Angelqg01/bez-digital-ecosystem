// @bezhas/guided-tour — React bindings
// Thin wrappers over the vanilla launcher. Written with React.createElement (no
// JSX) so the file needs no transpilation and resolves directly from node_modules.
// React is a peer dependency (uses the host app's instance).

import { createElement, useEffect } from 'react';
import { mountGuidedTour, openGuidedTour } from './launcher.js';

const DEFAULT_EVENT = 'guided-tour:open';

/**
 * Mount-once component. Place it near the app root (renders nothing).
 * Props: { appName, src, eventName, seenKey, autoShow, delayMs }
 */
export function GuidedTour(props = {}) {
  const {
    appName = 'BeZhas',
    src = '/como-usar.html',
    eventName = DEFAULT_EVENT,
    seenKey = 'bez_tour_seen_v1',
    autoShow = true,
    delayMs = 1200,
  } = props;

  useEffect(() => {
    const handle = mountGuidedTour({ appName, src, eventName, seenKey, autoShow, delayMs });
    return () => handle.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/**
 * Button that opens the tour. `compact` renders a small header-style pill.
 * Props: { eventName, compact, label, style }
 */
export function TourButton(props = {}) {
  const { eventName = DEFAULT_EVENT, compact = false, label, style = {} } = props;
  const onClick = () => openGuidedTour(eventName);

  const icon = createElement(
    'svg',
    { width: compact ? 15 : 16, height: compact ? 15 : 16, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
    createElement('path', { d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 6 6 4-6 4V8Z' }),
  );

  if (compact) {
    return createElement(
      'button',
      {
        onClick,
        title: 'Cómo usar la app',
        style: {
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bz-surface-container, #201f1f)',
          border: '1px solid var(--bz-border, #2D2D2D)', borderRadius: 6,
          color: 'var(--bz-text, #e5e2e1)', padding: '6px 12px', cursor: 'pointer', ...style,
        },
      },
      createElement('span', { style: { color: 'var(--bz-primary, #00F0FF)', display: 'inline-flex' } }, icon),
      createElement('span', { style: { fontSize: 10, fontWeight: 800 } }, label || 'CÓMO USAR'),
    );
  }

  return createElement(
    'button',
    { onClick, className: 'btn btn-primary', style: { display: 'flex', alignItems: 'center', gap: 8, ...style } },
    icon,
    label || 'Cómo usar la app',
  );
}

export default GuidedTour;
