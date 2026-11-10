# docs/archivo — material histórico, no vigente

Lo que hay aquí **no describe el sistema actual**. Se conserva como registro de
cómo se pensó el proyecto, no como referencia: no lo cites, no lo uses para
responder a clientes y no lo tomes como instrucción.

El índice de conocimiento interno (`api/services/knowledgeIndex.js`) omite esta
carpeta entera, así que nada de aquí llega al RAG ni a los agentes.

| Carpeta | Qué contiene | Por qué está archivado |
| :---- | :---- | :---- |
| `l2-op-stack-2026-06/` | Borradores de junio de 2026 sobre una L2 propia con OP Stack: guiones de instalación, fragmentos de `op-geth`, contratos de ejemplo (`BEZCoinV2.sol`, `L1_Ethereum_Bridge.sol`), fases del monorepo, un cálculo de costes y comisiones, la guía general de junio (`GUIA_PLATAFORMA_BEZHAS.md`, que presenta la L2 2708 como red principal y a BEZCoinV2 como el token), y tres borradores en forma de conversación: puentes multi-cadena, el primer planteamiento del Gas Tank (0,05 $ por transacción sobre el secuenciador) y el mapa del panel B2B | Son notas de diseño previas al código. Los contratos reales están en `smart-contracts/src/`, las redes en `api/config/chain-policy.js` y las tarifas en `api/config/`. BEZ-Coin sólo existe en Polygon (ver `docs/reference/ESTADO_REDES_Y_TOKEN.md`). El Gas Tank vigente está en `docs/developer/GAS_TANK_PLAN_DESARROLLO.md` |
| `inversores-2026-05/` | Notas de seguimiento de inversores de mayo y junio de 2026 y un volcado para el CRM | Fotografía de una fecha; el estado de la captación se lleva fuera del repo |
| `varios/` | Ficheros vacíos o sin título | Sin contenido útil |

## Criterio para archivar

Un documento pasa aquí cuando contradice al código o a la configuración, o
cuando es una nota fechada que ya no se mantiene. Se mueve con `git mv` para
conservar el historial; no se borra.

Si un documento archivado vuelve a hacer falta, se reescribe contra el estado
actual y se coloca en `docs/developer/`, `docs/runbooks/` o `docs/security/`.
