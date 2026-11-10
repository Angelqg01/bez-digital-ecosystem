# AGENTS.md — BeZhas

El contexto del proyecto se mantiene en un único fichero: **[CLAUDE.md](CLAUDE.md)**.
Léelo entero antes de trabajar; vale para cualquier agente (Claude Code, Codex,
opencode, Cowork), no sólo para Claude.

Este fichero era una copia de CLAUDE.md que se quedó atrás y llegó a afirmar
cosas falsas (por ejemplo, un contrato BEZ en BNB Chain que no existe). Por eso
ya no duplica nada: si algo cambia, se cambia en CLAUDE.md.

Reglas que no admiten excepción, por si sólo lees esto:

- Gestor de paquetes: **pnpm 11**. Nunca `npm` ni `yarn`.
- Contratos: **Foundry** (`forge build`, `forge test`). No hay Hardhat.
- BEZ-Coin sólo existe en **Polygon** (`0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8`).
- Nunca cambiar direcciones de contratos sin confirmación explícita.
- Nunca escribir claves, semillas ni tokens en código, commits o logs.
