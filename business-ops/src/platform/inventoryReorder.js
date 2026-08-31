'use strict';

/**
 * inventoryReorder — punto de pedido y cantidad a reponer, calculados con
 * fórmula, no con la impresión del modelo al leer una tabla de stock.
 *
 * Mismo motivo que en `priceCatalog`/`expenseCategories`/`requisitionMatch`:
 * "cuánto pedir" es un número real con consecuencia económica real (pedir de
 * menos rompe stock, pedir de más inmoviliza caja), y dejárselo a un LLM que
 * "analiza la tabla y propone cantidades" es el mismo fallo que ya se corrigió
 * en el resto de departamentos, aquí con inventario en vez de dinero.
 *
 * Fórmula estándar de gestión de inventario:
 *   punto de pedido = consumo diario medio × plazo de entrega (días) + stock de seguridad
 *
 * Si un SKU no tiene definida una política de reposición (`maxLevel` o
 * `reorderQty`), el módulo NO inventa una cantidad: avisa de que hace falta
 * stock, pero deja la cifra a un humano. Cuánto comprar es una decisión de
 * negocio (caja disponible, descuentos por volumen, caducidad) que no se
 * adivina desde una fórmula genérica.
 */

/**
 * @param {object} item
 * @param {string} item.sku
 * @param {number} item.currentStock
 * @param {number} item.avgDailyUsage
 * @param {number} item.leadTimeDays
 * @param {number} [item.safetyStock=0]
 * @param {number} [item.maxLevel]    - nivel objetivo: repone hasta aquí
 * @param {number} [item.reorderQty]  - cantidad fija de reposición
 * @returns {{
 *   sku, reorderPoint: number|null, needsReorder: boolean|null,
 *   daysOfStockLeft: number|null, willStockOutBeforeRestock: boolean|null,
 *   suggestedQty: number|null, reason: string|null
 * }}
 */
function evaluate(item = {}) {
  const sku = item.sku;
  const currentStock = Number(item.currentStock);
  const avgDailyUsage = Number(item.avgDailyUsage);
  const leadTimeDays = Number(item.leadTimeDays);
  const safetyStock = Number(item.safetyStock || 0);

  if (!sku || !Number.isFinite(currentStock) || !Number.isFinite(avgDailyUsage) || !Number.isFinite(leadTimeDays)) {
    return {
      sku: sku || null, reorderPoint: null, needsReorder: null,
      daysOfStockLeft: null, willStockOutBeforeRestock: null, suggestedQty: null,
      reason: 'datos insuficientes (currentStock, avgDailyUsage y leadTimeDays son obligatorios)',
    };
  }

  const reorderPoint = avgDailyUsage * leadTimeDays + safetyStock;
  const needsReorder = currentStock <= reorderPoint;
  const daysOfStockLeft = avgDailyUsage > 0 ? currentStock / avgDailyUsage : Infinity;
  // Si al ritmo actual de consumo el stock se agota ANTES de que llegue un
  // pedido hecho hoy, es urgente de verdad, no solo "hay que reponer".
  const willStockOutBeforeRestock = needsReorder && daysOfStockLeft < leadTimeDays;

  let suggestedQty = null;
  let reason = null;
  if (needsReorder) {
    if (item.maxLevel != null) {
      suggestedQty = Math.max(0, Math.round(item.maxLevel - currentStock));
    } else if (item.reorderQty != null) {
      suggestedQty = Math.round(item.reorderQty);
    } else {
      reason = 'necesita reposición pero no hay maxLevel ni reorderQty configurados: no se inventa una cantidad';
    }
  }

  return { sku, reorderPoint, needsReorder, daysOfStockLeft, willStockOutBeforeRestock, suggestedQty, reason };
}

/**
 * Evalúa varios SKUs y los ordena por urgencia: primero los que se quedan
 * sin stock antes de que llegue un pedido hecho hoy, luego por días restantes.
 */
function evaluateAll(items = []) {
  const results = items.map(evaluate);
  const necesitan = results.filter((r) => r.needsReorder);
  necesitan.sort((a, b) => {
    if (a.willStockOutBeforeRestock !== b.willStockOutBeforeRestock) return a.willStockOutBeforeRestock ? -1 : 1;
    return (a.daysOfStockLeft ?? Infinity) - (b.daysOfStockLeft ?? Infinity);
  });
  return {
    all: results,
    needsReorder: necesitan,
    missingPolicy: necesitan.filter((r) => r.suggestedQty == null),
    critical: necesitan.filter((r) => r.willStockOutBeforeRestock),
  };
}

module.exports = { evaluate, evaluateAll };
