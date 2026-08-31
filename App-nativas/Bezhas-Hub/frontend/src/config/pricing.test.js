// Unit tests for the subscription pricing model (config/pricing.js).
// Pure logic — la "matemática del dinero" del calculador de Apps Nativas.
import { describe, it, expect } from 'vitest';
import {
  calculatePricing,
  BASE_PLANS,
  NATIVE_APP_ADDONS,
  BUNDLE_DISCOUNTS,
  ANNUAL_FREE_MONTHS,
  OPERANT_PRICE,
  addonPrice,
} from './pricing';

const priceOf = (id) => NATIVE_APP_ADDONS.find((a) => a.id === id).price;

describe('calculatePricing — base plans', () => {
  it('Starter sin add-ons de pago cuesta 0', () => {
    const q = calculatePricing({ planId: 'starter', activeAddons: [] });
    expect(q.monthly).toBe(0);
    expect(q.custom).toBe(false);
  });

  it('Business sin add-ons cuesta solo la base (499)', () => {
    const q = calculatePricing({ planId: 'business', activeAddons: [] });
    expect(q.basePrice).toBe(499);
    expect(q.monthly).toBe(499);
  });

  it('Enterprise VIP incluye todas las Apps Nativas sin coste extra', () => {
    const q = calculatePricing({ planId: 'enterprise_vip', activeAddons: ['pay', 'energy'] });
    expect(q.basePrice).toBe(2499);
    expect(q.addonsSubtotal).toBe(0); // includedAddons = Infinity
    expect(q.monthly).toBe(2499);
  });

  it('un planId desconocido cae al primer plan (Starter)', () => {
    const q = calculatePricing({ planId: 'no-existe', activeAddons: [] });
    expect(q.basePrice).toBe(BASE_PLANS[0].price);
  });
});

describe('calculatePricing — Apps Nativas incluidas (free slots)', () => {
  it('Business incluye 3 Apps Nativas: pay+cargolink quedan gratis', () => {
    const q = calculatePricing({ planId: 'business', activeAddons: ['pay', 'cargolink'] });
    expect(q.includedCount).toBe(2); // ambos caben en los 3 incluidos
    expect(q.addonsSubtotal).toBe(0);
    expect(q.monthly).toBe(499);
  });

  it('los slots gratis cubren primero las Apps Nativas MÁS caras', () => {
    // Starter incluye 1. Activamos pay(49) + energy(129) → energy (la cara) gratis.
    const q = calculatePricing({ planId: 'starter', activeAddons: ['pay', 'energy'] });
    expect(q.includedCount).toBe(1);
    expect(q.addonsSubtotal).toBe(priceOf('pay')); // solo paga la barata
  });
});

describe('calculatePricing — descuentos por bundle', () => {
  it('5 add-ons de pago aplican -25% sobre lo facturable', () => {
    const addons = ['pay', 'cargolink', 'capital', 'energy', 'purescan'];
    const q = calculatePricing({ planId: 'business', activeAddons: addons });
    // Business: 3 más caros gratis (energy 129, cargolink 89, capital 79).
    // Facturable: pay 49 + purescan 59 = 108.
    expect(q.addonsSubtotal).toBe(priceOf('pay') + priceOf('purescan'));
    // 5 add-ons → tier -25%.
    expect(q.discountRate).toBe(0.25);
    expect(q.discountAmount).toBe(Math.round(108 * 0.25));
    expect(q.monthly).toBe(499 + 108 - q.discountAmount); // 580
  });

  it('el tier de descuento se basa en el nº TOTAL de add-ons de pago, no en los facturables', () => {
    const addons = ['pay', 'cargolink', 'capital']; // 3 activos
    const q = calculatePricing({ planId: 'enterprise_vip', activeAddons: addons });
    // Verificamos el tier de descuento vía un plan con pocos slots incluidos.
    const q2 = calculatePricing({ planId: 'starter', activeAddons: addons });
    expect(q2.paidAddons.length).toBe(3);
    expect(q2.discountRate).toBe(0.15); // 3+ → -15%
    void q;
  });

  it('menos de 3 add-ons no tienen descuento', () => {
    const q = calculatePricing({ planId: 'starter', activeAddons: ['pay', 'cargolink'] });
    expect(q.discountRate).toBe(0);
    expect(q.discountAmount).toBe(0);
  });
});

describe('calculatePricing — facturación anual', () => {
  it('anual = mensual × (12 - meses gratis) y reporta el ahorro', () => {
    const cfg = { planId: 'business', activeAddons: ['pay', 'cargolink', 'capital', 'energy', 'purescan'] };
    const q = calculatePricing({ ...cfg, annual: true });
    expect(q.annual).toBe(q.monthly * (12 - ANNUAL_FREE_MONTHS));
    expect(q.annualSavings).toBe(q.monthly * ANNUAL_FREE_MONTHS);
  });

  it('mensual reporta annual como × 12 (sin descuento)', () => {
    const q = calculatePricing({ planId: 'business', activeAddons: [], annual: false });
    expect(q.annual).toBe(q.monthly * 12);
  });
});

describe('calculatePricing — Apps Nativas core', () => {
  it('Hub y Wallet (core) nunca suman al precio aunque se "activen"', () => {
    const q = calculatePricing({ planId: 'business', activeAddons: ['hub', 'wallet'] });
    expect(q.paidAddons.length).toBe(0); // core no cuenta como add-on de pago
    expect(q.monthly).toBe(499);
  });
});

describe('config integrity', () => {
  it('los tiers de descuento están ordenados de mayor a menor mínimo', () => {
    for (let i = 1; i < BUNDLE_DISCOUNTS.length; i++) {
      expect(BUNDLE_DISCOUNTS[i - 1].min).toBeGreaterThanOrEqual(BUNDLE_DISCOUNTS[i].min);
    }
  });

  it('hay exactamente 2 Apps Nativas core gratuitas', () => {
    const core = NATIVE_APP_ADDONS.filter((a) => a.core);
    expect(core.length).toBe(2);
    expect(core.every((a) => a.price === 0)).toBe(true);
  });
});


/**
 * OPERANT rompe dos supuestos del calculador y por eso lleva tests propios:
 * su precio depende del plan, y no se puede comp con los slots gratis. El
 * segundo es el importante — antes de `alwaysBilled`, un Business con 3 slots
 * libres activaba OPERANT y la plataforma servía hasta 1.186 €/mes de cómputo
 * facturando 0 €.
 */
describe('OPERANT — módulo de coste variable', () => {
  it('cuesta distinto en cada plan, según la cuota que entrega', () => {
    const operant = NATIVE_APP_ADDONS.find((a) => a.id === 'operant');
    expect(addonPrice(operant, 'creator_pro')).toBe(39);
    expect(addonPrice(operant, 'business')).toBe(249);
    expect(addonPrice(operant, 'enterprise_vip')).toBe(1199);
    expect(addonPrice(operant, 'starter')).toBe(0);
  });

  it('los módulos de precio plano no cambian con el plan', () => {
    const pay = NATIVE_APP_ADDONS.find((a) => a.id === 'pay');
    expect(addonPrice(pay, 'starter')).toBe(addonPrice(pay, 'enterprise_vip'));
  });

  it('NO se regala con los slots gratis del plan, aunque sobren', () => {
    // Business trae 3 slots y solo se activa OPERANT: antes salía gratis.
    const q = calculatePricing({ planId: 'business', activeAddons: ['operant'] });
    expect(q.monthly).toBe(499 + 249);
    expect(q.alwaysBilledAddons.map((a) => a.id)).toEqual(['operant']);
  });

  it('tampoco en Enterprise VIP, que incluye el resto de módulos sin coste', () => {
    const q = calculatePricing({
      planId: 'enterprise_vip',
      activeAddons: ['operant', 'pay', 'cargolink'],
    });
    expect(q.monthly).toBe(2499 + 1199, 'pay y cargolink sí van incluidas');
  });

  it('los slots gratis siguen cubriendo a los demás módulos', () => {
    const q = calculatePricing({ planId: 'business', activeAddons: ['operant', 'pay', 'cargolink'] });
    expect(q.includedCount).toBe(2);            // pay + cargolink, gratis
    expect(q.monthly).toBe(499 + 249);          // solo OPERANT factura
  });

  it('el descuento por bundle no muerde el precio de OPERANT', () => {
    const q = calculatePricing({
      planId: 'creator_pro',                    // 1 slot gratis
      activeAddons: ['operant', 'pay', 'cargolink', 'purescan', 'sphere'],
    });
    expect(q.discountRate).toBe(0.25);          // 5 módulos activos
    // El −25% cae sobre los descontables, nunca sobre los 39 € de OPERANT.
    expect(q.discountAmount).toBe(Math.round(q.discountableSubtotal * 0.25));
    expect(q.addonsSubtotal - q.discountableSubtotal).toBe(39);
  });

  it('pero OPERANT sí cuenta para alcanzar el tramo de descuento', () => {
    const sinOperant = calculatePricing({ planId: 'business', activeAddons: ['pay', 'cargolink'] });
    const conOperant = calculatePricing({ planId: 'business', activeAddons: ['pay', 'cargolink', 'operant'] });
    expect(sinOperant.discountRate).toBe(0);
    expect(conOperant.discountRate).toBe(0.15);
  });

  it('en Starter no suma nada: allí OPERANT es pago por uso puro', () => {
    const q = calculatePricing({ planId: 'starter', activeAddons: ['operant'] });
    expect(q.monthly).toBe(0);
    expect(OPERANT_PRICE.starter).toBe(0);
  });
});
