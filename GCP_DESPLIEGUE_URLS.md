# URL Actualizadas del Despliegue en GCP — BeZhas Blockchain

Este documento contiene los enlaces de producción actualizados de cada componente de la plataforma BeZhas Blockchain desplegada en **Google Cloud Platform (GCP)**.

Todos los servicios han sido verificados con éxito y están activos en la región `europe-west1`:

## 🌐 Enlaces de Acceso y APIs

### 1. Panel de Control de Usuario
* **Servicio**: `bezhas-control-center` (Next.js)
* **URL**: **[https://bezhas-control-center-371791663100.europe-west1.run.app](https://bezhas-control-center-371791663100.europe-west1.run.app)**
* **Estado**: Activo ✅

### 2. API Backend de la Plataforma
* **Servicio**: `bezhas-api` (Express + Postgres + Redis)
* **URL**: **[https://bezhas-api-o5xep6gbwq-ew.a.run.app](https://bezhas-api-o5xep6gbwq-ew.a.run.app)**
* **Endpoint de Salud**: **[https://bezhas-api-o5xep6gbwq-ew.a.run.app/api/health](https://bezhas-api-o5xep6gbwq-ew.a.run.app/api/health)**
* **Estado**: Activo ✅ (Verificado con estado de base de datos y caché "up")

### 3. Motor de Machine Learning y Seguridad
* **Servicio**: `bezhas-aegis` (FastAPI)
* **URL**: **[https://bezhas-aegis-o5xep6gbwq-ew.a.run.app](https://bezhas-aegis-o5xep6gbwq-ew.a.run.app)**
* **Estado**: Activo ✅

### 4. Orquestador de Agentes (Agent Runtime)
* **Servicio**: `bezhas-agent-runtime` (Node.js in-memory engine)
* **URL**: **[https://bezhas-agent-runtime-371791663100.europe-west1.run.app](https://bezhas-agent-runtime-371791663100.europe-west1.run.app)**
* **Estado**: Activo ✅

### 5. Gateway de Inteligencia Artificial (MCP Server)
* **Servicio**: `bezhas-ai-gateway` (MCP / OpenClaw Server)
* **URL**: **[https://bezhas-ai-gateway-o5xep6gbwq-ew.a.run.app](https://bezhas-ai-gateway-o5xep6gbwq-ew.a.run.app)**
* **Estado**: Activo ✅

### 6. Nodo DePIN IoT (Firmador Autónomo)
* **Servicio**: `bezhas-edge-node` (Auto-signer IoT)
* **URL**: **[https://bezhas-edge-node-371791663100.europe-west1.run.app](https://bezhas-edge-node-371791663100.europe-west1.run.app)**
* **Endpoint de Salud**: **[https://bezhas-edge-node-371791663100.europe-west1.run.app/health](https://bezhas-edge-node-371791663100.europe-west1.run.app/health)**
* **Estado**: Activo ✅

---

> [!TIP]
> **Eficiencia Presupuestaria**: Gracias a la eliminación completa del Redis administrado en Cloud Memorystore y a la sustitución por caché in-memory dentro del runtime, el coste mensual de esta arquitectura con bajo tráfico o inactividad se mantiene en **$0 USD**, protegiendo tu presupuesto al operar estrictamente dentro del rango de capa gratuita de GCP.
