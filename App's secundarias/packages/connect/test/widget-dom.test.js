// Integration test for embed/widget.js mounting logic, with a compact fake DOM
// + fetch-backed client. Proves the browser glue wires a mounted widget to the
// real API call path (not just the pure mapping in embed.test.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import BeZhasConnect from '../src/index.js';
import { mountWidget } from '../embed/widget.js';

// ── Minimal DOM stub: just enough surface for widget.js ──────────────────────
function makeNode(tag) {
  const listeners = {};
  return {
    tagName: tag,
    className: '',
    _text: '',
    children: [],
    dataset: {},
    style: {},
    set textContent(v) { this._text = v; this.children = []; },
    get textContent() { return this._text; },
    append(...kids) { this.children.push(...kids); },
    appendChild(k) { this.children.push(k); return k; },
    addEventListener(ev, fn) { (listeners[ev] ||= []).push(fn); },
    _fire(ev) { return Promise.all((listeners[ev] || []).map((f) => f())); },
    querySelector() { return null; },
  };
}
function makeDoc() {
  const head = makeNode('head');
  return {
    head,
    createElement: (t) => makeNode(t),
    querySelectorAll: () => [],
    currentScript: null,
  };
}

function fakeFetch(responder) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = responder ? responder(url, init) : {};
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status, statusText: 'OK',
      text: async () => JSON.stringify(r.body ?? { success: true }),
    };
  };
  fn.calls = calls;
  return fn;
}

test('mounted pay-button calls pay.buy with mapped params and redirects to checkoutUrl', async () => {
  const doc = makeDoc();
  const fetch = fakeFetch(() => ({ body: { paymentId: 42, checkoutUrl: 'https://pay.example/c/42' } }));
  const client = new BeZhasConnect({ apiKey: 'pk_pub', baseUrl: 'https://api.example', fetch });

  // Stub window.location so the redirect is observable, not a real navigation.
  const prevWindow = globalThis.window;
  let redirected = null;
  globalThis.window = { location: { set href(v) { redirected = v; } } };

  const mount = makeNode('div');
  mount.dataset = { bezhasWidget: 'pay-button', amount: '49.9', method: 'card' };

  try {
    mountWidget(mount, { client, doc });
    const button = mount.children.find((c) => c.tagName === 'button');
    assert.ok(button, 'a button should be rendered');
    await button._fire('click');
  } finally {
    globalThis.window = prevWindow;
  }

  // The mapped registry call hit the right endpoint with the right body.
  assert.equal(fetch.calls.length, 1);
  const { url, init } = fetch.calls[0];
  assert.equal(url, 'https://api.example/api/gateway/v1/payments/buy');
  assert.equal(init.method, 'POST');
  assert.deepEqual(JSON.parse(init.body), { amountUSD: 49.9, paymentMethod: 'card' });
  // And the customer was sent to the hosted checkout.
  assert.equal(redirected, 'https://pay.example/c/42');
});

test('a bad widget config renders an inline error instead of throwing', () => {
  const doc = makeDoc();
  const client = new BeZhasConnect({ apiKey: 'pk', baseUrl: 'https://api.example', fetch: fakeFetch() });
  const mount = makeNode('div');
  mount.dataset = { bezhasWidget: 'pay-button', amount: '10' }; // missing method

  mountWidget(mount, { client, doc });
  const errNode = mount.children.find((c) => (c.className || '').includes('bez-err'));
  assert.ok(errNode, 'an error node should be rendered');
  assert.match(errNode.textContent, /requires data-method/);
});
