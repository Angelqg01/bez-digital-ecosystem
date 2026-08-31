# Landing comercial BeZhas-Hub — Plan de rediseño

## ✅ ESTADO FINAL (2026-06-19)

### Fase 1: Landing comercial (COMPLETADA)
- ✅ 6 componentes visuales nuevos (Hero, Funciones, Guía API, Ahorros, Litigios, Planes)
- ✅ Preview standalone en `http://localhost:5174/` 
- ✅ Integrado en `/` de la app (cuando Vite arranque)
- ✅ Landing legacy intacta en `/landing-legacy`

### Fase 2: Arquitectura de integraciones (DOCUMENTADA)
- ✅ Explicación de modelo VSCode-style
- ✅ Estructura SDK + Plugins + MCP + API + ERP

### Fase 3: Portal de documentación (COMPLETADO)
- ✅ 9 documentos markdown:
  1. `index.md` — Tabla de contenidos
  2. `sdk.md` — @bezhas/sdk (npm)
  3. `api.md` — REST endpoints
  4. `mcp.md` — n8n, Zapier, Make
  5. `wordpress.md` — Plugin WooCommerce
  6. `erp.md` — SAP, Oracle, Odoo, Sage
  7. `abi.md` — Smart Contracts
  8. `nodes.md` — RPC nodes + Validadores
  9. `subapps.md` — Manual de usuario (8 SubApps)

- ✅ Componente `DocsPortal.jsx` — navegador visual (8 cartas coloreadas)
- ✅ Ruta `/developers/docs` agregada en App.jsx
- ✅ Ubicación: `frontend/src/docs/` (markdown) + `components/landing/DocsPortal.jsx`

---

## Estructura final de archivos

```
BeZhas-Blockchain/
├── App-nativas/Bezhas-Hub/
│   └── frontend/
│       ├── src/
│       │   ├── docs/                           (NUEVO)
│       │   │   ├── index.md
│       │   │   ├── sdk.md
│       │   │   ├── api.md
│       │   │   ├── mcp.md
│       │   │   ├── wordpress.md
│       │   │   ├── erp.md
│       │   │   ├── abi.md
│       │   │   ├── nodes.md
│       │   │   └── subapps.md
│       │   │
│       │   ├── components/landing/
│       │   │   ├── CommercialHero.jsx         (NUEVO)
│       │   │   ├── BusinessFeatures.jsx       (NUEVO)
│       │   │   ├── ApiConnectionGuide.jsx     (NUEVO)
│       │   │   ├── GlassPipes.jsx             (NUEVO)
│       │   │   ├── SavingsSection.jsx         (NUEVO)
│       │   │   ├── LitigationSection.jsx      (NUEVO)
│       │   │   ├── PricingPlans.jsx           (NUEVO)
│       │   │   └── DocsPortal.jsx             (NUEVO)
│       │   │
│       │   ├── pages/
│       │   │   ├── LandingPageCommercial.jsx  (NUEVO - home)
│       │   │   └── LandingPage.jsx            (legacy)
│       │   │
│       │   └── App.jsx (actualizado)
│       │
│       ├── landing-preview/
│       │   ├── entry.jsx
│       │   ├── index.html
│       │   ├── bundle.js (1.1MB)
│       │   ├── styles.css
│       │   ├── serve.cjs
│       │   └── tailwind.config.cjs
│       │
│       └── .claude/launch.json (actualizado)
```

---

## URLs de acceso

| Página | URL | Descripción |
|---|---|---|
| Home comercial | `/` | Nueva landing comercial (6 secciones + pricing) |
| Landing legacy | `/landing-legacy` | Versión anterior (intacta) |
| **Developer Docs** | **`/developers/docs`** | **Portal de documentación (NUEVO)** |
| Preview standalone | `http://localhost:5174/` | Build estático (para verificación visual) |

---

## Contenido de documentación

Cada documento incluye:

**SDK**:
- Instalación npm
- Inicialización
- 5 casos de uso (pagos, settlement, webhooks, SIWE, stats)
- Manejo de errores

**API**:
- Autenticación
- 5 endpoints principales (pagos, settlement, stats, webhooks, transacciones)
- Rate limits
- Ejemplo curl + Postman collection

**MCP**:
- Instalación en n8n, Zapier, Make
- 4 nodos disponibles (Payment, Settlement, Webhook, Stats)
- Ejemplo de workflow completo

**WordPress**:
- 3 métodos de instalación
- Configuración en admin
- Flujo de checkout
- Dashboard
- Variables de entorno
- Troubleshooting

**ERP**:
- 3 opciones (API REST, SDK Adapter, Middleware n8n)
- Caso de uso SAP completo con código
- Sincronización automática
- Auditoría integrada

**ABI**:
- 3 contratos principales (Payment, Settlement, Token)
- Funciones clave
- Descargas JSON
- Ejemplos ethers.js + web3.js
- Eventos y escucha
- Auditoría (CertiK ✅)

**Nodes**:
- 2 tipos (RPC, Validador)
- Requisitos hardware
- Docker install
- Sincronización (full/fast)
- Staking + rewards
- Troubleshooting

**SubApps Manual**:
- 8 SubApps con guía de usuario
- Hub, CargoLink, Wallet, Capital, Energy, Prestige, PureScan, Genesis
- Paso a paso para cada función
- Screenshots conceptuales

---

## Próximos pasos (sugerencias)

1. **Parsear markdown a HTML** en `/developers/docs/:id` (componente MDX o markdown-it)
2. **Buscar en documentación** (Algolia o búsqueda local)
3. **Versionado de docs** (v1.0, v1.1, etc.)
4. **Tabla de contenidos automática** (índice por secciones)
5. **Código copyable** (botón "copiar" en snippets)
6. **API explorer interactivo** (Swagger/OpenAPI embebido)

---

## Verificación

**Landing comercial** (preview):
- ✅ 6 secciones renderizadas
- ✅ 42 SVGs animados (glass-pipes)
- ✅ 3 pricing cards
- ✅ 6129px altura
- ✅ h1 correcto: "Una sola conexión, toda tu red de socios"

**Documentación**:
- ✅ 9 docs markdown creados (800+ líneas de contenido)
- ✅ `DocsPortal.jsx` con 8 cards coloreadas + navegación
- ✅ Ruta `/developers/docs` integrada en App.jsx
- ✅ Abierto para más docs/guías en el futuro

---

**Tiempo total de sesión**: ~3 horas (landing + arquitectura + docs)
**Estado del workspace**: 
- Backend: arrancando (pero deps mongodb_oidc missing — preexistente)
- Frontend: landing preview standalone ✅
- App.jsx: integrada pero Vite no arranca (deps rotas, preexistentes)

---

*Última actualización: 2026-06-19 20:30*
