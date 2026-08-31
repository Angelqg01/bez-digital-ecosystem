# OPERANT — Stack Soberano ("todo propio", auto-alojado)

> **Objetivo del usuario:** no depender de APIs de pago de terceros. Para cada herramienta
> que necesita la plataforma, montamos una versión **propia / open source auto-alojada**,
> la envolvemos en un *connector* y la exponemos en el SaaS **como si fuera nativa**.
> La app es **instalable** (Electron/Tauri o servicio local) y puede **leer/gestionar
> archivos del PC o del servidor**, pidiendo siempre permiso/servicio.

Este documento es la fuente de verdad de QUÉ construimos, CON QUÉ base open source, y
CÓMO se integra. Complementa `PLAN-DESARROLLO.md` y `ROADMAP.md`.

---

## 0. Principio rector y los 3 límites honestos

**Principio:** *fork/self-host de un proyecto open source maduro + connector nativo* es
casi siempre mejor que escribir desde cero. Reutilizamos años de trabajo y mantenemos el
control total (datos, despliegue, coste marginal ~0).

Hay **tres** capacidades donde el software propio NO basta porque hay una "última milla"
física o regulada. No es opcional: es cómo funciona el mundo. Lo decimos claro:

| Capacidad | Lo que SÍ podemos auto-hospedar | La "última milla" que requiere un tercero |
|---|---|---|
| **Banco FIAT** | Ledger propio, cuentas, balances, conciliación, contabilidad de doble entrada | Mover € reales necesita un **partner BaaS / licencia EMI**. Tocar dinero de clientes sin licencia es delito (PSD2/EMI en UE). |
| **Banco CRIPTO** | **Todo**: nodos propios, wallets (custodia/MPC), firma, swaps on-chain | Para convertir cripto↔FIAT hace falta un *on/off-ramp* o exchange. La parte cripto pura es 100% soberana. |
| **Llamadas de voz** | PBX (FreeSWITCH), STT (Whisper), TTS (Piper/Coqui), el agente IA, grabación, transcripción | Conectar con la **red telefónica (PSTN)** necesita un **SIP trunk** (un número y minutos los da un carrier). VoIP interno entre apps es 100% propio. |
| **Email** | **Todo**: servidor de correo propio (Stalwart), buzones, envío, IMAP/SMTP, antispam | Solo necesitas una **IP con buena reputación** y registros DNS (SPF/DKIM/DMARC). Auto-hospedable al 100%. |

> Traducción: **email y cripto son 100% soberanos**. **Banco FIAT y telefonía** los
> construimos enteros salvo el "enchufe" final al sistema bancario / red telefónica, que
> se conecta con un adaptador intercambiable (hoy un partner, mañana licencia propia).

---

## 1. Arquitectura: cómo "todo nativo" sin caos

Cada herramienta propia es un **servicio** en `infra/docker-compose.full.yml`. El SaaS
nunca habla con un servicio directamente: habla con un **Connector** (extiende
`BaseConnector`) que traduce `execute(method, args)` → la API del servicio. Así:

- Los **agentes** siguen llamando `connector.execute(...)` sin saber qué hay detrás.
- Cambiar el motor (p.ej. Twenty → ERPNext) es cambiar un connector, no los agentes.
- Las **líneas rojas** (PolicyEngine/HITL) se aplican igual sea cual sea el backend.

```
Agente (Capa 3)
   │ connector.execute('crm','createLead', {...})
   ▼
Connector (Capa 6)  ──► Servicio propio auto-alojado (Docker)  ──► [última milla si aplica]
   │                       (Twenty, Stalwart, Chatwoot, …)            (SIP trunk, BaaS, on-ramp)
   ▼
PolicyEngine + HITL + AuditLog   (toda acción sensible pasa por aquí)
```

### App instalable + acceso a archivos
- **Shell de escritorio:** Tauri (Rust, ligero) o Electron. Empotra el panel web actual.
- **Acceso a archivos del PC/servidor:** módulo `FileAgent` con un *connector* de sistema
  de ficheros **sandboxed** (lista blanca de carpetas, todo pasa por PolicyEngine).
  Leer/clasificar/mover/generar archivos (CVs, facturas, informes) como una acción más.
- Los servicios pesados (DB, correo, PBX) viven en el **servidor**; la app de escritorio
  es el cliente + el `FileAgent` local.

---

## 2. Mapa de reemplazo: API de pago → App propia (open source)

### NIVEL 1 — Motor y datos (100% soberano, ya casi listo)
| Necesidad | Hoy (pago) | App propia (open source) | Cómo entra |
|---|---|---|---|
| LLM | Anthropic API | **Ollama** (Llama/Qwen/DeepSeek local) + ruta Anthropic opcional | `ModelGateway` ya tiene tiers; añadir provider `ollama` |
| Base de datos | RDS gestionado | **PostgreSQL** propio | ya cableado (`PostgresStore`) |
| Vector / RAG | Pinecone | **pgvector** (mismo Postgres) o **Qdrant** | `VectorDB` connector + embeddings locales |
| Embeddings | OpenAI embeddings | **Ollama** (`nomic-embed-text`) / `bge-m3` | `ModelGateway.embed()` |
| Caché / colas | Upstash | **Redis / Valkey** propio | nuevo `platform/cache.js` |
| Object storage | S3 | **MinIO** (S3-compatible) | `StorageConnector` |
| Auth | Clerk/Auth0 | **Authentik** o **Keycloak** | reemplaza API-key plana por OIDC |
| Hosting | Railway | **Docker Compose** en tu servidor | `infra/` |

### NIVEL 2 — Comunicación, pagos, dinero
| Necesidad | App propia (open source) | Última milla |
|---|---|---|
| **Email propio** | **Stalwart** (servidor todo-en-uno: SMTP/IMAP/JMAP, antispam) | IP + DNS (SPF/DKIM/DMARC) |
| Envío masivo/transaccional | **Postal** o el propio Stalwart | reputación de IP |
| Bandeja omnicanal (WhatsApp/IG/web/email) | **Chatwoot** | API de cada canal |
| WhatsApp | **Evolution API** o WAHA (no oficial) / Meta Cloud (oficial) | nº de WhatsApp |
| Telegram | Bot API propia (ya conectado) | — |
| **Pagos / cobros** | **BTCPay Server** (cripto, 100% propio) + **Invoice Ninja** (facturas FIAT) | on-ramp para FIAT |
| **Banco (ledger)** | **ledger propio** (doble entrada en Postgres) + **Fireblocks-style MPC** con `web3`/`ethers` para cripto | partner BaaS (FIAT) / on-ramp |
| **Llamadas IA + voz** | **LiveKit Agents** o **pipecat** (orquestación) + **FreeSWITCH/Asterisk** (PBX) + **Whisper** (STT) + **Piper/Coqui XTTS** (TTS) | SIP trunk (PSTN) |
| SMS | vía SIP trunk / gateway propio | carrier |
| Calendario | **Cal.com** auto-alojado | — |
| Firma digital | **Documenso** (alternativa a DocuSign) | — |

### NIVEL 3 — Herramientas de negocio por departamento
| Departamento | App propia (open source) | Sustituye a |
|---|---|---|
| **Ventas / CRM** | **Twenty** (ya en PoC) o **ERPNext** | HubSpot/Pipedrive |
| **Soporte** | **Chatwoot** (tickets + omnicanal) | Zendesk/Intercom |
| **Finanzas** | **Invoice Ninja** / **Crater** + módulo contable de **ERPNext** | Holded/Quaderno |
| **RR.HH.** | **ERPNext HR** / **OrangeHRM** | Factorial/Personio |
| **Operaciones / ERP** | **ERPNext** (inventario, compras, proyectos) | SAP-lite |
| **Marketing — social** | **Mixpost** / **Postiz** (programación y publicación) | Buffer/Hootsuite |
| **Marketing — SEO** | crawler propio + **Lighthouse** + datos de búsqueda | Ahrefs/Semrush |
| **Prospección leads** | scraper propio (respetando ToS) + enriquecimiento LLM | Apollo |
| **Automatización (pegamento)** | **n8n** / **Activepieces** / **Windmill** auto-alojado | Zapier/Make |
| **Open Banking** | **GoCardless/Nordigen**-style vía agregador, o lectura de extractos | — |

### NIVEL 4 — Observabilidad y calidad (100% soberano)
| Necesidad | App propia (open source) |
|---|---|
| Tracing + métricas + logs | **SigNoz** (todo-en-uno) o **Grafana + Prometheus + Loki + Tempo** |
| Observabilidad de LLM (prompt/respuesta/tokens/coste por llamada) | **Langfuse** self-hosted — ✅ integrado, ver [docs/OBSERVABILIDAD-LANGFUSE.md](OBSERVABILIDAD-LANGFUSE.md) |
| Errores | **GlitchTip** (compatible Sentry) o Sentry self-host |
| Evals de agentes | **harness propio** en `evals/` (golden sets por agente) |
| CI/CD | **Gitea Actions** o GitHub Actions |

---

## 3. Las 3 apps propias destacadas (lo que pediste explícito)

### 3.1 App-Banco (FIAT/Cripto) — `services/bank/`
- **Ledger de doble entrada** propio (Postgres): cuentas, asientos, balances, conciliación.
- **Cripto (soberano):** nodos propios (Bitcoin Core / un RPC Ethereum), wallets con
  custodia **MPC** (umbral de firmas) → **toda transacción saliente = línea roja → HITL**.
  Integra **BTCPay Server** para cobrar en cripto sin intermediarios.
- **FIAT:** el ledger es propio; el movimiento real de € se hace por un **adaptador
  intercambiable** (`FiatRail`) que hoy apunta a un partner BaaS y el día de mañana a
  licencia propia. Nada cambia en los agentes.
- **Guardrail absoluto:** ningún agente mueve fondos solo. `FINANCE_DISBURSEMENT` y
  cualquier `BANK_TRANSFER` → `requiresApproval: true`, siempre.

### 3.2 App-Comunicaciones (llamadas IA + mensajería) — `services/comms/`
- **Voz:** PBX (FreeSWITCH) ↔ **LiveKit/pipecat** ↔ pipeline `STT (Whisper) → Agente
  (Claude/Ollama) → TTS (XTTS/Piper)`. Llamadas entrantes y salientes (salientes en frío
  = línea roja → HITL). Grabación + transcripción + resumen automáticos.
- **Mensajería:** **Chatwoot** como bandeja única. Agentes que **buscan** clientes
  (prospección) y **responden** (soporte/ventas) por WhatsApp, Telegram, email, web.
- **Última milla:** SIP trunk para PSTN (intercambiable, como el `FiatRail`).

### 3.3 App-Email propio — `services/mail/`
- **Stalwart** auto-alojado: dominios, buzones por tenant, SMTP/IMAP/JMAP, antispam.
- Connector `MailServer` para crear buzones, enviar/leer, y alimentar a los agentes
  (el `OutreachAgent` envía; el `SupportAgent` lee y responde).
- 100% soberano (solo requiere IP con reputación + DNS).

---

## 4. Orden de construcción (vertical primero, sin boil-the-ocean)

> Regla de oro intacta: **un departamento de verdad funcionando > diez a medias.**

**Fase A — Cimientos soberanos (semanas 1-2)** ✅ *hecha en código (pendiente probar en vivo)*
1. ✅ `infra/docker-compose.full.yml`: Postgres+pgvector, Valkey, MinIO, Ollama (y más, por
   perfiles; la observabilidad, en `infra/docker-compose.observability.yml`). Perfil `core`
   levantado y verificado de punta a punta con `npm run pilot`.
2. ✅ `ModelGateway` con provider **Ollama** (`providers/ollama.js`, LLM + embeddings) +
   embeddings reales en RAG (`KnowledgeBase` híbrida coseno/términos, cableada vía `TenantManager.embedder`).
3. ✅ `StorageConnector` (MinIO, aislado por tenant) + `FileSystemConnector` sandboxed
   (FileAgent: leer/escribir en lista blanca; mover/borrar = línea roja). Cableados en el signup.
   Testeado en `test/foundations.test.js`. *Pendiente:* `npm i minio nodemailer` y probar contra servicios vivos.

**Fase B — Primer vertical 100% propio: Ventas + CRM (semanas 2-4)**
4. ✅ `TwentyCRM` connector (del PoC) cableado a los agentes de ventas
   (`test/sales-vertical.test.js`, end-to-end).
5. ✅ **Email propio** (Stalwart vía SMTP/nodemailer) → `OutreachAgent` envía de verdad
   (el envío en frío pasa por HITL). *Pendiente:* IP con reputación + SPF/DKIM/DMARC.
6. ✅ n8n auto-alojado como pegamento de eventos: `connectors/AutomationConnector.js`
   (webhooks + API, simulado sin `N8N_API_URL`), servicio en `docker-compose.full.yml`
   (perfil `business`, persistido en el Postgres propio) y política separada
   ejecutar/leer (`automation` vs `automation_read`) — disparar un workflow es poder
   arbitrario, así que el tenant puede exigir aprobación de un golpe.
   Testeado en `test/automation.test.js`. *Pendiente:* crear los workflows reales
   (lead creado → CRM, factura emitida → correo) contra un n8n vivo.

**Fase C — Comunicaciones (semanas 4-7)**
7. Chatwoot (bandeja omnicanal) + WhatsApp.
8. App-llamadas: PBX + Whisper + TTS + agente (primero VoIP interno, luego SIP trunk).

**Fase D — Banco y finanzas (semanas 7-10)**
9. Ledger de doble entrada + BTCPay (cripto) + Invoice Ninja (facturas).
10. `FiatRail`/`CryptoRail` adaptadores con HITL absoluto.

**Fase E — Resto departamentos sobre ERPNext (semanas 10-14)**
11. ERPNext (HR, inventario, compras, contabilidad) + connectors.

**Fase F — Continuo:** SigNoz (observabilidad genérica), ✅ Langfuse (observabilidad de LLM — ver [docs/OBSERVABILIDAD-LANGFUSE.md](OBSERVABILIDAD-LANGFUSE.md)), evals, LearningEngine real.

---

## 5. Avisos legales (no opcionales)
- **Dinero:** custodiar/mover fondos de terceros sin licencia EMI/PSD2 es ilegal en la UE.
  El ledger y la cripto propia son legales; el *on/off-ramp* FIAT debe ir por un partner
  con licencia hasta que tengamos la nuestra.
- **Telefonía:** las llamadas salientes en frío y la grabación tienen normativa (consentimiento,
  horarios, listas Robinson). El agente graba/llama solo dentro de la ley.
- **Datos (RGPD):** correo, CRM y grabaciones contienen datos personales. Borrado,
  consentimiento y DPA obligatorios.
- **Scraping:** la prospección respeta los ToS de cada sitio y el RGPD.
