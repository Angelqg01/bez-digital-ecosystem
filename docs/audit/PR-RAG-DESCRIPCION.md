# RAG y chat de BeZhas AI: endurecimiento, medición, subida de NFT, canales, operación, energía y chat unificado en BEZ Energy

**Rama:** `feat/rag-endurecimiento` → base `feat/seguridad-transaccional-mcp` (la que sirve producción según la topología). **12 commits, 94 ficheros.** Contra `main` arrastraría además los commits anteriores de esa rama.

## Resumen
Auditoría del RAG y del chat contra el documento maestro (`docs/audit/RAG-PLAN-DESARROLLO.md`), las 7 fases del plan, y dos rondas posteriores nacidas de pruebas en el navegador (preguntas de precio y prueba como CTO de un grupo energético). **Nada está desplegado.** Casi todo es aditivo o va tras un flag; lo que cambia el comportamiento está en «Cambios visibles».

## Commits
| Commit | Contenido |
|---|---|
| `acff5bbc` | **Fase 1.** `authenticateToken` rechaza tokens `role:service` y `type:refresh`; sesión de admin-console con `iss/aud`; modelo del chat `claude-sonnet-5-5`; degradación a extractivo registrada; Unicode (invisibles, bidi, homoglifos) compartido por escudo, cuarentena y tokenizador |
| `0089eed8` | **Fase 2.** Corpus de evaluación, `scripts/rag-eval.js`, validación de citas `[n]`, 10 tests de aislamiento |
| `6c8a3c9e` | **Fase 3.** Migración **065** + `KNOWLEDGE_RETRIEVAL=fts` (índice GIN). Con 14k fragmentos en un tenant el modo actual **devolvía vacío** (tope de 5000); `fts` 22 ms p50 |
| `52e42478` | **Fase 4.** `POST /api/nft-assets`: sólo con plan, sin ejecutables (lista blanca por firma), sin leer el contenido, a IPFS |
| `081ce365` | Ingesta de texto de tenants **apagada** (`KNOWLEDGE_TENANT_INGEST`); el RAG sólo usa el conocimiento público sembrado; se quita el clip del chat |
| `94d6e693` | **Fase 5.** Mismo Knowledge Plane para MCP (`bezhas_knowledge_search`) y Gateway REST (`/knowledge/search`) |
| `32240d13` | **Fase 6.** Métricas Prometheus + log JSON sin texto, techo diario y límite compartidos por Redis, `AI_WORKSPACE_ENABLED`, runbooks |
| `b01545d3` | **Fase 7.** Proveedor `ollama` opcional (sólo con `AI_PROVIDER=ollama`, URL privada, sin fallback a la nube), benchmark; el modelo local no cobra tokens |
| `01d66f87` | Sinónimos de precio en la búsqueda (cuesta, coste, tarifa, vale) y 12 preguntas de precio: recall de precio 50 % → 100 % |
| `3dac903c` | **R1–R4 del informe del CTO energético:** documentos de energía con el estado real; comprobación de cifras (`figures.js`); precios y límites de pago redactados por el servidor (`facts.js`, sin modelo ni cuota); Enterprise VIP para holdings |
| `6b4d4894` | **BEZ Energy usa el chat de la plataforma** (`_shared/ai-chat`) en lugar del widget antiguo `bz-chat.js` |
| `a2345994` | **BZ PureScan** también (probado en móvil; la barra queda sobre su navegación inferior). Estado del resto de SubApps documentado |

## Cambios visibles al desplegar
1. **Desaparece el clip** del chat (control-center). `POST /api/ai-workspace/knowledge` responde 403 `TENANT_INGEST_DISABLED`; los documentos de tenants ya guardados dejan de recuperarse.
2. Tokens con `role:service` o `type:refresh` dejan de valer contra la API.
3. **Las preguntas de precio de los planes y de límites de pago las contesta el servidor** (provider `facts`), sin modelo y **sin consumir una acción de IA**.
4. Si el modelo escribe un importe o porcentaje que no consta en lo que recibió, esa frase se retira y se avisa.
5. **BEZ Energy y BZ PureScan muestran otro chat** (barra «BeZhas AI», con la sesión de cada app). Genesis, Pay, Sphere, CargoLink, Prestige, Vision, Wallet, Gas y Edge siguen con `bz-chat.js`: Pay (checkout) y Sphere (mensajería) a propósito, Genesis por no poder probarla, y el resto porque no montan `BezhasAuthProvider`. Hasta que se migren, el usuario ve dos chats distintos según la app (`docs/audit/chat-energy/README.md`).
6. Con `JWT_STRICT_CLAIMS=true` (opcional) cierran las sesiones con tokens sin `iss/aud`.
7. Rutas nuevas: `/api/nft-assets`, `/api/gateway/v1/knowledge/search`, herramienta MCP `bezhas_knowledge_search`.

## Medido
- **Retrieval** (77 preguntas, `node api/scripts/rag-eval.js`): recall@4 **97,1 %**; precio 100 %, preguntas del CTO energético 100 %; inglés 0 % (2 preguntas, sin embeddings).
- **Prueba del CTO energético** (13 tareas en el navegador, modelo local): antes 5 ✅ / 4 ⚠️ / 4 ❌ (precio inventado «19,99 €/entidad», negaba el arbitraje con OMIE…); después, las 4 que fallaron salen bien y las 12 tareas de chat cumplen sus criterios. Informe con capturas: `docs/audit/informe-energia/`.
- **Modelo local** (RTX 5050 8 GB, `qwen3.5:4b` Q4_K_M, concurrencia 1): 98 % de acierto, TTFT p95 0,38 s, total p95 1,4 s (`docs/audit/RAG-TEST-BASELINE.md`).

## Pruebas
- `cd api && pnpm exec jest` → todas en verde (≈1.760 tests; 3 suites de integración se saltan sin entorno).
- Integración local: Postgres 16 real (`knowledge-pg.test.js`, 7/7; `fts` = modo completo para las 77 preguntas) y Ollama real (`ollama-chat.test.js`, `cto-energia-ollama.test.js`).
- `node --test App-nativas/_shared/__tests__/*.test.mjs` → 18/18; paridad del Markdown seguro con control-center (`ai-workspace-parity.test.ts`).
- Navegador: chat de control-center y chat de Energy (visitante, con sesión, móvil, catálogo).

## No probado / límites
- **Nada en Cloud Run / Cloud SQL / Memorystore reales.** Pinata real, Redis real (límites compartidos) y el inicio de sesión real de Energy contra la API de producción no se probaron. El build de Docker de Energy no se ejecutó (sí el `vite build`).
- Las respuestas se probaron con el modelo local de 4 B, **no con Claude** (no hay clave válida en el equipo). La comprobación de cifras sólo vigila importes y porcentajes; el modelo aún puede inventar otros detalles (p. ej. condiciones de plan para una app).
- La app Energy en sí no cambia: telemetría en parte simulada, driver de hardware pendiente y `EnergyCAEToken`, `BeZhasVPP` y `EnergyOracle` sin constar como desplegados; el chat ya lo explica.
- Detección de PDF activo de mejor esfuerzo; corpus de evaluación escrito por quien conoce los documentos (red de seguridad, no medida de calidad con tráfico real); sin alertas ni dashboard; HawkScan no ejecutado (sin `HAWK_API_KEY`).

## Antes de mergear / desplegar
`docs/runbooks/BEZHAS-AI-DEPLOYMENT.md` y `…-ROLLBACK.md`. Resumen: copia de seguridad de Cloud SQL; revisar las migraciones **049–065** pendientes (`db/migrate.js` aplica todas; la 051 revoca claves de desarrollo); desplegar; `node scripts/knowledge-reindex.js --all` (cambió el tokenizador); después `KNOWLEDGE_RETRIEVAL=fts` con `--update-env-vars`; configurar `PINATA_JWT`, comprobar `ANTHROPIC_API_KEY`/`AI_MODEL_ANTHROPIC` y `REDIS_URL`; `JWT_STRICT_CLAIMS` el último. Para Energy: `deploy/gcp/deploy-subapps.sh energy`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
