# Costes, Comisiones y Ganancias en la Blockchain BeZhas

## 1. Comisiones por Transacciones y Validación

- **Token de Gas:** BEZCoinV2 (ERC-20, con soporte para meta-transacciones y Account Abstraction).
- **Coste de Gas:** El coste de gas en la L2 BeZhas se paga en BEZCoin. El secuenciador controla el coste base del gas, permitiendo tarifas muy bajas (fracciones de centavo), ajustables en tiempo real.
- **Configuración Génesis:**
  - `gasPriceOracleOverhead`: 2100
  - `gasPriceOracleScalar`: 1,000,000
  - El gas consumido por las empresas al registrar manifiestos, fraccionar RWA o usar IA se paga (y puede quemarse) en BEZCoin.
- **Validación y Minería B2B (DePIN):**
  - Los nodos empresariales reciben recompensas automáticas por procesar datos IoT, validar manifiestos y usar IA.
  - Recompensa por validación: **1 BEZ por "punto de validación"** (configurable en el contrato `EdgeNodeRewards`).

## 2. Venta de Productos y Pasarela de Pago

- **Pasarela Propia vs Stripe:**
  - **Pasarela BeZhas:** Permite pagos directos en BEZCoin, con integración de onramp fiat (Stripe/MoonPay) para convertir USD/EUR a BEZ.
  - **Stripe:** El SDK calcula la compra de BEZ a razón de 1 BEZ = $0.10 USD (ejemplo). Stripe cobra su comisión estándar (2.9% + $0.30 por transacción).
  - **Comparativa de Ganancias:**
    - Usando la pasarela propia, la plataforma retiene el 100% del gas y puede cobrar una comisión adicional por venta (configurable en el smart contract o backend).
    - Usando Stripe, la plataforma paga la comisión de Stripe y recibe el neto en BEZCoin.

## 3. Costes y Ganancias para la Plataforma

- **Ingresos por Gas:** Todo el gas pagado en BEZCoin va a la tesorería de la L2, permitiendo financiar infraestructura y recompensas.
- **Ingresos por IA y Oráculos:** Llamadas a contratos precompilados de IA pueden tener un coste fijo (ej: 5 BEZ por consulta), que va a la tesorería y cubre el coste de APIs externas.
- **Ajuste Dinámico:** El secuenciador puede ajustar el coste del gas y las comisiones en tiempo real según la demanda y el coste de operar sobre Ethereum L1.

## 4. Costes y Ganancias para Operadores de Nodos

- **Recompensas:**
  - Los operadores de nodos (empresas) reciben BEZ por validaciones, procesamiento de datos y uptime.
  - Las recompensas se calculan por "puntos de validación" y pueden ser reclamadas en cualquier momento.
- **Costes:**
  - Los nodos deben mantener un saldo mínimo de gas (ej: 1 BEZ) para operar. El sistema recarga automáticamente los tanques de gas de las empresas si bajan del umbral.


## 5. Resumen de Parámetros Clave

- **Gas mínimo en tanques empresariales:** 1 BEZ (auto-recarga a 50 BEZ si baja del umbral).
- **Recompensa por validación de documentos:** 1 BEZ por punto (ajustable).
- **Generación y uso de QR:** Para validación de documentos, seguimiento, compra de tokens, acceso a smart contracts y autenticación.
- **Comunicación multicanal:** Integración con WhatsApp, Telegram y Discord vía API BeZhas.
- **Comisión Stripe:** 2.9% + $0.30 USD por transacción.
- **Comisión pasarela propia:** 0% (solo gas, configurable si se desea añadir fee).
- **Coste de consulta IA:** Ejemplo: 5 BEZ por llamada (configurable).

## 6. Referencias Técnicas

- Contratos: `BEZCoinV2.sol`, `EdgeNodeRewards.sol`
- Configuración: `Configuración Génesis y Token Nativo (Gas).txt`
- SDK: `sdk/payments.js`
- Documentación: `1er paso.txt`, `Arquitectura de la Aplicación (El Stack Técnico).md`

---
*Este documento resume los costes, comisiones y ganancias principales de la blockchain BeZhas. Para detalles exactos, consultar los contratos y archivos de configuración.*
