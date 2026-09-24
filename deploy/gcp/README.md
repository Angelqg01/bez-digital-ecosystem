# Despliegue de BeZhas en Google Cloud — www.bezhas.com

Proyecto: **`project-a2f60001-ecbb-49af-8c2`** · Región: **`us-central1`** ·
DNS: **Hostinger**

```
                    Hostinger DNS (A → IP del balanceador)
                                   │
              ┌────────────────────▼─────────────────────┐
              │  Balanceador HTTPS global (IP estática)  │
              │  Certificado gestionado · TLS ≥ 1.2      │
              │  Cloud Armor: OWASP + rate limit + DDoS  │
              └──┬──────────────┬──────────────┬─────────┘
   bezhas.com ─301─> www        │              │
   www.bezhas.com   api.bezhas.com      mcp.bezhas.com
         │                │                    │
  bezhas-frontend   bezhas-backend     bezhas-intelligence     (Cloud Run,
  (nginx + Vite)    (Express + WS)     (MCP server)             ingress solo LB)
                          │
          Secret Manager · PostgreSQL · MongoDB · Redis · Polygon RPC
```

Todo lo que hay en esta carpeta es idempotente: se puede volver a ejecutar sin
romper nada.

| Paso | Script | Qué hace | Cuándo |
|---|---|---|---|
| 1 | `01-bootstrap.sh` | APIs, Artifact Registry, cuentas de servicio, federación con GitHub | Una vez |
| 2 | `02-secrets.sh <.env>` | Sube los secretos a Secret Manager con acceso mínimo | Una vez y al rotar |
| 3 | `deploy.sh` | Construye las 3 imágenes y despliega en Cloud Run | Cada versión |
| 4 | `03-load-balancer.sh` | IP, balanceador, certificado, Cloud Armor | Una vez |
| 5 | `04-hostinger-dns.sh` | Apunta bezhas.com al balanceador por la API de Hostinger | Una vez |
| 6 | `05-verify.sh` | Comprueba DNS, certificado, salud y seguridad | Siempre |

## Requisitos

La forma más sencilla es **Cloud Shell** (consola de GCP → icono `>_`): ya trae
`gcloud`, `jq`, `dig` y bash 5, y está autenticado con tu cuenta.

En local: `gcloud` (autenticado con `gcloud auth login`), `jq`, `dig`, bash ≥ 4.
Tu cuenta necesita el rol **Owner** del proyecto para los pasos 1, 2 y 4.

El proyecto debe tener **facturación activa** (Cloud Run, el balanceador y
Cloud Armor la requieren).

## Paso a paso

```bash
git clone https://github.com/Angelqg01/bez-digital-ecosystem.git
cd bez-digital-ecosystem

# 1. Preparar el proyecto
./deploy/gcp/01-bootstrap.sh

# 2. Secretos: prepara un .env de producción FUERA del repositorio
cp .env.example ~/bezhas.env.production && chmod 600 ~/bezhas.env.production
#    …rellénalo (lista completa en deploy/gcp/secrets.list)…
./deploy/gcp/02-secrets.sh ~/bezhas.env.production

# 3. Primer despliegue de los servicios
./deploy/gcp/deploy.sh

# 4. Balanceador + certificado + WAF
./deploy/gcp/03-load-balancer.sh

# 5. DNS en Hostinger (el token se pide sin eco si no está en el entorno)
DRY_RUN=1 ./deploy/gcp/04-hostinger-dns.sh   # ver el plan
./deploy/gcp/04-hostinger-dns.sh             # aplicar

# 6. Esperar al certificado (15–60 min) y verificar
./deploy/gcp/05-verify.sh
```

### Valores imprescindibles en el `.env` de producción

- `ALLOWED_ORIGINS=https://www.bezhas.com,https://bezhas.com`
- `DATABASE_URL` (PostgreSQL; ver «Bases de datos»), `MONGODB_URI`
- `JWT_SECRET`, `COOKIE_SECRET`, `ADMIN_TOKEN`, `CONTACT_ENCRYPTION_KEY`:
  aleatorios y largos → `openssl rand -base64 48`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (el webhook de Stripe debe
  apuntar a `https://api.bezhas.com/api/stripe/webhook`)
- `POLYGON_RPC_URL`, `RELAYER_PRIVATE_KEY`, `BEZCOIN_CONTRACT_ADDRESS`,
  `TREASURY_WALLET`, `SUPER_ADMIN_WALLETS`

El script avisa de los obligatorios que falten y no sigue sin ellos. Los
opcionales sin valor simplemente no se montan en el contenedor.

### Bases de datos

Estos scripts no crean bases de datos: el backend las recibe por
`DATABASE_URL`, `MONGODB_URI` y `REDIS_URL`. Opciones:

- **PostgreSQL**: Cloud SQL (recomendado: IP privada + conector VPC) o un
  proveedor gestionado. Aplica las migraciones de `backend/db/migrations/` en
  orden numérico antes del primer despliegue.
- **MongoDB**: MongoDB Atlas, restringiendo el acceso por IP (para una IP de
  salida fija desde Cloud Run hace falta Cloud NAT).
- **Redis**: opcional (Memorystore o Upstash). Sin él, BullMQ queda desactivado.

## Despliegue automático desde GitHub

Tras el paso 1, crea en GitHub → *Settings → Secrets and variables → Actions*
los tres secretos que imprime `01-bootstrap.sh`:

- `GCP_PROJECT_ID`
- `GCP_SERVICE_ACCOUNT`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`

A partir de ahí, cada push a `main` que pase las pruebas ejecuta este mismo
`cloudbuild.yaml` (`.github/workflows/deploy-gcp.yml`). No hay claves JSON:
GitHub se autentica con tokens OIDC de corta duración, y el proveedor solo
acepta tokens de este repositorio.

## Seguridad: qué está hecho y por qué

- **Cuenta de servicio por servicio**, sin roles de proyecto salvo logs y
  métricas. Cada una solo puede leer *sus* secretos. La cuenta por defecto de
  Compute (rol Editor) no se usa.
- **Ingress restringido al balanceador**: las URLs `*.run.app` no responden
  desde Internet, así que Cloud Armor no se puede esquivar.
- **Cloud Armor**: reglas OWASP (SQLi, XSS, LFI, RFI, RCE, escáneres,
  protocolo, fijación de sesión), 600 peticiones/min por IP con bloqueo de
  10 min, y defensa adaptativa L7. Los webhooks firmados (Stripe, Telegram) se
  permiten antes de las reglas OWASP para evitar falsos positivos.
  Para empezar en modo observación: `ARMOR_PREVIEW=1 ./deploy/gcp/03-load-balancer.sh`
  (solo tiene efecto al crear la política).
- **TLS**: certificado gestionado por Google, política MODERN, mínimo TLS 1.2,
  redirección HTTP → HTTPS y bezhas.com → www.
- **IP real del cliente**: el backend usa `TRUST_PROXY_HOPS=2` detrás del
  balanceador; con 1, todas las peticiones compartirían la IP del balanceador
  y el limitador por IP las metería en el mismo cubo.
- **Secretos**: nunca en el repositorio, ni en argumentos de línea de
  comandos, ni en logs. El despliegue solo ve qué secretos existen, no su
  contenido.
- **DNS**: el script de Hostinger guarda una copia de la zona antes de tocarla
  (`deploy/gcp/dns-backups/`, ignorado por git) y no toca MX ni TXT: el
  correo sigue funcionando.
- **Imágenes**: etiquetadas con el commit, análisis de vulnerabilidades de
  Artifact Registry activado, limpieza automática de imágenes antiguas.

## Operación

```bash
# Volver a la revisión anterior del backend
gcloud run revisions list --service=bezhas-backend --region=us-central1
gcloud run services update-traffic bezhas-backend --region=us-central1 --to-revisions=<REVISION>=100

# Rotar un secreto: cambia el valor en tu .env y
./deploy/gcp/02-secrets.sh ~/bezhas.env.production && ./deploy/gcp/deploy.sh

# Peticiones bloqueadas por Cloud Armor
gcloud logging read 'resource.type="http_load_balancer" AND jsonPayload.enforcedSecurityPolicy.outcome="DENY"' --limit=50

# Deshacer el DNS: la zona anterior está en deploy/gcp/dns-backups/
```
