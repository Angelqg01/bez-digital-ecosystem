# BeZhas Platform — Estándar de Lenguajes y Tecnologías

**Fecha de vigencia:** 2026-04-04  
**Aplica a:** Todo el ecosistema BeZhas — Blockchain Core, Web3, DeFi, Mobile, y cualquier nueva aplicación.  
**Autoridad:** Arquitectura de Plataforma BeZhas

---

## DIRECTIVA: Toda nueva aplicación DEBE usar el mismo stack que el Core

Cualquier aplicación, módulo, microservicio o sub-proyecto nuevo dentro del ecosistema BeZhas **DEBE** seguir las tecnologías definidas en este documento. No se aceptan excepciones sin aprobación explícita de arquitectura.

---

## Stack Oficial BeZhas (Referencia: BeZhas Blockchain Core)

### Smart Contracts
| Atributo | Estándar |
|---|---|
| **Lenguaje** | Solidity |
| **Versión mínima** | ^0.8.24 |
| **Framework** | Foundry (forge, cast, anvil) |
| **Toolchain alternativo** | ❌ Hardhat NO permitido en nuevos proyectos |
| **Dependencias** | OpenZeppelin v5 vía `forge install` (git submodule en `lib/`) |
| **Tests** | Solidity (forge-std `Test`), NO JavaScript/Mocha |
| **Deploy scripts** | Solidity Scripts (`script/*.s.sol`) + parse JS |
| **Compilador config** | `via_ir = true`, `optimizer_runs = 200` |

### Backend / API / Microservicios (Node.js)
| Atributo | Estándar |
|---|---|
| **Lenguaje** | JavaScript (ES Modules o CommonJS según contexto) |
| **Runtime** | Node.js ≥ 18 |
| **Framework** | Express.js 4.x |
| **Base de datos** | PostgreSQL (driver: `pg`) |
| **Caché / Pub-Sub** | Redis (driver: `redis` o `ioredis`) |
| **ORM** | ❌ NO usar ORMs (Mongoose, Prisma, Sequelize). Queries directas con `pg` |
| **Validación** | Express-validator / Zod |
| **Auth** | JWT + SIWE (Sign-In With Ethereum) + bcrypt |
| **Web3** | ethers.js v6.x |
| **Tests** | Jest |
| **Metrics** | prom-client (Prometheus) |
| **Logging** | pino / winston |

### Frontend (Aplicaciones Web)
| Atributo | Estándar |
|---|---|
| **Lenguaje** | TypeScript (.tsx / .ts) |
| **Framework** | Next.js (última versión estable, actualmente 16.x) |
| **Router** | App Router (`app/` directory) |
| **React** | React 18.x |
| **Estilos** | Tailwind CSS 3.x |
| **CSS Config** | `postcss.config.js` (NO `.mjs`), `tailwind.config.cjs` |
| **Next.js Config** | `next.config.mjs` (NO `.ts`) |
| **State Management** | SWR / React hooks (Zustand aceptable para apps complejas) |
| **Web3** | ethers.js v6 o wagmi/viem (ambos tipados en TypeScript) |
| **Tests unitarios** | Vitest o Jest con Testing Library |
| **Tests E2E** | Playwright (proyecto separado, npm NO pnpm) |
| **Iconos** | lucide-react |
| **Charts** | Recharts |

### AI / ML Service
| Atributo | Estándar |
|---|---|
| **Lenguaje** | Python |
| **Framework** | FastAPI + Uvicorn |
| **DB async** | asyncpg (PostgreSQL) |
| **ML** | scikit-learn, NumPy, Pandas según necesidad |
| **Metrics** | prometheus-fastapi-instrumentator |
| **Config** | Pydantic BaseModel |

### Mobile
| Atributo | Estándar |
|---|---|
| **Framework** | React Native |
| **Lenguaje** | TypeScript (migración desde JS requerida) |
| **Web3** | ethers.js v6.x (NO v5) |
| **Navigation** | @react-navigation |

### SDK
| Atributo | Estándar |
|---|---|
| **Nombre** | @bezhas/sdk (centralizado) |
| **Lenguaje** | JavaScript (ES Modules) |
| **Registro de contratos** | Multi-chain via `contracts.js` + `deployments/{chainId}.json` |
| **Web3** | ethers.js v6.x |

### DevOps / Infraestructura
| Atributo | Estándar |
|---|---|
| **Package Manager** | npm (NO pnpm, NO yarn) |
| **Containers** | Docker multi-stage con usuario non-root (`bezhas`) |
| **Compose** | `docker-compose.yml` (base) + `.dev.yml` / `.prod.yml` (overrides) |
| **CI/CD** | GitHub Actions |
| **Monitoring** | Prometheus + Grafana + Loki + Promtail |
| **Reverse proxy** | Nginx con TLS 1.2/1.3, HSTS, WAF rules |
| **Scripts** | PowerShell (.ps1) para Windows, Bash (.sh) para Linux/CI |

---

## Reglas de Gobierno

### 1. Nuevas Aplicaciones
- **OBLIGATORIO**: Seguir este estándar sin excepción.
- Antes de iniciar un nuevo módulo, verificar que la estructura base cumpla con esta directiva.
- Copiar plantilla de proyecto desde Core como punto de partida cuando sea posible.

### 2. Aplicaciones Existentes
- Las aplicaciones existentes que no cumplan **DEBEN** migrar según los planes de migración aprobados.
- Prioridad de migración: Smart Contracts → Backend DB → Frontend → Mobile.

### 3. Excepciones
- Solo se permiten excepciones para:
  - Servicios de terceros que imponen su stack (ej: plugin de un proveedor).
  - Prototipado temporal (máximo 30 días antes de migrar al estándar).
- Toda excepción debe documentarse en el README del proyecto con justificación técnica.

### 4. Revisión de Código
- PRs que introduzcan tecnologías fuera del estándar serán **rechazados automáticamente**.
- Checklist de revisión:
  - [ ] ¿Usa TypeScript en frontend?
  - [ ] ¿Usa PostgreSQL/pg en backend?
  - [ ] ¿Usa Foundry para contratos?
  - [ ] ¿Usa npm como package manager?
  - [ ] ¿Tests incluidos (Jest/Forge/Playwright)?

### 5. Actualización de este Documento
- Este documento se revisa cada vez que el Core actualiza su stack.
- Mantener sincronizado con `AI_CONTEXT.md` y `PROJECT_STRUCTURE.md` del Core.

---

## Referencia Rápida — "¿Qué usar para...?"

| Necesito... | Usar |
|---|---|
| Crear un smart contract | Solidity + Foundry |
| Crear una API REST | Node.js + Express + pg (PostgreSQL) |
| Crear un frontend web | Next.js + TypeScript + Tailwind |
| Crear un modelo de ML | Python + FastAPI |
| Crear una app móvil | React Native + TypeScript + ethers v6 |
| Interactuar con blockchain | ethers.js v6 (o wagmi/viem en frontend dApp) |
| Cachear datos | Redis |
| Ejecutar cron jobs | node-cron (Node.js) |
| Manejar colas de trabajo | BullMQ + Redis |
| Deployment | Docker + GitHub Actions |
| Tests de contrato | forge test (Solidity) |
| Tests de API | Jest + supertest |
| Tests E2E web | Playwright |
| Monitoreo | Prometheus + Grafana |

---

*Este documento es vinculante para todos los desarrolladores, agentes IA y sistemas automatizados que generen código para el ecosistema BeZhas.*
