'use strict';

const BaseAgent = require('../BaseAgent');
const reorder = require('../../platform/inventoryReorder');

/**
 * Inventory — vigila el stock y avisa de reposiciones necesarias.
 *
 * El punto de pedido y la cantidad a reponer los calcula
 * `platform/inventoryReorder.js` con la fórmula estándar (consumo diario ×
 * plazo de entrega + stock de seguridad), no el modelo "leyendo la tabla".
 * Mismo motivo que en Finanzas y Ventas: pedir de menos rompe stock, pedir de
 * más inmoviliza caja, y ambos son números reales con consecuencia real.
 *
 * Si un SKU no tiene política de reposición (`maxLevel`/`reorderQty`), NO se
 * inventa una cantidad — se avisa de que hace falta stock y se deja la cifra
 * a quien decide compras. El modelo solo redacta el resumen y prioriza.
 */
class InventoryAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'operations.inventory',
      name: 'Inventory Monitor',
      department: 'operations',
      modelTier: 'fast',
      capabilities: ['operations:inventory'],
      systemPrompt:
        'Recibes el análisis de inventario YA CALCULADO: qué SKUs necesitan reposición, '
        + 'cuáles son urgentes y las cantidades ya resueltas. Redacta un resumen breve y '
        + 'accionable. No inventes cantidades para los SKUs marcados sin política definida.',
    });
  }

  async run(task) {
    const items = task.payload?.stock || task.payload?.items || [];
    if (!items.length) {
      return { status: 'blocked', reason: 'sin datos de stock que analizar', analysis: null };
    }

    const analysis = reorder.evaluateAll(items);

    if (analysis.critical.length) {
      this.bus?.emit('operations:stock_critical', {
        tenantId: this.tenantId,
        skus: analysis.critical.map((r) => ({ sku: r.sku, daysOfStockLeft: r.daysOfStockLeft, suggestedQty: r.suggestedQty })),
      });
    }

    if (!analysis.needsReorder.length) {
      return { status: 'ok', analysis, report: 'Ningún SKU necesita reposición ahora mismo.' };
    }

    const resumen = analysis.needsReorder.map((r) => (
      `${r.sku}: ${r.willStockOutBeforeRestock ? 'URGENTE (se agota antes de que llegue el pedido)' : 'reponer'}`
      + ` — quedan ${r.daysOfStockLeft.toFixed(1)} días de stock`
      + (r.suggestedQty != null ? `, pedir ${r.suggestedQty} unidades` : ', SIN política de reposición configurada')
    )).join('\n');

    const report = await this.think(
      `Resume esta situación de inventario para quien decide compras:\n${resumen}`,
      { useMemory: false, maxTokens: 400 },
    );

    return { status: 'ok', analysis, report };
  }
}

module.exports = InventoryAgent;
