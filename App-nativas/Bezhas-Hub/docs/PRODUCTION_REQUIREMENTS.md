# 🚀 Requisitos de Producción y Recursos Cloud para BeZhas

Este documento detalla todos los recursos, servicios y configuraciones necesarios para desplegar la plataforma **BeZhas** en un entorno de producción en la nube (Cloud).

---

## 1. Infraestructura Cloud (Recomendado: Google Cloud Platform / AWS)

Para soportar la arquitectura de microservicios, Web3 y tiempo real, se requiere la siguiente infraestructura base:

### A. Computación (Compute)
*   **Frontend (React/Vite):**
    *   **Servicio:** Cloud Run (GCP) o AWS App Runner / S3 + CloudFront.
    *   **Requisitos:** Contenedor Docker optimizado (Nginx sirviendo estáticos).
    *   **Escalado:** Auto-escalado de 1 a N instancias según tráfico.
*   **Backend API (Node.js/Express):**
    *   **Servicio:** Cloud Run (GCP) o AWS Fargate.
    *   **Requisitos:** Node.js v18+, 2GB RAM mínimo por instancia.
    *   **Escalado:** Auto-escalado horizontal.
*   **Chat Server (Socket.IO):**
    *   **Servicio:** Google Kubernetes Engine (GKE) o AWS ECS.
    *   **Requisitos:** Soporte para *Session Affinity* (Sticky Sessions) y WebSockets de larga duración.

### B. Base de Datos (Database)
*   **Principal (NoSQL):**
    *   **Servicio:** MongoDB Atlas (Cluster Dedicado M10+ recomendado).
    *   **Requisitos:** Réplicas (Primary-Secondary-Secondary) para alta disponibilidad.
    *   **Backup:** Snapshots diarios automáticos.
*   **Caché & Pub/Sub (Redis):**
    *   **Servicio:** Google Cloud Memorystore o AWS ElastiCache.
    *   **Uso:** Gestión de sesiones Socket.IO, Rate Limiting, Colas de trabajos (BullMQ).
    *   **Versión:** Redis 6.x+.

### C. Almacenamiento (Storage)
*   **Archivos Estáticos (Media):**
    *   **Servicio:** Google Cloud Storage o AWS S3.
    *   **Uso:** Avatares de usuarios, imágenes de posts (Web2).
*   **Almacenamiento Descentralizado (Web3):**
    *   **Servicio:** IPFS (vía Pinata o Infura).
    *   **Uso:** Metadatos de NFTs, imágenes de NFTs.

---

## 2. Servicios Externos y APIs (Third-Party)

Estas cuentas y claves son obligatorias para que todas las funciones operen correctamente.

### 🔗 Blockchain & Web3
| Servicio | Propósito | Plan Recomendado |
| :--- | :--- | :--- |
| **Alchemy / Infura** | RPC Node para conectar con Polygon (Mainnet/Amoy). | Growth (para Websockets estables). |
| **WalletConnect** | Conexión de wallets (Project ID). | Cloud (Free Tier suficiente al inicio). |
| **Pinata** | Subida de archivos a IPFS para NFTs. | Picnic (Pago por uso). |
| **Etherscan / PolygonScan** | Verificación de contratos y APIs de gas. | Free API Key. |

### 🧠 Inteligencia Artificial (AI)
| Servicio | Propósito | Plan Recomendado |
| :--- | :--- | :--- |
| **OpenAI API** | Chatbot inteligente, moderación de contenido. | Pay-as-you-go (Tier 1 mínimo). |
| **Google Gemini API** | Análisis de imágenes y texto alternativo. | Pay-as-you-go. |
| **Anthropic (Opcional)** | Modelos alternativos para el chat. | Pay-as-you-go. |

### 💳 Pagos y Fiat On-Ramp
| Servicio | Propósito | Requisito |
| :--- | :--- | :--- |
| **Stripe** | Suscripciones VIP, compra de créditos con tarjeta. | Cuenta verificada (KYC). |
| **MoonPay / Transak** | Compra directa de cripto (Fiat-to-Crypto). | Cuenta de desarrollador aprobada. |

---

## 3. Variables de Entorno Críticas

Antes del despliegue, asegúrate de tener estas variables configuradas en tu gestor de secretos (Google Secret Manager / AWS Secrets Manager).

### Backend (`.env`)
```bash
# Infraestructura
NODE_ENV=production
PORT=3001
DATABASE_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/bezhas_prod
REDIS_URL=redis://:<pass>@redis-instance:6379

# Seguridad
JWT_SECRET=<secreto_largo_y_seguro>
ADMIN_SECRET_KEY=<clave_para_acciones_admin>

# Blockchain
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/<KEY>
PRIVATE_KEY_ADMIN=<wallet_privada_para_transacciones_del_sistema>

# APIs Externas
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
PINATA_API_KEY=...
PINATA_SECRET_KEY=...
```

### Frontend (`.env`)
```bash
VITE_API_URL=https://api.bezhas.com
VITE_PROJECT_ID=<WalletConnect_Project_ID>
VITE_STRIPE_PUBLIC_KEY=pk_live_...
```

---

## 4. Requisitos de Seguridad (Producción)

1.  **Certificados SSL/TLS:** Obligatorio para todas las conexiones (HTTPS y WSS). Gestionado automáticamente por Cloud Run / Load Balancer.
2.  **WAF (Web Application Firewall):** Configurar reglas para bloquear ataques comunes (SQLi, XSS) y limitar la tasa de peticiones (Rate Limiting) a nivel de red.
3.  **Dominios:**
    *   `bezhas.com` (Frontend)
    *   `api.bezhas.com` (Backend)
    *   `ws.bezhas.com` (Chat Server - opcional si se usa path routing)

---

## 5. Estimación de Costos Iniciales (Mensual)

*Estimación para ~1,000 usuarios activos diarios (DAU).*

*   **Compute (Cloud Run + GKE):** ~$50 - $100 USD
*   **Database (MongoDB Atlas):** ~$60 USD (M10 Cluster)
*   **Redis (Managed):** ~$40 USD
*   **RPC Nodes (Alchemy):** ~$49 USD (Growth Plan)
*   **AI APIs:** Variable (según uso, est. $20-$50 USD)
*   **Total Estimado:** **~$220 - $300 USD / mes**

> **Nota:** Para fases de prueba (Testnet), el costo puede reducirse drásticamente usando capas gratuitas (Free Tier) de todos los servicios.
