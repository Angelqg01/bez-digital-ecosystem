# BeZhas Blockchain en Google Cloud: www.bezhas.com

Proyecto: **`project-a2f60001-ecbb-49af-8c2`** · Región: **`us-central1`** ·
DNS: **Hostinger**

```
                    Hostinger DNS (A → IP del balanceador)
                                   │
              ┌────────────────────▼─────────────────────┐
              │  Balanceador HTTPS global (IP estática)  │
              │  Certificado por dominio · TLS ≥ 1.2     │
              │  Cloud Armor: OWASP + rate limit + DDoS  │
              └──┬──────────────┬──────────────┬─────────┘
   bezhas.com ─301─> www        │              │
   www.bezhas.com        api.bezhas.com   mcp.bezhas.com
         │                      └──────┬───────┘
 bezhas-control-center            bezhas-api  (REST + WebSocket + MCP + OAuth 2.1)
     (Next.js)                         │ token OIDC (solo run.invoker)
                   ┌───────────────────┼────────────────────┐
             bezhas-aegis      bezhas-ai-gateway    bezhas-agent-runtime    bezhas-edge-node
             (FastAPI, ML)     (IA)                 (agentes)               (privado)
                                       │
                 Secret Manager (BC_*) · Cloud SQL PostgreSQL 16 (IP privada)
```

Todo lo que hay en esta carpeta es idempotente: se puede volver a ejecutar sin
romper nada.

| Paso | Script | Qué hace | Cuándo |
|---|---|---|---|
| 1 | `01-bootstrap.sh` | APIs, Artifact Registry, cuentas de servicio, federación con GitHub | Una vez |
| 1b | `01b-database.sh` | Base de datos `bezhas_control` en Cloud SQL (solo IP privada) y `BC_DATABASE_URL` | Una vez |
| 0 | `00-generar-env.sh` | Crea/completa `~/bezhas-blockchain.env`: secretos internos al azar, par OAuth, admin del panel | Una vez y tras cada cambio de la plataforma |
| 2 | `02-secrets.sh <.env>` | Valida el `.env` y sube los secretos (`BC_*`) con acceso mínimo | Una vez y al rotar |
| 3 | `deploy.sh` | Construye las 6 imágenes, migra la base de datos y despliega | Cada versión |
| 4 | `03-load-balancer.sh` | Balanceador, certificados y Cloud Armor (o los reapunta) | Una vez |
| 5 | `04-hostinger-dns.sh` | Apunta bezhas.com al balanceador por la API de Hostinger | Una vez |
| 6 | `05-verify.sh` | Comprueba DNS, certificados, salud y seguridad | Siempre |
| 7 | `06-monitoring.sh` | Comprobación cada minuto de www, api y mcp y aviso por email si caen | Una vez |
| 8 | `07-stripe.sh` | Comprueba la clave live y el catálogo, crea el webhook y guarda su secreto | Una vez y al rotar la clave |
| — | `08-reset-admin.sh` | Aplica a la base el usuario/contraseña del admin de Secret Manager (tras cambiarlos con 00 + 02) | Al cambiar el admin sin poder entrar al panel |

## Paso de la versión anterior (BeZhas Hub) a esta

La IP, los certificados, Cloud Armor, la instancia de Cloud SQL y el DNS ya
existen y **no cambian**. Solo se añaden los servicios nuevos y el balanceador
se reapunta a ellos. Los secretos nuevos llevan el prefijo `BC_`, así que los de
la versión anterior siguen intactos y volver atrás es cambiar `config.env`.

En **Cloud Shell**:

```bash
cd ~ && rm -rf bezhas-blockchain
git clone -b feat/seguridad-transaccional-mcp \
  https://github.com/Angelqg01/bez-digital-ecosystem.git bezhas-blockchain
cd bezhas-blockchain

./deploy/gcp/01-bootstrap.sh     # añade la cuenta del edge node
./deploy/gcp/01b-database.sh     # base de datos bezhas_control + BC_DATABASE_URL

./deploy/gcp/00-generar-env.sh   # genera ~/bezhas-blockchain.env
nano ~/bezhas-blockchain.env     # claves de terceros que uses (todas opcionales)
./deploy/gcp/02-secrets.sh ~/bezhas-blockchain.env

./deploy/gcp/deploy.sh           # 20-30 min la primera vez
./deploy/gcp/03-load-balancer.sh # www → control-center, api/mcp → bezhas-api
./deploy/gcp/05-verify.sh
ALERT_EMAIL=tu@correo ./deploy/gcp/06-monitoring.sh
```

El `.env` de la versión anterior (`~/bezhas.env.production`) no se toca: esta
plataforma usa su propio fichero, `~/bezhas-blockchain.env`, con secretos
nuevos. No copies valores de uno a otro.

Los navegadores que ya visitaron la web anterior tenían instalado su service
worker (PWA). El panel nuevo sirve un `/sw.js` que lo retira: la primera visita
puede mostrar la versión vieja un instante y la pestaña se recarga sola con la
nueva.

## Requisitos

**Cloud Shell** (consola de GCP → icono `>_`) ya trae `gcloud`, `jq`, `dig`,
`node` y bash 5, y está autenticado con tu cuenta. Tu cuenta necesita el rol
**Owner** del proyecto y el proyecto, **facturación activa**.

## Secretos

`secrets.list` dice qué secreto lee cada servicio; `02-secrets.sh` da acceso
**solo** a esas cuentas de servicio y rechaza el `.env` (sin subir nada) si
encuentra valores de desarrollo, testnets, secretos repetidos, una misma wallet
en dos servicios, claves donde van direcciones o la clave del deployer.

- **Generados por `00-generar-env.sh`** (no los escribas a mano): `JWT_SECRET`,
  `INTERNAL_API_KEY`, `WALLET_VAULT_SECRET`, `SECRET_VAULT_KEY`,
  `TELEMETRY_PSEUDONYM_KEY`, par `OAUTH_JWT_*`, `ADMIN_USERNAME` +
  `ADMIN_PASSWORD_HASH` (bcrypt; la contraseña en claro, `ADMIN_PASSWORD`, se
  queda en tu `.env` y no se sube), claves del edge node y de los agentes.
  **Los tres de los vaults cifran datos**: si se pierden, lo cifrado no se
  recupera. Guarda una copia del `.env` fuera de GCP (gestor de contraseñas).
- **De terceros, opcionales**: RPC (`POLYGON_RPC_URL`, `RPC_URL`), Stripe
  (`07-stripe.sh` crea el webhook `https://api.bezhas.com/api/webhooks/stripe`
  y rellena `STRIPE_WEBHOOK_SECRET`), Gemini,
  DeepSeek, Anthropic, Pinata, Telegram, Discord, Redis.
- **Wallets calientes** (`OPERATOR_PRIVATE_KEY`, `AGENT_PRIVATE_KEY`,
  `EDGE_NODE_PRIVATE_KEY`): nuevas, una por servicio, con saldo mínimo de gas
  y sin roles de admin. Nunca la del tesoro, la del deployer ni la multisig.
- `BC_DATABASE_URL` lo crea `01b-database.sh`; no va en el `.env`.

## Seguridad: qué está hecho y por qué

- **Cuenta de servicio por papel**, sin roles de proyecto salvo logs y métricas.
- **Públicos solo por el balanceador** (`internal-and-cloud-load-balancing`):
  las URLs `*.run.app` del panel y de la api no responden desde Internet, así
  que Cloud Armor no se puede esquivar.
- **Privados con IAM** (`--no-allow-unauthenticated`): aegis, ai-gateway,
  agent-runtime y edge-node solo aceptan tokens OIDC de las cuentas que tienen
  `run.invoker` sobre ellos (la api y los servicios internos que los llaman).
- **Cloud Armor**: OWASP, 600 peticiones/min por IP con bloqueo de 10 min,
  defensa L7. Los webhooks firmados (`/api/webhooks/stripe`, `/api/webhooks/bank`)
  pasan antes de las reglas OWASP; su firma la comprueba la api.
- **Limitador de la api** (`api/config/rateLimit.js`): 1000 peticiones cada
  15 min por IP real (`TRUST_PROXY_HOPS=2`), sin atajos por cabecera; los
  webhooks firmados no pasan por él. Cloud Armor limita por encima.
- **Redis opcional de verdad**: sin Redis la api responde (caché y limitador
  degradan) en vez de quedarse esperando.
- **Cabeceras** del panel: `nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS.
- **CORS**: la api solo admite `https://www.bezhas.com` y `https://bezhas.com`
  (más `*.bez.digital`, de fábrica).
- **Subida mínima** a Cloud Build: `.gcloudignore` es una lista blanca de los 6
  servicios (~22 MB en vez de ~330 MB con documentos internos).

## Operación

```bash
# Logs de un servicio
gcloud run services logs read bezhas-api --region=us-central1 --limit=100

# Volver a la revisión anterior
gcloud run revisions list --service=bezhas-api --region=us-central1
gcloud run services update-traffic bezhas-api --region=us-central1 --to-revisions=<REVISION>=100

# Volver a la plataforma anterior (Hub) entera: en config.env
#   FRONTEND_SERVICE=bezhas-frontend BACKEND_SERVICE=bezhas-backend MCP_SERVICE=bezhas-intelligence
# y ./deploy/gcp/03-load-balancer.sh

# Rotar un secreto: cambia el valor en tu .env y
./deploy/gcp/02-secrets.sh ~/bezhas-blockchain.env && ./deploy/gcp/deploy.sh

# Peticiones bloqueadas por Cloud Armor
gcloud logging read 'resource.type="http_load_balancer" AND jsonPayload.enforcedSecurityPolicy.outcome="DENY"' --limit=50
```
