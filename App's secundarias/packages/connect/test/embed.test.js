// Unit tests for the embeddable widget core (embed/core.js) — no DOM, no network.
// Asserts the declarative widget→registry mapping, number coercion, required
// attrs, and that every widget points at a real registry action.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWidgetCall, resolveWidget, listWidgets, WIDGET_DEFS } from '../embed/core.js';

test('pay-button maps data attrs onto the pay.buy call', () => {
  const { subapp, action, params } = buildWidgetCall('pay-button', {
    amount: '49.9', method: 'card', email: 'a@b.com',
  });
  assert.equal(subapp, 'pay');
  assert.equal(action, 'buy');
  assert.deepEqual(params, { amountUSD: 49.9, paymentMethod: 'card', email: 'a@b.com' });
});

test('numeric attrs are coerced to numbers', () => {
  const { params } = buildWidgetCall('pay-button', { amount: '10', method: 'card' });
  assert.equal(typeof params.amountUSD, 'number');
  assert.equal(params.amountUSD, 10);
});

test('a non-numeric numeric attr throws', () => {
  assert.throws(
    () => buildWidgetCall('pay-button', { amount: 'free', method: 'card' }),
    /data-amount must be a number/,
  );
});

test('missing required attr throws before any call is built', () => {
  assert.throws(
    () => buildWidgetCall('pay-button', { amount: '10' }), // no method
    /requires data-method/,
  );
});

test('optional attrs are simply omitted when absent', () => {
  const { params } = buildWidgetCall('pay-price', {}); // amount is optional
  assert.deepEqual(params, {});
});

test('cargolink-track maps buid→bUid and rolekey→roleKey', () => {
  const { subapp, action, params } = buildWidgetCall('cargolink-track', {
    buid: 'B-123', rolekey: 'pos_key',
  });
  assert.equal(subapp, 'cargolink');
  assert.equal(action, 'getTx');
  assert.deepEqual(params, { bUid: 'B-123', roleKey: 'pos_key' });
});

test('unknown widget type throws and lists the available ones', () => {
  assert.throws(() => resolveWidget('teleporter'), /Unknown BeZhas widget "teleporter"/);
});

test('every widget points at a real registry action', () => {
  // resolveWidget cross-checks the registry; this guards against catalogue drift.
  for (const type of Object.keys(WIDGET_DEFS)) {
    assert.doesNotThrow(() => resolveWidget(type), `widget ${type} must resolve`);
  }
});

test('listWidgets() exposes the catalogue for discovery', () => {
  const widgets = listWidgets();
  const types = widgets.map((w) => w.type);
  assert.ok(types.includes('pay-button'));
  assert.ok(types.includes('cargolink-track'));
  const pb = widgets.find((w) => w.type === 'pay-button');
  assert.equal(pb.subapp, 'pay');
  assert.equal(pb.attrs.amount.required, true);
});
