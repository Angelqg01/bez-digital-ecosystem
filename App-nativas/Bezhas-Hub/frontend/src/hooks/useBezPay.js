/**
 * useBezPay.js
 * 
 * Hook simplificado para acceder al sistema de pago BEZ desde cualquier componente.
 * Diseñado para ser compatible con el SDK, MCP y IA de BeZhas.
 * 
 * @example
 * // En cualquier componente o archivo del SDK:
 * import { useBezPay } from '../hooks/useBezPay';
 * 
 * function MyComponent() {
 *   const { openBuyBez, openSubscription } = useBezPay();
 *   return <button onClick={() => openBuyBez(100)}>Comprar BEZ</button>;
 * }
 * 
 * @example
 * // Desde el SDK / MCP tool:
 * const bezPay = window.__BEZHAS_PAY__;
 * bezPay.openBuyBez(amount, { onSuccess: (tx) => console.log(tx) });
 */

// Re-export del hook desde el contexto para compatibilidad de imports
export { useBezPay } from '../context/BezPayContext';
export { 
  BEZ_PAY_TYPES,
  SUBSCRIPTION_PLANS,
  FARMING_POOLS,
  BezPayProvider,
} from '../context/BezPayContext';
