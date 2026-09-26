# 🔐 Guía de Configuración de Secretos en GCP - BeZhas

## Visión General

Este documento te guía para **cargar de forma segura** los secretos de tu blockchain L2 en **Google Cloud Secret Manager**.

El sistema usa:
- **02-secrets.sh**: Script bash que lee un archivo `.env.production` LOCAL y carga los secretos en GCP
- **secrets.list**: Definición de qué secretos existen y quién los puede leer
- **Replicación automática**: Los secretos se replican globalmente en GCP (seguridad)
- **IAM por servicio**: Cada microservicio (backend, MCP) solo ve los secretos que necesita

---

## ⚠️ Requisitos de Seguridad

Antes de empezar, **garantiza estas prácticas**:

### 1. **Máquina limpia y aislada**
```bash
# La máquina desde donde ejecutas debe ser de confianza
# Nunca desde:
#  - Máquinas compartidas o públicas
#  - Máquinas sin cifrado de disco
#  - Máquinas sin antimalware actualizado
```

### 2. **Autenticación en GCP**
```bash
# Autentica con tu cuenta de Google (propietario del proyecto)
gcloud auth login
gcloud config set project project-a2f60001-ecbb-49af-8c2

# Verifica permisos (necesitas "Secret Manager Admin")
gcloud projects get-iam-policy project-a2f60001-ecbb-49af-8c2 \
  --flatten="bindings[].members" \
  --filter="bindings.role:secretmanager.admin"
```

### 3. **Permisos de archivo**
```bash
# El archivo .env.production DEBE tener permisos 600 (solo el dueño)
chmod 600 ~/.bezhas/.env.production

# El script 02-secrets.sh es una verificación de seguridad
# Si los permisos son más permisivos, el script te advierte
```

### 4. **Variables locales nunca se loggean**
```bash
# El script usa `printf` en lugar de `echo` para evitar que
# los valores sensibles queden en el historial de bash
set +H   # Desactiva historial de expansión (opcional en scripts)
```

---

## 📋 Paso 1: Preparar el archivo `.env.production`

Crea un archivo **NUNCA** versionado con tus secretos:

```bash
# Crea la carpeta si no existe
mkdir -p ~/.bezhas
cd ~/.bezhas

# Crea el archivo con permisos restrictivos
touch .env.production
chmod 600 .env.production

# Edita con tu editor preferido (sin loggear los valores)
nano .env.production
```

### Plantilla de contenido (copia, pega y **reemplaza** los valores):

```env
# ═══════════════════════════════════════════════════════════
# BeZhas — Secretos de Producción
# Archivo: ~/.bezhas/.env.production
# ⚠️  NUNCA subir a Git, NUNCA compartir
# ═══════════════════════════════════════════════════════════

# --- JWT & Seguridad ---
JWT_SECRET=tu_jwt_secret_aqui_32_caracteres_minimo
COOKIE_SECRET=tu_cookie_secret_aqui_32_caracteres_minimo
ADMIN_TOKEN=tu_admin_token_largo_y_unico
CONTACT_ENCRYPTION_KEY=tu_encryption_key_base64_aqui

# --- OAuth 2.1 (Par ES256 - Generado con OpenSSL) ---
# Generar con: openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt
# Luego base64 -w0 priv.pem y base64 -w0 pub.pem
OAUTH_JWT_PRIVATE_KEY=base64_encoded_private_key_aqui
OAUTH_JWT_PUBLIC_KEY=base64_encoded_public_key_aqui

# --- RPC URLs (Blockchain) ---
# Polygon Mainnet (Chain 137)
POLYGON_RPC_URL=https://polygon-rpc.com
# O una RPC privada: https://polygon.infura.io/v3/YOUR_INFURA_KEY

# Tu L2 BeZhas (o testnet privado)
BEZHAS_L2_RPC_URL=https://l2.bezhas.com/rpc
# O: http://localhost:8545 si corre localmente

# Fallback para MCP
RPC_URL=https://polygon-rpc.com

# --- Wallets & Operadores ---
# ⚠️  NUNCA uses wallets con fondos reales
# Cada una debe ser DEDICADA con permisos MÍNIMOS

# Relayer de transacciones (opcional, solo si necesitas transacciones sin gas)
RELAYER_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
RELAYER_ADDRESS=0xYourRelayerAddress123456789012345678

# Operador del nodo (valida transacciones)
OPERATOR_PRIVATE_KEY=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
OPERATOR_ADDRESS=0xYourOperatorAddress123456789012345678

# Agentes inteligentes (ejecutan contratos inteligentes)
AGENT_PRIVATE_KEY=0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210
AGENT_ADDRESS=0xYourAgentAddress12345678901234567890

# Edge nodes (para procesamiento descentralizado)
EDGE_NODE_PRIVATE_KEY=0x1111111111111111111111111111111111111111111111111111111111111111
EDGE_NODE_ADDRESS=0xYourEdgeNodeAddress123456789012345678

# --- Contratos Inteligentes (direcciones públicas, no secretas) ---
BEZCOIN_CONTRACT_ADDRESS=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
TREASURY_WALLET=0xYourTreasuryWallet123456789012345678
SUPER_ADMIN_WALLETS=0xAdmin1,0xAdmin2,0xAdmin3
ALLOWED_ORIGINS=https://www.bezhas.com,https://api.bezhas.com

# --- IPFS / Pinata ---
PINATA_API_KEY=your_pinata_api_key_here
PINATA_SECRET_KEY=your_pinata_secret_key_here
PINATA_JWT=your_pinata_jwt_token_here

# --- Email (SMTP) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@bezhas.com
SMTP_PASS=your_app_password_here

# --- Stripe (Pagos) ---
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# --- OAuth Terceros (Google, GitHub, LinkedIn) ---
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# --- Databases ---
# DATABASE_URL NO va aquí: lo genera 01b-database.sh en GCP
# MONGODB_URI es opcional (solo si usas MongoDB)
MONGODB_URI=mongodb+srv://bezhas_user:password@cluster.mongodb.net/bezhas

# --- IA & APIs ---
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=sk_xxxxxxxx
DEEPSEEK_API_KEY=your_deepseek_key
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
FIRECRAWL_API_KEY=your_firecrawl_key
```

---

## 🚀 Paso 2: Cargar los Secretos en GCP

### Opción A: **Script automático (recomendado)**

```bash
# Desde la raíz del repositorio
cd ~/bez-digital-ecosystem

# Ejecuta el script de carga
./deploy/gcp/02-secrets.sh ~/.bezhas/.env.production
```

**El script:**
1. Lee el archivo `.env.production` **sin ejecutarlo** (seguro contra inyecciones)
2. Para cada secreto en `secrets.list`:
   - Crea el secreto si no existe (replicación automática en GCP)
   - Agrega una **nueva versión SOLO si el valor cambió**
   - Da acceso **SOLO** a la cuenta de servicio que lo lee (IAM)
3. Nunca imprime los valores (seguridad)
4. Verifica que no falten secretos obligatorios

**Salida esperada:**
```
  + creado RPC_URL
  ↑ nueva versión de BEZHAS_L2_RPC_URL
  = OPERATOR_PRIVATE_KEY sin cambios
  · MONGODB_URI opcional sin valor (no se montará)
  secretAccessor asignado a bezhas-backend-run, bezhas-mcp-run

✅ Secretos listos. Siguiente paso: ./deploy/gcp/deploy.sh
```

### Opción B: **Manual (gcloud CLI)**

Si prefieres cargar un secreto de forma individual:

```bash
# Crear un secreto NUEVO
gcloud secrets create BEZHAS_L2_RPC_URL \
  --replication-policy=automatic \
  --labels=app=bezhas \
  --data-file=-

# Se abre un prompt para pegar el valor
# (escribe el valor, Enter, Ctrl+D para terminar)

# O desde archivo:
echo "https://l2.bezhas.com/rpc" | \
  gcloud secrets versions add BEZHAS_L2_RPC_URL \
  --data-file=-

# Dar acceso a una cuenta de servicio
gcloud secrets add-iam-policy-binding BEZHAS_L2_RPC_URL \
  --member=serviceAccount:bezhas-backend-run@project-a2f60001-ecbb-49af-8c2.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

---

## 🔍 Paso 3: Verificar que los Secretos están en GCP

```bash
# Listar todos los secretos
gcloud secrets list --filter="labels.app:bezhas"

# Ver versiones de un secreto (sin leer el valor)
gcloud secrets versions list BEZHAS_L2_RPC_URL

# Leer un secreto (CUIDADO: aparecerá en pantalla)
gcloud secrets versions access latest --secret=BEZHAS_L2_RPC_URL

# Verificar permisos de acceso
gcloud secrets get-iam-policy OPERATOR_PRIVATE_KEY --format=json
```

---

## 🛠️ Paso 4: Desplegar en Cloud Run

Una vez confirmados los secretos, despliega:

```bash
# Desde deploy/gcp/
./deploy.sh

# O manualmente:
gcloud builds submit . \
  --config=deploy/gcp/cloudbuild.yaml \
  --project=project-a2f60001-ecbb-49af-8c2 \
  --service-account=projects/project-a2f60001-ecbb-49af-8c2/serviceAccounts/bezhas-deployer@project-a2f60001-ecbb-49af-8c2.iam.gserviceaccount.com
```

El **cloudbuild.yaml** leerá automáticamente los secretos con versión activa y los inyectará en los contenedores.

---

## 🔐 Consideraciones de Seguridad Críticas

### ✅ **Está bien hacer esto:**
- ✅ Usar **claves privadas DEDICADAS** para cada rol (operator, agent, edge node)
- ✅ Rotar claves regularmente (`gcloud secrets versions add`)
- ✅ Usar **wallets de operación** con **bajo balance** (no wallets de tesoro)
- ✅ Versionar `secrets.list` en Git (es público, solo define qué secretos existen)
- ✅ Usar **HTTPS** para todas las RPC URLs
- ✅ Monitorear accesos: `gcloud logging read "resource.type=secretmanager.googleapis.com""`

### ❌ **NUNCA hacer esto:**
- ❌ Versionear `.env.production` en Git
- ❌ Pasar secretos por argumentos de línea de comandos (`gcloud ... --secret-key=xxx`)
- ❌ Imprimir valores en logs o stdout
- ❌ Usar la **misma clave privada** para múltiples roles
- ❌ Usar wallets de **tesoro/producción** para operadores
- ❌ Compartir claves privadas por email, Slack, etc.
- ❌ Descargar todas las versiones de un secreto (solo la activa)
- ❌ Usar RPC públicas sin API key (rate limiting)

---

## 📊 Integración en tu Blockchain L2

### En el Backend (`backend/server.js`):

```javascript
// Las variables se inyectan automáticamente como env vars
const operatorKey = process.env.OPERATOR_PRIVATE_KEY;
const l2RpcUrl = process.env.BEZHAS_L2_RPC_URL;
const agentKey = process.env.AGENT_PRIVATE_KEY;

// Ejemplo: Firmar una transacción con el operador
const operator = ethers.Wallet.fromPrivateKey(operatorKey, provider);
const signedTx = await operator.signTransaction(tx);
```

### En el MCP (`packages/mcp-server/server.js`):

```typescript
// El MCP tiene acceso solo a secretos en secrets.list con "mcp" en la columna 2
const rpcUrl = process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL;
const agentAddress = process.env.AGENT_ADDRESS;
```

---

## 🚨 Recuperación ante Compromiso

Si **sospechas** que se filtró una clave privada:

```bash
# 1. Crear inmediatamente una NUEVA versión (con nueva clave)
echo "0xNEW_PRIVATE_KEY_HERE" | \
  gcloud secrets versions add OPERATOR_PRIVATE_KEY --data-file=-

# 2. Desplegar nuevamente (Cloud Run tomará la versión :latest)
gcloud run deploy bezhas-backend \
  --region=us-central1 \
  --image=us-central1-docker.pkg.dev/project-.../bezhas-backend:latest \
  --set-secrets=OPERATOR_PRIVATE_KEY=OPERATOR_PRIVATE_KEY:latest

# 3. Revocar la wallet antigua en blockchain (si es posible)
# Transferir fondos, cambiar permisos, etc.

# 4. Auditar logs
gcloud logging read "resource.type=secretmanager.googleapis.com AND protoPayload.resourceName=~'OPERATOR_PRIVATE_KEY'" \
  --limit 50 --format json
```

---

## 📞 Ayuda Rápida

| Problema | Solución |
|----------|----------|
| "permission denied" | Verifica `gcloud auth login` y `gcloud config set project ...` |
| Script dice "Faltan secretos obligatorios" | Agrega los valores en `.env.production` y vuelve a ejecutar |
| Cambio no se refleja en Cloud Run | Espera a que Cloud Run redeploy (si activaste auto-deploy en CI/CD) |
| Quiero rotar todas las claves | Ejecuta `02-secrets.sh` nuevamente con valores nuevos |
| ¿Quién accedió a mis secretos? | `gcloud logging read "resource.type=secretmanager.googleapis.com" --limit 50` |

---

**Generado con Claude Code | BeZhas Team**
