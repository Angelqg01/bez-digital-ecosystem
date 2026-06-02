# Guía de Despliegue en GCP (Google Cloud Platform) para BeZhas Blockchain

Este documento define la estructura y arquitectura oficial para migrar el monorepo de BeZhas desde un entorno local (`docker-compose.yml`) hacia un entorno de producción de nivel empresarial (Cloud-Native) en GCP, garantizando alta disponibilidad y optimización extrema de costos.

---

## 1. Lo INNECESARIO (Lo que NO debes subir)

El error más común es intentar hacer un "lift-and-shift" (subir el archivo `docker-compose.yml` completo a una sola máquina virtual grande). En GCP, esto es ineficiente, frágil y muy costoso.

❌ **Ollama (Modelos Locales LLaMA/Mistral)**
* **Por qué NO:** Correr modelos de lenguaje en local dentro de GCP requiere aprovisionar máquinas virtuales (Compute Engine o GKE) con **GPUs dedicadas** (ej. Nvidia L4, T4, A100). Mantener una GPU encendida 24/7 cuesta entre $300 y $2,000 USD mensuales por máquina.
* **La Solución:** BeZhas ya implementa un `ModelRouter.js`. En la nube, OpenClaw se conecta mediante API (pagando solo por tokens consumidos) a modelos como Gemini (Vertex AI), DeepSeek, Claude o GPT-4o. Es infinitamente más barato.

❌ **Contenedores de Bases de Datos Locales (`postgres` y `redis`)**
* **Por qué NO:** Subir bases de datos en contenedores Docker a la nube significa que tú debes gestionar los backups, la replicación, la corrupción de discos y el autoescalado.
* **La Solución:** Usar los equivalentes administrados de Google (Cloud SQL y Memorystore).

❌ **Archivo `.env`**
* **Por qué NO:** En un entorno distribuido, inyectar el archivo `.env` manual es un riesgo de seguridad.
* **La Solución:** Google Cloud Secret Manager.

---

## 2. Lo NECESARIO (La Arquitectura Ideal)

El script oficial del proyecto (`scripts/gcp-deploy.sh`) ya automatiza la creación de esta arquitectura utilizando servicios "Serverless" (sin servidor), donde solo pagas por milisegundos de ejecución real.

### Capa 1: Gestión de Secretos y Configuración
* **GCP Secret Manager:** Almacena de forma segura `JWT_SECRET`, las llaves privadas (Deployer, Batcher, Edge Node) y los API Keys (Gemini, DeepSeek, Pinata).

### Capa 2: Bases de Datos Administradas (PaaS)
* **Cloud SQL para PostgreSQL (v15+):** Reemplaza el contenedor local de Postgres. Alojará la base de datos `bezhas_control`. Alta disponibilidad, backups automáticos y fácil conexión nativa desde Cloud Run.
* **Memorystore for Redis (v7):** Reemplaza el contenedor de Redis. Crucial para la caché rápida, el Rate Limiting de AEGIS Security y la memoria a corto plazo de los agentes (STM).

### Capa 3: Contenedores Sin Estado (Cloud Run)
Se toman las carpetas del monorepo, se compilan en imágenes de **Artifact Registry** y se despliegan en **Google Cloud Run** (escala a 0 si no hay tráfico, soporta picos masivos de forma automática).
* **`bezhas-api`** (Backend Express Node.js - Puerto 3001)
* **`bezhas-aegis`** (Brain AI FastAPI Python - Puerto 8001)
* **`bezhas-ai-gateway`** (MCP Server / AI tools en Node.js - Puerto 3002)
* **`bezhas-agent-runtime`** (OpenClaw Orchestrator / HITL / agentes - Puerto 3099)
* **`bezhas-edge-node`** (Receptor de Webhooks B2B - Puerto 4000)
* **`bezhas-control-center`** (Frontend B2B en Next.js - Puerto 3000)

### Capa 4: Eventos y Almacenamiento
* **Pub/Sub:** Reemplaza el polling local. Captura eventos on-chain y Webhooks, orquestando microservicios o guardando analíticas en BigQuery.
* **Cloud Storage:** Bucket (`gs://bezhas-assets-prod`) para PDFs, imágenes, contratos y recursos estáticos con CDN integrada.

---

## 3. Excepción: Los Nodos Blockchain (OP Stack)

La única parte del sistema que **NO** puede ser "Serverless" es la Capa L2 Soberana (los nodos de la blockchain). Los nodos guardan estado gigantesco de la red, requieren discos SSD extremadamente rápidos y deben procesar transacciones P2P las 24 horas del día.

✅ **Lo necesario para los nodos L2 (`bezhas-geth`, `bezhas-node`, `bezhas-batcher`):**
* **Google Compute Engine (VMs):** 
  * Necesitarás instancias `e2-standard-2` o superiores (Mínimo 2 vCPUs y 4GB+ RAM, ideal 8GB+).
  * Discos Persistentes **SSD (pd-ssd)** de mínimo 500GB (la blockchain crece rápido).
  * Estas máquinas ejecutarán Docker Compose internamente, pero **SOLO** con los servicios de los nodos.

---

## 4. Pasos para el Despliegue en GCP

El proyecto cuenta con un script de Bash preparado para hacer todo el trabajo duro de las capas Web2, AI y Base de datos de forma automática.

### Requisitos Previos:
1. Crear una cuenta y un Proyecto en Google Cloud Platform.
2. Habilitar la facturación (Billing) en tu proyecto.
3. Instalar la CLI de Google Cloud (`gcloud`) en tu máquina o usar Google Cloud Shell.
4. Autenticarte en terminal: `gcloud auth login`
5. Usar **pnpm** como gestor único de paquetes. No usar `npm install`, `npm ci` ni `package-lock.json` para los servicios que se despliegan en Cloud Run.
6. Preparar `.env` desde `.env.example` y completar al menos `ADMIN_PASSWORD_HASH`. El script generará `JWT_SECRET`, `INTERNAL_API_KEY`, `EDGE_NODE_API_KEY` y `CONTROL_JWT` si no existen.
7. Si el Edge Node va a firmar transacciones directamente, definir `DEPLOY_EDGE_SIGNER=true`, `EDGE_NODE_PRIVATE_KEY` y `ESCROW_CONTRACT_ADDRESS`.

### Ejecución del Despliegue Automatizado:

```bash
# 1. Abre tu terminal en la raíz del proyecto BeZhas
cd /d/BeZhas-Blockchain

# 2. Otorga permisos de ejecución al script
chmod +x scripts/gcp-deploy.sh

# 3. Ejecuta el script declarando tu ID de Proyecto y la Región que prefieras
GCP_PROJECT_ID="tu-id-de-proyecto-gcp" GCP_REGION="us-central1" ./scripts/gcp-deploy.sh
```

Variables útiles:
```bash
PUBLIC_SITE_URL="https://bez.digital"
APP_SITE_URL="https://app.bez.digital"
GCS_BUCKET="bezhas-assets-prod"
RUN_DB_MIGRATIONS="true"
```

### ¿Qué hará el script exactamente?
1. Habilitará todas las APIs necesarias en tu cuenta de GCP (Cloud Run, Cloud SQL, Secret Manager, etc).
2. Creará el repositorio Docker en Artifact Registry.
3. Creará y provisionará Cloud SQL y Memorystore (te arrojará la URL para conectar).
4. Creará red VPC y conector Serverless VPC para que Cloud Run acceda a Memorystore por red privada.
5. Extraerá variables locales desde `.env`, subirá secretos reales a Secret Manager y rechazará placeholders críticos.
6. Compilará con Docker usando `pnpm` en los servicios Node.js y subirá las imágenes.
7. Creará y ejecutará el Cloud Run Job `bezhas-db-migrate` para aplicar `api/db/migrate.js` en Cloud SQL.
8. Desplegará servicios públicos (`api`, `edge-node`, `control-center`) y privados (`aegis`, `ai-gateway`, `agent-runtime`) en Cloud Run.

---
> [!NOTE] 
> **Resumen del Flujo de Tráfico B2B:** 
> El ERP del cliente manda el dato a la **URL de Edge Node en Cloud Run** → Pasa a **AEGIS en Cloud Run** para validación AI → Se ejecuta en el Contrato Inteligente vía RPC hacia el **Nodo Geth (VM Dedicada)** → Genera evento en **Pub/Sub** → Se refleja en la pantalla del usuario desde la URL pública de **Control Center (Next.js en Cloud Run)**.
