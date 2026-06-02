# Guía de Cumplimiento y Aplicación: Google Cloud Web3 Startup Program
## Plataforma BeZhas Blockchain — Arquitectura de Producción en GCP

Esta guía detalla los requisitos, la correspondencia arquitectónica y el procedimiento de solicitud para que **BeZhas Blockchain** aplique exitosamente al **Google Cloud for Startups Web3 Program**, específicamente apuntando al **Nivel Scale (hasta $200,000 USD en créditos)**.

---

## 1. Niveles del Programa y Elegibilidad

Google Cloud ofrece dos niveles de financiamiento en créditos para proyectos Web3 y de Inteligencia Artificial:

### Nivel 1: "Start" (Hasta $2,000 USD en Créditos)
*   **Destinatarios**: Proyectos Web3 en fases muy tempranas (pre-seed, pre-grant, bootstrapped).
*   **Requisitos**:
    *   No haber recibido financiación institucional.
    *   Haber sido fundado en los últimos 5 años.
    *   Contar con un dominio de correo corporativo activo y un sitio web funcional.

### Nivel 2: "Scale" (Hasta $200,000 USD en Créditos) — **Nivel Objetivo para BeZhas**
*   **Financiamiento**:
    *   **Año 1**: 100% de descuento en consumos de GCP hasta **$100,000 USD**.
    *   **Año 2**: 20% de descuento adicional en consumos de GCP hasta **$100,000 USD**.
    *   **Soporte Técnico**: **$12,000 USD** en créditos para Asistencia Técnica Mejorada (*Enhanced Support*).
    *   **SaaS**: 12 meses gratuitos de Google Workspace Business Plus.
*   **Requisitos**:
    *   Haber recibido financiación de capital (equity o rondas de tokens) desde pre-seed hasta Serie A de inversores institucionales, **O** haber recibido una subvención oficial (*grant*) de una fundación de blockchain (ej. Polygon Foundation, BNB Chain Developer Grants, Celo, Solana, NEAR, etc.).
    *   Haber sido fundada en los últimos 10 años.
    *   No haber recibido previamente más de $5,000 USD en créditos de Google Cloud.

---

## 2. Mapa de Cumplimiento Técnico de BeZhas en GCP

Los ingenieros y revisores de Google Cloud evalúan si el proyecto está realmente diseñado para aprovechar los servicios gestionados y el ecosistema nativo de GCP. La arquitectura de BeZhas implementada en `infrastructure/gcp/main.tf` y automatizada con `scripts/gcp-deploy.sh` cumple perfectamente con los estándares de evaluación más exigentes de Google:

| Servicio GCP Implementado | Función en BeZhas | Criterio de Aprobación del Web3 Program |
| :--- | :--- | :--- |
| **Google Cloud Blockchain RPC** | Provee la conexión JSON-RPC de baja latencia a BNB Chain / Polygon. | **Uso Web3 Nativo**: Se aprovecha el nuevo servicio de RPC de Google Cloud para eliminar dependencias de terceros y optimizar el tiempo de respuesta. |
| **Vertex AI (Gemini)** | Ejecuta el motor serverless de inteligencia artificial y orquestación OpenClaw. | **Eficiencia en Inteligencia Artificial**: Sustituye la costosa infraestructura local de Ollama (con GPUs dedicadas H100/A100) por llamadas seguras y escalables mediante IAM de GCP a Vertex AI. |
| **Cloud KMS (HSM-backed)** | Custodia institucional no custodial de llaves y firmas de transacciones. | **Seguridad Avanzada**: Las llaves de firma de BeZhas se almacenan en módulos criptográficos de hardware (HSM) dedicados en GCP con cumplimiento FIPS 140-2 Nivel 3. |
| **BigQuery Event Analytics** | Ingesta de telemetria y eventos on-chain mediante streaming. | **Trazabilidad y Big Data**: Conexión nativa Pub/Sub a BigQuery para analítica avanzada de transacciones Web3 sin intermediarios de base de datos. |
| **Secret Manager & VPC Private Ranges** | Almacenamiento seguro de secretos de la app y red privada VPC. | **Ciberseguridad y CISO Compliance**: Ninguna API key o secreto se expone en variables del sistema; las bases de datos y la caché Redis carecen de IP públicas. |

---

## 3. Plantillas de Respuestas Recomendadas para la Solicitud

Al completar el formulario en la web de [Google for Startups Cloud Program](https://cloud.google.com/startup), se te solicitará describir el stack tecnológico de tu startup y su integración con GCP y Web3. Utiliza las siguientes plantillas optimizadas para maximizar la puntuación del evaluador:

### Pregunta: Describa el producto o servicio que está desarrollando su Startup
> **Respuesta Recomendada**:  
> BeZhas es una plataforma híbrida Web2.5 para empresas que automatiza flujos operativos y de auditoría empresarial conectando sistemas tradicionales ERP con tecnologías Web3 y capas de ejecución blockchain L2. BeZhas cuenta con una red de nodos DePIN (Decentralized Physical Infrastructure) denominados Edge Nodes, un motor de agentes inteligentes con orquestación autónoma (OpenClaw), y un framework predictivo de análisis de riesgos y anomalías (Aegis). El sistema permite transacciones institucionales seguras y autogestionadas con patrocinio inteligente de gas corporativo (Paymaster), smart wallets con Abstracción de Cuentas (ERC-4337) y multisig M-of-N.

### Pregunta: ¿Cómo utiliza o planea utilizar Google Cloud en su arquitectura tecnológica?
> **Respuesta Recomendada**:  
> Hemos diseñado BeZhas para ser 100% nativa y serverless dentro de Google Cloud Platform (GCP). Nuestra arquitectura se despliega mediante Terraform e incluye:
> 1. **Cloud Run**: Microservicios dockerizados altamente escalables y privados (API backend, Aegis ML engine, Agent Runtime y Edge Gateway).
> 2. **Vertex AI (Gemini API)**: Nuestro motor agentico OpenClaw realiza llamadas clave a los modelos Gemini 1.5 en Vertex AI, asegurando respuestas con baja latencia y reduciendo drásticamente los costos operativos asociados con GPUs dedicadas.
> 3. **Cloud KMS (HSM Protection)**: Custodiamos de forma no custodial las llaves institucionales de firmas y transacciones de smart wallets utilizando llaves asimétricas con nivel de protección física de hardware (HSM) FIPS 140-2 Nivel 3.
> 4. **BigQuery**: Transmitimos en tiempo real los registros y telemetría de eventos de contratos inteligentes de la red de nodos a través de Pub/Sub directo a BigQuery, facilitando análisis avanzados de rendimiento on-chain combinados con los conjuntos de datos públicos de Web3 disponibles en BigQuery.
> 5. **VPC Privada y Memorystore/Cloud SQL**: Conectividad 100% aislada de internet mediante VPC Connector para base de datos PostgreSQL y caché Redis en memoria.

### Pregunta: ¿Qué redes de blockchain o servicios Web3 gestiona su aplicación?
> **Respuesta Recomendada**:  
> Operamos sobre redes EVM (principalmente BNB Chain y Polygon L2). Nos conectamos a la red blockchain utilizando **Google Cloud Blockchain RPC**, aprovechando la alta disponibilidad y redundancia del servicio gestionado de Google. Adicionalmente, estamos diseñando la integración de **Google Cloud Blockchain Node Engine** para alojar nuestros propios validadores dedicados, asegurando que BeZhas mantenga una infraestructura de nodo soberana y descentralizada 100% dentro del entorno cloud de Google.

---

## 4. Checklist para Iniciar el Proceso de Solicitud

1.  **Crear un Proyecto Nuevo en GCP**:
    *   Nombre recomendado del proyecto: `bezhas-production` o `bezhas-prod`.
2.  **Activar la Facturación**:
    *   Vincula una tarjeta de crédito o cuenta bancaria corporativa válida al proyecto de GCP en la consola de facturación (*Billing*).
3.  **Configurar Correo y Dominio Corporativo**:
    *   La solicitud debe realizarse con un correo del dominio oficial (ej. `founder@bez.digital`). No utilices correos personales (`@gmail.com`).
4.  **Tener a Mano Evidencia de Financiación o Grant**:
    *   Si aplicas al nivel Scale, ten listo el documento de la ronda de inversión o la carta oficial de adjudicación del grant (por ejemplo, el contrato/comunicación del grant de Polygon o BNB Chain).
5.  **Completar la Solicitud**:
    *   Dirígete a [https://cloud.google.com/startup/web3](https://cloud.google.com/startup/web3) y haz clic en **Solicitar** (*Apply Now*).
    *   Copia las respuestas del punto 3 de esta guía en los campos de texto correspondientes.

---

## 5. Próximos Pasos tras la Aprobación de los Créditos

Una vez que Google Cloud apruebe tu solicitud (el proceso suele tardar de 3 a 7 días hábiles):
1.  Los créditos se cargarán automáticamente a tu ID de facturación asignado.
2.  Ejecuta el script de despliegue en un solo paso desde tu terminal:
    ```bash
    chmod +x scripts/gcp-deploy.sh
    GCP_PROJECT_ID=bezhas-prod GCP_REGION=europe-west1 ./scripts/gcp-deploy.sh
    ```
3.  Terraform y gcloud CLI aprovisionarán la infraestructura completa en minutos, y los créditos cubrirán el 100% de tus costos de Cloud Run, Vertex AI, Cloud SQL, Memorystore, KMS, BigQuery y Blockchain RPC.
