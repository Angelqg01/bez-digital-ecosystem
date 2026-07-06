// embed/core.js — pure, DOM-free core for the embeddable widget.
//
// Maps a declarative widget type (what a 3rd-party writes in HTML) onto a
// (subapp, action, params) call against the Capability Registry. Kept separate
// from widget.js so the mapping logic is unit-testable under `node --test`
// without a browser/DOM.
//
//   <div data-bezhas-widget="pay-button" data-amount="49.9" data-method="card">
//
// resolves to:  bezhas.service('pay').call('buy', { amountUSD: 49.9, paymentMethod: 'card' })

import { getSubAppDescriptor } from '../src/registry.js';

/**
 * Widget catalogue. Each entry binds a host-facing widget name to a registry
 * action and declares how its `data-*` attributes map onto call params.
 *
 *   subapp/action  → the registry call it performs
 *   attrs          → { dataAttr: { param, type, required } }  (type: 'string'|'number')
 *   render         → hint for widget.js on what UI to draw
 */
export const WIDGET_DEFS = {
  'pay-button': {
    subapp: 'pay',
    action: 'buy',
    render: 'button',
    label: 'Pagar con BeZhas',
    attrs: {
      amount: { param: 'amountUSD', type: 'number', required: true },
      method: { param: 'paymentMethod', type: 'string', required: true },
      wallet: { param: 'walletAddress', type: 'string' },
      email: { param: 'email', type: 'string' },
      usecase: { param: 'stripeUseCase', type: 'string' },
    },
    // After buy(): redirect/embed checkoutUrl, or show bank-transfer instructions.
    result: 'checkout',
  },
  'pay-price': {
    subapp: 'pay',
    action: 'tokenomics',
    render: 'price',
    label: 'Precio en BEZ',
    attrs: {
      amount: { param: 'amountUSD', type: 'number' },
    },
    result: 'display',
  },
  'cargolink-track': {
    subapp: 'cargolink',
    action: 'getTx',
    render: 'tracker',
    label: 'Rastrear envío',
    attrs: {
      buid: { param: 'bUid', type: 'string', required: true },
      rolekey: { param: 'roleKey', type: 'string' },
    },
    result: 'timeline',
  },
};

/** Resolve a widget definition, throwing a clear error listing the known types. */
export function resolveWidget(type) {
  const def = WIDGET_DEFS[type];
  if (!def) {
    throw new Error(
      `Unknown BeZhas widget "${type}". Available: ${Object.keys(WIDGET_DEFS).join(', ')}.`,
    );
  }
  // Fail loudly if a widget points at an action that isn't in the registry
  // (guards against the catalogue drifting from registry.js).
  const descriptor = getSubAppDescriptor(def.subapp);
  if (!descriptor.actions[def.action]) {
    throw new Error(
      `Widget "${type}" references unknown action "${def.subapp}.${def.action}".`,
    );
  }
  return def;
}

/**
 * Turn a flat attribute bag (DOM dataset, or a plain object in tests) into the
 * params object the registry action expects — coercing numbers and enforcing
 * the widget's required attributes.
 * @param {string} type
 * @param {Record<string,string>} dataset  e.g. { amount: '49.9', method: 'card' }
 * @returns {{ subapp:string, action:string, params:object, def:object }}
 */
export function buildWidgetCall(type, dataset = {}) {
  const def = resolveWidget(type);
  const params = {};

  for (const [attr, spec] of Object.entries(def.attrs)) {
    const raw = dataset[attr];
    if (raw === undefined || raw === null || raw === '') {
      if (spec.required) {
        throw new TypeError(`Widget "${type}" requires data-${attr}.`);
      }
      continue;
    }
    if (spec.type === 'number') {
      const n = Number(raw);
      if (Number.isNaN(n)) {
        throw new TypeError(`Widget "${type}" data-${attr} must be a number, got "${raw}".`);
      }
      params[spec.param] = n;
    } else {
      params[spec.param] = String(raw);
    }
  }

  return { subapp: def.subapp, action: def.action, params, def };
}

/** The widget types this build exposes (for discovery / docs). */
export function listWidgets() {
  return Object.entries(WIDGET_DEFS).map(([type, def]) => ({
    type,
    subapp: def.subapp,
    action: def.action,
    render: def.render,
    label: def.label,
    attrs: Object.fromEntries(
      Object.entries(def.attrs).map(([a, s]) => [a, { param: s.param, type: s.type, required: !!s.required }]),
    ),
  }));
}
