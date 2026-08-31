# Pagos y gas

`BeZhasPayment` es el procesador de pagos B2B del protocolo: liquida en BEZ, retiene comisión, registra cada pedido y protege contra reprocesos.

## Modelo

```
payer ──approve──► BeZhasPayment
       ──processPayment(recipient, amount, orderId, memo)──►
              ├── fee    → contrato (acumulado en accruedFees)
              └── neto   → recipient
```

El `amount` es el **importe bruto** que sale del pagador. El destinatario recibe el neto tras la comisión. Comunica siempre el neto a tu contraparte, no el bruto.

## Estructura de un pago

```solidity
struct PaymentRecord {
    address payer;
    address recipient;
    uint256 amount;      // neto, sin comisión
    uint256 fee;         // comisión retenida
    uint256 timestamp;
    bytes32 orderId;
    string  memo;        // referencia, hasta 200 caracteres
    Status  status;      // PENDING | COMPLETED | REFUNDED | FAILED
}
```

## Procesar un pago

```js
import { ethers } from 'ethers';
import { getContract, getABI } from '@bezhas/sdk';

const pago = new ethers.Contract(
  getContract('BeZhasPayment', 'bezhas-l2').address,
  getABI('BeZhasPayment'),
  signer
);

const bruto   = ethers.parseUnits('1000', 18);
const orderId = ethers.id('FACTURA-2026-00417');   // bytes32 determinista

// 1) Consulta el desglose ANTES de firmar
const { fee, netAmount } = await pago.calculateFee(bruto);

// 2) Autoriza el importe bruto
await bez.approve(pago.target, bruto);

// 3) Ejecuta
const tx = await pago.processPayment(
  destinatario,
  bruto,
  orderId,
  'Factura 2026-00417 · Contenedor MSKU7654321'
);
await tx.wait();
```

### `orderId`: tu clave de conciliación

Derívalo de forma determinista desde tu identificador de negocio (`ethers.id('FACTURA-...')`). El contrato marca cada `orderId` como procesado y revierte con `OrderAlreadyProcessed` si se repite. Esto te da **idempotencia gratis**: si tu backend reintenta por un timeout de red, no cobrarás dos veces.

```js
await pago.isOrderProcessed(orderId);   // comprueba antes de reintentar
await pago.getPayment(orderId);         // recupera el registro completo
```

## Pagos por lotes

`batchPayment(recipients[], amounts[], orderIds[], memos[])` liquida varios pagos en una transacción. **Máximo 50 por lote** para evitar quedarse sin gas. Útil para nóminas de transportistas, liquidaciones a proveedores o reparto de royalties.

## Reembolsos

```js
await pago.refundPayment(orderId);   // → PaymentRefunded
```

Restringido a roles autorizados y sujeto al estado del pago. El estado pasa a `REFUNDED`.

## Comisiones

| Elemento | Detalle |
| --- | --- |
| `platformFeeBps` | Comisión en basis points (10 bps = 0,1%) |
| `calculateFee(amount)` | Devuelve `(fee, netAmount)` — úsalo siempre |
| `accruedFees` | Comisiones pendientes de retirar |
| `withdrawFees()` | Solo `TREASURY_ROLE` |

Los contratos sectoriales que heredan de `BEZSectorStandard` tienen un **tope duro del 10%** (1000 bps) aplicado en el propio contrato.

## Pausa de emergencia

El contrato es `Pausable`. Ante un incidente, `OPERATOR_ROLE` puede pausarlo y las nuevas operaciones revierten. Tu integración debe manejar ese caso con un mensaje claro al usuario, no con un error genérico.

## Gas y transacciones sin coste para el usuario

La L2 usa **BEZ como gas token**, no ETH. Hay tres formas de que el usuario final no tenga que gestionar saldo de gas:

### 1. `permit` (EIP-2612)

El usuario firma la autorización off-chain; tu backend ejecuta y paga el gas. Sin transacción de `approve` y sin gas para el usuario.

### 2. Paymaster

`Paymaster` patrocina el gas de operaciones que cumplan tus reglas. Combinado con `SmartWallet` (account abstraction), el usuario opera sin saber que existe el gas.

### 3. Smart Wallet

`SmartWalletFactory` crea cuentas inteligentes con guardianes (`WalletGuardian`), límites de gasto (`SecurityModule`) y recuperación social — el modelo adecuado para empleados que operan en nombre de una empresa sin custodiar claves críticas.

## Buenas prácticas

1. **Llama a `calculateFee` antes de firmar** y muestra el desglose. Nadie debería descubrir la comisión en el recibo.
2. **`orderId` determinista** desde tu ERP: es tu protección anti-duplicado.
3. **Escucha `PaymentProcessed`** para cerrar el ciclo en tu sistema; no des por bueno un envío sin confirmación de evento.
4. **Verifica `approve` suficiente** antes de ejecutar, o la transacción fallará gastando gas.
5. **Memo sin datos sensibles.** Es público y permanente: pon referencias, no nombres de clientes ni condiciones comerciales.

## Ver también

- [BEZ-Coin](/docs/bez-coin)
- [Tokenización de activos](/docs/tokenizacion-activos)
- [Smart contracts y ABIs](/docs/smart-contracts)
