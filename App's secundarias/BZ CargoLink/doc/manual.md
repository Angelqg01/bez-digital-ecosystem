# BZ CargoLink: Manual de Operaciones Logísticas

**BZ CargoLink** es el motor logístico del ecosistema BeZhas, diseñado para garantizar la integridad de la carga y la eficiencia en el transporte de última milla y larga distancia.

---

### 1. Terminal del Validador (Validator Terminal)
Interfaz móvil para repartidores y operadores de almacén.
*   **Recepción de Carga:** Escaneo del B-UID (BeZhas Unique ID) del pallet o contenedor.
*   **Verificación de Integridad:** Sincronización con sensores de temperatura, humedad e impacto. Si un sensor detecta una anomalía, la "Huella Digital de Carga" se invalida automáticamente en la blockchain.

### 2. Estiba Inteligente (Smart Stowage AR)
Uso de Realidad Aumentada y Visión Artificial para optimizar el espacio.
*   **Cálculo de COG:** El sistema calcula el Centro de Gravedad dinámicamente para evitar vuelcos y maximizar la seguridad del vehículo.
*   **Escaneo SIFT:** Reconocimiento de objetos para asegurar que los productos frágiles se coloquen en la parte superior.

### 3. Sincronización Aduanera (Customs Sync)
*   **Automatización UBL 2.1:** Generación automática de documentos XML para despacho aduanero.
*   **Relé Chainlink:** Los datos de entrega se envían a autoridades portuarias o aduaneras mediante oráculos seguros, permitiendo un "Green Lane" (vía rápida) si todos los parámetros de integridad son correctos.

### 4. Seguridad y Smart Contracts
*   **Liberación de Pago:** Los fondos de transporte se liberan solo cuando el destinatario escanea el código QR de recepción y los sensores confirman que la carga llegó intacta.

---
*Para soporte técnico o integración de APIs, consulte el Portal de Desarrolladores de BeZhas.*
