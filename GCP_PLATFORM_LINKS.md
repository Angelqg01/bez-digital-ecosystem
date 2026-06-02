# BeZhas Blockchain — Enlaces de la Plataforma en GCP

Este archivo contiene el directorio completo de accesos directos, endpoints y sub-aplicaciones que componen el ecosistema BeZhas Blockchain desplegado en producción sobre **Google Cloud Platform**.

---

## 🖥️ Aplicación de Usuario y Paneles

### [Control Center (Panel Principal)](https://bezhas-control-center-371791663100.europe-west1.run.app)
* **URL**: `https://bezhas-control-center-371791663100.europe-west1.run.app`
* **Descripción**: Panel de control principal (Next.js) para la administración de la red, visualización de transacciones, orquestación de agentes, gobernanza, marketplace de NFTs y auditoría DePIN.

---

## ⚙️ Núcleo y Servicios de Red (Backend)

### [API Principal (Rest & WebSocket)](https://bezhas-api-o5xep6gbwq-ew.a.run.app)
* **URL**: `https://bezhas-api-o5xep6gbwq-ew.a.run.app`
* **Endpoints Clave**:
  * [Salud de la Plataforma](https://bezhas-api-o5xep6gbwq-ew.a.run.app/api/health): `/api/health` (Estado de PostgreSQL y Redis en tiempo real)
  * [Métricas de Rendimiento](https://bezhas-api-o5xep6gbwq-ew.a.run.app/api/metrics): `/api/metrics` (Métricas de Prometheus para Grafana)
* **Descripción**: Motor REST y WebSocket que orquesta la persistencia en base de datos, lógica de negocio de DeFi, RWA (CAE de energía) y el gateway API para clientes empresariales.

### [Aegis Security Engine](https://bezhas-aegis-o5xep6gbwq-ew.a.run.app)
* **URL**: `https://bezhas-aegis-o5xep6gbwq-ew.a.run.app`
* **Descripción**: Motor de Machine Learning (FastAPI) encargado del análisis de anomalías en transacciones, auditoría automatizada de telemetría física e inyección de datos DePIN.

---

## 🤖 Inteligencia Artificial e Integraciones

### [Agent Runtime](https://bezhas-agent-runtime-371791663100.europe-west1.run.app)
* **URL**: `https://bezhas-agent-runtime-371791663100.europe-west1.run.app`
* **Descripción**: Entorno de ejecución serverless optimizado e in-memory para la ejecución y coordinación paralela de agentes inteligentes (Security, Tokenomics, Compliance, Trading).

### [AI Gateway (Servidor MCP)](https://bezhas-ai-gateway-o5xep6gbwq-ew.a.run.app)
* **URL**: `https://bezhas-ai-gateway-o5xep6gbwq-ew.a.run.app`
* **Descripción**: Servidor unificado del Modelo Context Protocol (MCP) y OpenClaw que interactúa directamente con **Google Cloud Vertex AI (Gemini)** de forma Keyless y segura.

---

## 🌐 Nodos de Infraestructura DePIN

### [Edge Node (Firmador Autónomo)](https://bezhas-edge-node-371791663100.europe-west1.run.app)
* **URL**: `https://bezhas-edge-node-371791663100.europe-west1.run.app`
* **Endpoint de Salud**: [Edge Health](https://bezhas-edge-node-371791663100.europe-west1.run.app/health)
* **Descripción**: Microservicio DePIN que emula e interactúa con sensores de cadena de suministro físicos (temperatura, IoT, logística), realizando firmas criptográficas automáticas y requiriendo confirmación humana en caso de operaciones de alto valor (HITL).

---

> [!NOTE]
> **Configuración Económica**: Todos estos servicios están desplegados sobre **Google Cloud Run** y **Cloud SQL**, configurados para escalar automáticamente a cero instancias cuando no hay tráfico. Esto asegura que la plataforma consuma **$0 USD en costes fijos**, manteniéndose 100% dentro de la capa gratuita (Free Tier) de GCP.
