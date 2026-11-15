# ⚠️ DIRECTIVA DE TECNOLOGÍA — LEER ANTES DE DESARROLLAR

Este proyecto está en proceso de migración para alinear su stack tecnológico con el **BeZhas Blockchain Core**.

## Documento de referencia
- **Estándar oficial**: `BeZhas Blockchain/STANDARD_TECH_STACK.md`
- **Plan de migración**: `BeZhas Blockchain/plans/PLAN_MIGRACION_BEZHAS_WEB3.md`

## Cambios principales requeridos

| Área | Actual | Destino |
|---|---|---|
| Smart Contracts | Hardhat | **Foundry** |
| Frontend | Vite + React 18 (JSX) | Se mantiene Vite en el Hub (`frontend/`); el código nuevo, en TSX. La web principal es `control-center/frontend` (Next.js) |
| Base de datos | MongoDB (Mongoose) + Prisma | **PostgreSQL (pg)**. Migración por dominios, no en bloque: ver `docs/developer/HUB_BACKEND_MIGRACION.md` |
| SDK | Local | **@bezhas/sdk v3 (centralizado)** |
| Package Manager | pnpm | **pnpm** (se mantiene: el estándar del proyecto es pnpm 11; npm y yarn están prohibidos) |
| Mobile ethers | v5 | **v6** |

## Regla para nuevo código
**NO crear nuevos archivos `.jsx`** — todo nuevo componente debe ser `.tsx` (TypeScript).  
**NO añadir nuevas colecciones MongoDB** — las nuevas entidades van en PostgreSQL.  
**NO añadir Hardhat plugins** — preparar para Foundry.

Consultar `STANDARD_TECH_STACK.md` del Core para la referencia completa.
