# Introducción a BeZhas

BeZhas es un ecosistema blockchain empresarial B2B construido sobre una **L2 propia basada en OP Stack**, con un token nativo (**BEZ**) que funciona como gas, colateral de validación y unidad de gobernanza.

A diferencia de una blockchain generalista, BeZhas está diseñada alrededor de un objetivo concreto: que empresas de sectores reales — logística, aduanas, salud, energía, industria — puedan **tokenizar activos, automatizar procesos y liquidar pagos** sin construir infraestructura propia.

## Arquitectura en capas

| Capa | Qué hace | Componentes |
| --- | --- | --- |
| **L1 de anclaje** | Seguridad y disponibilidad de datos | Ethereum (Sepolia en testnet) |
| **BeZhas L2** | Ejecución EVM, gas en BEZ | OP Stack, `L2Sequencer`, `SequencerRotation` |
| **Capa de validación** | Consenso corporativo y DePIN | `ValidatorRegistry`, `EdgeNodeRewards`, `SlashingManager` |
| **Capa de contratos** | Lógica sectorial y financiera | ~88 contratos en 16 sectores |
| **Capa de acceso** | Integración con software existente | API Core, SDK `@bezhas/sdk`, RPC, MCP |

La L2 usa **BEZ como gas token personalizado** (`useCustomGasToken`), no ETH. Es decir: el mismo token que una empresa stakea para validar es el que paga sus transacciones.

## Redes

| Red | Chain ID | Uso |
| --- | --- | --- |
| BeZhas L2 | `2708` | Red principal del protocolo |
| Local / Anvil | `31337` | Desarrollo con Foundry |
| Polygon | `137` | BEZ como ERC-20 + puente |
| BNB Chain | `56` | BEZ como BEP-20 + puente |

El tiempo de bloque de la L2 es de **2 segundos**.

## Los tres modos de usar BeZhas

1. **Como integrador** — consumes la API Core y el SDK desde tu ERP, tu e-commerce o tu backend. No necesitas tocar Solidity. Empieza por [Primeros pasos](/docs/primeros-pasos).
2. **Como desarrollador on-chain** — despliegas tus propios contratos sectoriales heredando de `BEZSectorStandard`. Ver [Tokenización de activos](/docs/tokenizacion-activos).
3. **Como operador de infraestructura** — levantas un Enterprise Node o un Edge Node, stakeas BEZ y validas. Ver [Nodos](/docs/nodos-enterprise-edge) y [Validadores](/docs/validadores-staking).

## Qué NO encontrarás en esta documentación

Por política de seguridad, este portal público **no publica**: claves privadas ni de despliegue, endpoints internos de administración, arquitectura de secretos, runbooks de infraestructura ni credenciales de ningún tipo. Todo lo documentado aquí es información que un integrador externo necesita y que es observable on-chain o mediante interfaces públicas.

Si necesitas acceso a documentación privada bajo NDA (auditorías, arquitectura interna, due diligence), solicítalo por los canales de la sección [Comunidad y soporte](/docs/comunidad).
