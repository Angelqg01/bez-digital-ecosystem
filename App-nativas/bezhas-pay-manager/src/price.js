export { ORACLE_PATH, parseOraclePrice, fetchBezPrice } from '../../_shared/bez-price.js';

/**
 * Moneda del pedido. La transferencia SEPA va en EUR (la cuenta de cobro es en EUR), pero solo si la API admite pedidos en
 * EUR, y eso se sabe porque responde el cambio del BCE (/payments/fx). Una API anterior no tiene esa ruta y rechaza
 * `amountEUR`: en ese caso el pedido SEPA va en USD, como antes, en vez de fallar al pagar.
 */
export function monedaPedido(metodo, tieneCambio) {
  return metodo === 'bank' && tieneCambio ? 'EUR' : 'USD';
}
