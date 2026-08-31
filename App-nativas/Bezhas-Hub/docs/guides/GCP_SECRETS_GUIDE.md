# 🔐 GCP Secret Manager - Guía de Configuración

## Estado Actual

✅ **15 Secretos creados** en GCP Secret Manager con valores placeholder  
✅ **Proyecto:** `totemic-bonus-479312-c6`  
✅ **Cloud Run, Cloud Build, Secret Manager** habilitados  

---

## 🔗 Links para Actualizar Secretos

### 1. Consola de Secret Manager (actualizar todos los secretos)
**[🔗 Abrir Secret Manager](https://console.cloud.google.com/security/secret-manager?project=totemic-bonus-479312-c6)**

Para actualizar un secreto:
1. Click en el nombre del secreto
2. Click en **"Nueva versión"**
3. Pegar el valor real
4. Click en **"Agregar nueva versión"**

---

## 📋 Lista de Secretos y Dónde Obtener las Claves

| Secreto | Dónde Obtenerlo | Link Directo |
|---------|-----------------|--------------|
| **JWT_SECRET** | Genera uno seguro | [Random Key Generator](https://randomkeygen.com/) |
| **MONGODB_URI** | MongoDB Atlas | [🔗 MongoDB Atlas](https://cloud.mongodb.com/) |
| **REDIS_URL** | Redis Cloud / Upstash | [🔗 Upstash](https://upstash.com/) |
| **STRIPE_SECRET_KEY** | Dashboard Stripe | [🔗 Stripe API Keys](https://dashboard.stripe.com/apikeys) |
| **STRIPE_WEBHOOK_SECRET** | Stripe Webhooks | [🔗 Stripe Webhooks](https://dashboard.stripe.com/webhooks) |
| **GOOGLE_CLIENT_ID** | Google Cloud Console | [🔗 Google Credentials](https://console.cloud.google.com/apis/credentials?project=totemic-bonus-479312-c6) |
| **GOOGLE_CLIENT_SECRET** | Google Cloud Console | [🔗 Google Credentials](https://console.cloud.google.com/apis/credentials?project=totemic-bonus-479312-c6) |
| **GITHUB_CLIENT_ID** | GitHub Developer Settings | [🔗 GitHub OAuth Apps](https://github.com/settings/developers) |
| **GITHUB_CLIENT_SECRET** | GitHub Developer Settings | [🔗 GitHub OAuth Apps](https://github.com/settings/developers) |
| **GEMINI_API_KEY** | Google AI Studio | [🔗 Google AI Studio](https://aistudio.google.com/apikey) |
| **OPENAI_API_KEY** | OpenAI Platform | [🔗 OpenAI API Keys](https://platform.openai.com/api-keys) |
| **PINATA_API_KEY** | Pinata Cloud | [🔗 Pinata API Keys](https://app.pinata.cloud/developers/api-keys) |
| **PINATA_SECRET_KEY** | Pinata Cloud | [🔗 Pinata API Keys](https://app.pinata.cloud/developers/api-keys) |
| **RELAYER_PRIVATE_KEY** | Tu wallet MetaMask | Exportar desde MetaMask |
| **POLYGON_RPC_URL** | Alchemy / Infura | [🔗 Alchemy](https://dashboard.alchemy.com/) o [🔗 Infura](https://infura.io/) |

---

## 🛠️ Actualizar Secretos via Terminal

Si prefieres usar la terminal, aquí están los comandos:

```powershell
# Ruta al gcloud
$gcloud = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$project = "totemic-bonus-479312-c6"

# Ejemplo: Actualizar JWT_SECRET
echo "tu-jwt-secret-super-seguro-aqui" | & $gcloud secrets versions add JWT_SECRET --data-file=- --project=$project

# Ejemplo: Actualizar MONGODB_URI
echo "mongodb+srv://user:password@cluster.mongodb.net/bezhas" | & $gcloud secrets versions add MONGODB_URI --data-file=- --project=$project

# Ejemplo: Actualizar STRIPE_SECRET_KEY
echo "sk_live_xxxxxxxxxx" | & $gcloud secrets versions add STRIPE_SECRET_KEY --data-file=- --project=$project
```

---

## 📝 Instrucciones Específicas por Servicio

### MongoDB Atlas
1. Ir a [MongoDB Atlas](https://cloud.mongodb.com/)
2. Crear un cluster (o usar existente)
3. Database Access → Create User
4. Network Access → Add IP (0.0.0.0/0 para Cloud Run)
5. Clusters → Connect → Connection String
6. Copiar URI y actualizar `MONGODB_URI`

### Stripe
1. Ir a [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copiar **Secret key** (sk_live_xxx o sk_test_xxx)
3. Para webhooks: [Webhooks](https://dashboard.stripe.com/webhooks) → Add endpoint
4. Endpoint URL: `https://tu-backend-url.run.app/api/payments/webhook`
5. Copiar el **Signing secret** (whsec_xxx)

### Google OAuth
1. Ir a [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials?project=totemic-bonus-479312-c6)
2. Create Credentials → OAuth 2.0 Client IDs
3. Application type: Web application
4. Authorized JavaScript origins: tu URL de frontend
5. Authorized redirect URIs: `https://tu-backend-url.run.app/api/auth/google/callback`
6. Copiar Client ID y Client Secret

### GitHub OAuth
1. Ir a [GitHub Developer Settings](https://github.com/settings/developers)
2. OAuth Apps → New OAuth App
3. Authorization callback URL: `https://tu-backend-url.run.app/api/auth/github/callback`
4. Copiar Client ID y Generate Client Secret

### Alchemy (Polygon RPC)
1. Ir a [Alchemy Dashboard](https://dashboard.alchemy.com/)
2. Create App → Select Polygon
3. View Key → Copy HTTPS URL
4. Formato: `https://polygon-mainnet.g.alchemy.com/v2/tu-api-key`

### Pinata (IPFS)
1. Ir a [Pinata](https://app.pinata.cloud/developers/api-keys)
2. New Key → Enable all permissions
3. Copiar API Key y API Secret

### MetaMask (Relayer Private Key)
1. Abrir MetaMask
2. Account → Account details → Show private key
3. Confirmar con contraseña
4. ⚠️ **NUNCA compartir esta clave**

---

## 🚀 Desplegar Después de Configurar Secretos

Una vez actualizados todos los secretos con valores reales:

```powershell
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3"

# Desplegar con Cloud Build
& "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" builds submit --config=cloudbuild.yaml --project=totemic-bonus-479312-c6
```

---

## 🔒 Seguridad

- ✅ Los secretos se inyectan en Cloud Run como variables de entorno en runtime
- ✅ Nunca se guardan en código o imágenes Docker
- ✅ Solo Cloud Build y Cloud Run tienen acceso
- ⚠️ Rota las claves comprometidas inmediatamente
- ⚠️ Usa `sk_test_` de Stripe para desarrollo

---

## 📊 Verificar Configuración

```powershell
# Listar todos los secretos
& "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" secrets list --project=totemic-bonus-479312-c6

# Ver versiones de un secreto
& "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" secrets versions list JWT_SECRET --project=totemic-bonus-479312-c6
```

---

*Última actualización: 4 de Febrero 2026*
