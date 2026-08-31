'use strict';

/**
 * Tests de facturación: proveedor simulado, suscripción y previsualización de
 * factura (cuota del plan + excedente de llamadas).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const Billing = require('../src/platform/Billing');
const { createBillingProvider, SimulatedProvider } = require('../src/platform/billingProvider');
const PLANS = require('../config/plans.json');

test('sin STRIPE_SECRET_KEY el proveedor es simulado', () => {
  assert.ok(createBillingProvider({}) instanceof SimulatedProvider);
});

test('subscribe registra la suscripción del tenant', async () => {
  const billing = new Billing({ plans: PLANS });
  const sub = await billing.subscribe('acme', 'creator_pro');
  assert.equal(sub.plan, 'creator_pro');
  assert.equal(sub.providerRef.simulated, true);
  assert.equal(billing.getSubscription('acme').plan, 'creator_pro');

  await assert.rejects(() => billing.subscribe('acme', 'galáctico'), /plan inválido/);
});

test('factura sin excedente: solo la cuota del plan', async () => {
  const billing = new Billing({ plans: PLANS });
  await billing.subscribe('acme', 'creator_pro'); // 99 EUR/mes, 900 llamadas incluidas

  const inv = billing.invoicePreview('acme', { callsUsed: 300, modelCostUsd: 1.2345 });
  assert.equal(inv.overageCalls, 0);
  assert.equal(inv.totalEur, 99);
  assert.equal(inv.currency, 'EUR');
  assert.equal(inv.lineItems.length, 1);
  assert.equal(inv.modelCostUsd, 1.23, 'redondeo a 2 decimales');
});

test('con excedente, la línea remite a BeZhas en vez de inventar una tarifa', async () => {
  const billing = new Billing({ plans: PLANS });
  await billing.subscribe('acme', 'creator_pro');

  const inv = billing.invoicePreview('acme', { callsUsed: 1000 }); // 100 por encima de las 900
  assert.equal(inv.overageCalls, 100);
  assert.equal(inv.totalEur, 99, 'la cuota fija no incluye el excedente');
  assert.equal(inv.lineItems.length, 2);
  assert.equal(inv.lineItems[1].amountEur, null);
  assert.equal(inv.overageBilledBy, 'bezhas-gateway');
  assert.match(inv.lineItems[1].note, /pago por uso/);
});

test('sin suscripción, la factura asume starter (0 EUR: pago por uso puro)', () => {
  const billing = new Billing({ plans: PLANS });
  const inv = billing.invoicePreview('desconocido', { callsUsed: 0 });
  assert.equal(inv.plan, 'starter');
  assert.equal(inv.totalEur, 0);
  assert.equal(inv.billedBy, 'bezhas-gateway');
});
