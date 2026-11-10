# Arquitectura de Puentes Multi-Cadena (Multi-Chain Bridges) para BeZhas L2

Para soportar de forma nativa los pagos en múltiples redes listadas en el frontend corporativo (`bezhas-pay-system.jsx`), la red principal (Mainnet) de BeZhas L2 no se puede limitar únicamente a Ethereum. 

Las empresas usan USDT, USDC, MATIC, BNB y SOL principalmente por las bajas comisiones que tienen estas redes. El diseño arquitectónico exige un esquema "Hub & Spoke" donde BeZhas L2 actúa como el "Hub" central.

## 1. El Puente Principal (L1 a L2)
- **Ubicación:** Ethereum L1
- **Contrato:** `L1_Ethereum_Bridge.sol` (Ya implementado)
- **Función:** Es la bóveda de máxima seguridad. Aquí recae la liquidación final (Settlement) del OP Stack. Sin embargo, debido al alto costo del gas en Ethereum L1, su uso se reservará principalmente para aportaciones corporativas de gran tamaño (Ej. Proveedores de Liquidez Grandes o Tesorerías Empresariales).

---

## 2. Puentes sobre Cadenas Compatibles con EVM (Polygon y BNB Chain)
El esquema sobre redes EVM es idéntico al de Ethereum L1 pero requiere de un intermediario tecnológico para la mensajería Cross-Chain, ya que el Secuenciador del OP Stack de BeZhas solo "escucha" los eventos nativos de la blockchain en la que está anclado (Ethereum en este caso).

### Herramienta Propuesta: LayerZero V2 o Wormhole
- **¿Qué es?:** Son protocolos de interoperabilidad omnichain (Omnichain Interoperability Protocols).
- **Proceso (Flujo B2B):**
  1. La empresa envía `10,000 USDT` desde la red Polygon a un contrato puente local (`BeZhasOFT_Polygon`).
  2. El contrato bloquea (Locks) los `10,000 USDT` en Polygon.
  3. LayerZero/Wormhole verifica criptográficamente que el dinero fue bloqueado.
  4. LayerZero envía un mensaje corto a la BeZhas L2 ordenándole al contrato central (Ej. `BEZCoinV2.sol`) que emita (Mint) la representación exacta (`10,000 USDT-B`) en la cuenta de la empresa en BeZhas.
- **Ventajas:** Extremadamente rápido (~1 minuto) y paga centavos en gas. 

---

## 3. El Reto: Puentes no-EVM (Solana)
Solana no utiliza la Ethereum Virtual Machine ni el lenguaje Solidity (usa Rust). Transferir SOL o USDC desde Solana a una red tipo Optimism requiere un diseño especializado.

### Solución Arquitectónica
Se requiere crear un programa nativo en Solana (SPL Program) que funcione como "Caja Fuerte".
- **Paso 1:** La empresa envía `USDC (SPL Token)` a la "Caja Fuerte de BeZhas" en Solana.
- **Paso 2:** El programa emite un evento en la red de Solana.
- **Paso 3:** Una red de oráculos validadores descentralizados (Ej. Wormhole Guardians) escucha el evento en Solana, lo validan (requiere consenso 13/19), y emiten un certificado VAA (Verifiable Action Approval).
- **Paso 4:** Un "Relayer" toma ese certificado VAA y lo presenta al contrato receptor en la L2 de BeZhas.
- **Paso 5:** El contrato en la L2 lee el certificado, verifica que sea matemáticamente válido usando la llave pública de los oráculos, y efectúa el `mint` del token a la empresa.

---

## 4. Orquestador de Retiros (Withdrawals)
Por seguridad del capital corporativo B2B, es crítico establecer límites para evitar el vaciado de las distintas bóvedas (Cajas Fuertes) en caso de un hackeo o puente comprometido.
- **Estrategia:** En los contratos puentes, los retiros mayores a X cantidad (Ej. > $50,000 Dólares) deben tener un de-lay (Time-Lock) automático de 24 horas y requerir multi-firma por parte del Comité DAO de BeZhas. Retiros menores operan libremente pero consumen un caudal (Rate Limit) diario, ej. Solo se pueden sacar $500,000 de Solana al día y se recarga cada 24 horas.

[[servicios]]
[[finanzas]]
[[gobierno]]
[[supply-chain]]
[[legal]]
[[entretenimiento]]
[[educacion]]
[[seguros]]
[[agricultura]]
[[manufactura]]
[[automotriz]]
[[bienes-raices]]
[[energia]]
[[salud]]
[[logistica]]
[[otros]]
[[mcp]]
[[sdk-integraciones]]
[[api-reference]]
[[getting-started]]
[[smart-contracts-abi]]
[[comunidad]]
[[faq]]
[[index]]


