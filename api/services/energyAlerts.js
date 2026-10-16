'use strict';

const { madridParts } = require('./energyFeedService');

/**
 * energyAlerts — alertas del operador calculadas con DATOS REALES (curva OMIE del día, estado de los nodos, eventos
 * Aegis). Sustituye a la lista fija de cuatro alertas con textos inventados («95 % solar», «RD 88/2026 compliant»).
 * Función pura: recibe los datos y la hora, devuelve las alertas.
 */

const TH = { CHARGE_BELOW: 30, DISCHARGE_ABOVE: 80, NEGATIVE: 0, PEAK_FACTOR: 1.3 };
const HORIZON_H = 6;

const eur = (v) => `${Number(v).toFixed(2)} €/MWh`;
const hh = (h) => `${String(h).padStart(2, '0')}:00`;

/** Curva OMIE → [{ hour:0..23, price }] (promedia los cuartos de hora si la curva es de 96 períodos). */
function hourlyCurve(curve) {
  if (!Array.isArray(curve) || !curve.length) return [];
  const perHour = Math.max(1, Math.round(curve.length / 24));
  const out = [];
  for (let h = 0; h < 24; h += 1) {
    const slice = curve.slice(h * perHour, (h + 1) * perHour).map((c) => c.price_es).filter((v) => Number.isFinite(v));
    if (slice.length) out.push({ hour: h, price: slice.reduce((a, b) => a + b, 0) / slice.length });
  }
  return out;
}

function buildAlerts({ omie, nodes = [], simulated = false, aegisEvents = [], now = new Date() } = {}) {
  const alerts = [];
  const hour = madridParts(now).hour;   // los períodos de OMIE son hora de Madrid, no la del servidor
  const exp = (hours) => new Date(now.getTime() + hours * 3_600_000).toISOString();
  const battery = nodes.find((n) => n.type === 'BATTERY') || null;
  const load = nodes.find((n) => n.type === 'LOAD') || null;

  const hourly = hourlyCurve(omie && omie.curve);
  if (omie && Number.isFinite(omie.price_eur_mwh) && hourly.length) {
    const ahead = hourly.filter((p) => p.hour > hour && p.hour <= hour + HORIZON_H);
    const avg = hourly.reduce((a, p) => a + p.price, 0) / hourly.length;
    const src = 'OMIE mercado diario (precios publicados)';

    if (omie.price_eur_mwh < TH.NEGATIVE) {
      alerts.push({ id: 'omie-negative-now', severity: 'WARNING', type: 'NEGATIVE_PRICE', source: src,
        message: `El precio marginal actual es negativo (${eur(omie.price_eur_mwh)}): conviene cargar almacenamiento y no verter.`,
        action: battery ? { command: 'CHARGE_BATTERY', nodeId: battery.id } : null, expires: exp(1) });
    } else if (omie.price_eur_mwh > TH.DISCHARGE_ABOVE) {
      alerts.push({ id: 'omie-high-now', severity: 'INFO', type: 'ARBITRAGE_DISCHARGE', source: src,
        message: `Precio actual ${eur(omie.price_eur_mwh)}, por encima del umbral de venta (${TH.DISCHARGE_ABOVE} €/MWh): ${battery ? 'ventana para descargar la batería y vender.' : 'buen momento para vender excedentes.'}`,
        action: battery ? { command: 'DISCHARGE_BATTERY', nodeId: battery.id } : null, expires: exp(1) });
    }

    const cheapest = ahead.length ? ahead.reduce((a, b) => (b.price < a.price ? b : a)) : null;
    if (cheapest && cheapest.price < TH.NEGATIVE) {
      alerts.push({ id: 'omie-negative-ahead', severity: 'WARNING', type: 'NEGATIVE_PRICE_IMMINENT', source: src,
        message: `OMIE publica precio negativo a las ${hh(cheapest.hour)} (${eur(cheapest.price)}). Prepara la carga de máxima potencia.`,
        action: battery ? { command: 'CHARGE_BATTERY', nodeId: battery.id } : null, expires: exp(cheapest.hour - hour) });
    } else if (cheapest && cheapest.price < TH.CHARGE_BELOW) {
      alerts.push({ id: 'omie-cheap-ahead', severity: 'INFO', type: 'ARBITRAGE_CHARGE', source: src,
        message: `Precio mínimo de las próximas ${HORIZON_H} h: ${eur(cheapest.price)} a las ${hh(cheapest.hour)} (umbral de carga ${TH.CHARGE_BELOW}).`,
        action: battery ? { command: 'CHARGE_BATTERY', nodeId: battery.id } : null, expires: exp(cheapest.hour - hour) });
    }

    const peak = ahead.length ? ahead.reduce((a, b) => (b.price > a.price ? b : a)) : null;
    if (peak && peak.price > avg * TH.PEAK_FACTOR && peak.price > TH.DISCHARGE_ABOVE) {
      alerts.push({ id: 'omie-peak-ahead', severity: 'INFO', type: 'DEMAND_RESPONSE_WINDOW', source: src,
        message: `Pico de precio a las ${hh(peak.hour)} (${eur(peak.price)}, ${Math.round((peak.price / avg - 1) * 100)} % sobre la media del día). Ventana para reducir carga controlable o vender.`,
        action: load ? { command: 'SHED_LOAD', nodeId: load.id, durationMin: 60 } : null, expires: exp(peak.hour - hour + 1) });
    }
  }

  const failed = aegisEvents.filter((e) => String(e.result).toUpperCase() === 'FAIL');
  if (failed.length) {
    alerts.push({ id: 'aegis-failures', severity: 'HIGH', type: 'AEGIS_ANOMALY', source: 'Aegis',
      message: `${failed.length} evento(s) de integridad de telemetría en 24 h (${[...new Set(failed.map((e) => e.type))].join(', ')}).`,
      action: null, expires: exp(24) });
  }

  if (simulated) {
    alerts.push({ id: 'telemetry-simulated', severity: 'INFO', type: 'TELEMETRY_SIMULATED', source: 'BeZhas Energy',
      message: 'La telemetría de nodos que ves es de demostración. Conecta tu planta (SCADA → Conectar planta) para operar con lecturas reales.',
      action: null, expires: exp(24) });
  }
  return alerts;
}

module.exports = { buildAlerts, hourlyCurve, TH };
