import test from 'node:test';
import assert from 'node:assert/strict';
import { BeZhasBillingClient } from '../dist/billing/client.js';

test('BeZhasBillingClient sends auth headers and fetches Core metadata', async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ core: { chainId: 2708 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const client = new BeZhasBillingClient({
    gatewayUrl: 'https://gateway.test/api',
    token: 'jwt-token',
    walletAddress: '0x1111111111111111111111111111111111111111',
    apiKey: 'api-key',
  });

  const result = await client.getCoreMetadata();

  assert.equal(result.core.chainId, 2708);
  assert.equal(calls[0].url, 'https://gateway.test/api/billing/core');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer jwt-token');
  assert.equal(calls[0].init.headers['x-wallet-address'], '0x1111111111111111111111111111111111111111');
  assert.equal(calls[0].init.headers['x-api-key'], 'api-key');
});

test('BeZhasBillingClient estimates AI usage through unified billing endpoint', async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ success: true, data: { chargedBez: 0.12 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const client = new BeZhasBillingClient({ gatewayUrl: 'https://gateway.test/api' });
  const result = await client.estimateAIUsage('gpt-4o-mini', {
    inputTokens: 1000,
    cachedInputTokens: 200,
    outputTokens: 300,
  });

  assert.equal(result.data.chargedBez, 0.12);
  assert.equal(calls[0].url, 'https://gateway.test/api/billing/ai/estimate');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    model: 'gpt-4o-mini',
    usage: {
      inputTokens: 1000,
      cachedInputTokens: 200,
      outputTokens: 300,
    },
  });
});

test('BeZhasBillingClient starts checkout for predefined BEZ credit packages', async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ success: true, checkoutUrl: 'https://stripe.test/session' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const client = new BeZhasBillingClient({
    gatewayUrl: 'https://gateway.test/api',
    walletAddress: '0x2222222222222222222222222222222222222222',
  });
  const result = await client.checkoutCreditPackage('growth');

  assert.equal(result.checkoutUrl, 'https://stripe.test/session');
  assert.equal(calls[0].url, 'https://gateway.test/api/billing/packages/growth/checkout');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    walletAddress: '0x2222222222222222222222222222222222222222',
  });
});
