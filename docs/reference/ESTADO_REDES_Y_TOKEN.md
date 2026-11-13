---
estado: vigente
dominio: contratos
revisado: 2026-11-10
---

# Estado real de las redes y del token BEZ-Coin

**Revisado:** 2026-11-10 · **Estado:** vigente · **Prevalece sobre** cualquier otro
documento de `docs/` que diga otra cosa.

Varios documentos antiguos describen BeZhas como una blockchain de capa 2 (L2)
sobre OP Stack con un token BEZCoinV2 y un wBEZ en Polygon. Ese fue el diseño de
junio de 2026. **No es lo que está en uso.** Si un documento contradice esta
página, vale esta página.

## Dónde está BEZ-Coin

| Red | chainId | Situación |
| :---- | :---- | :---- |
| **Polygon** | 137 | **En uso.** BEZ-Coin es un ERC-20 en `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8`. Es el único BEZ que existe para clientes |
| BNB Chain | 56 | **Sin desplegar.** No hay contrato BEZ ni BEP-20. La dirección `0x8a1e…5b55` que aparece en textos antiguos no tiene código (comprobado on-chain el 2026-09-18). Será un bridge, pendiente |
| BeZhas L2 | 2708 | **Sin uso en producción.** Hay código (`smart-contracts/src/`, `BEZCoinV2.sol`), configuración y un `deployments/2708.json`, pero ningún cliente opera ahí |
| Polygon Amoy | 80002 | Testnet |
| Anvil | 31337 | Desarrollo local |

## Qué se puede afirmar y qué no

- Sí: «BEZ-Coin es un token ERC-20 en Polygon».
- Sí: «BeZhas tiene desarrollada una L2 propia que todavía no está en producción».
- No: «BEZ-Coin está en BNB Chain» o «es BEP-20».
- No: «la red principal de BeZhas es la L2 2708» ni «BEZCoinV2 es el token de BeZhas».
- No: hablar de `wBEZ` como un activo existente.

## Qué hace la API

En producción la api opera en Polygon: el despliegue fija `BEZHAS_CHAIN_ID=137`
(`deploy/gcp/cloudbuild.yaml`) y, si la variable faltara, el valor por defecto es
también 137 (`api/config/chain-policy.js`). La 2708 y la 56 siguen en la lista de
cadenas permitidas sólo para peticiones que las indiquen de forma explícita.

## Fuentes

- Direcciones: `smart-contracts/deployments/<chainId>.json` y la tabla de contratos de `CLAUDE.md`.
- Política de cadenas: `api/config/chain-policy.js`.
- Material histórico sobre la L2 con OP Stack: `docs/archivo/l2-op-stack-2026-06/`.
