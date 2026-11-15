---
estado: vigente
dominio: api
---

# Catálogo de herramientas MCP

> **Generado** por `api/scripts/generar-catalogo-mcp.js`. No editar a mano: un test falla si no
> coincide con el código. Detalle, ejemplos y precios en `docs/BEZHAS_MCP_GUIA_INTEGRACION.md`.

Son **38** herramientas en dos catálogos separados a propósito
(ver la cabecera de `api/config/mcp-onboarding-tools.js`): un control de acceso con excepciones es cómo
se sirve por error una herramienta de cliente a un desconocido.

## Cliente (`config/mcp-tools.js`, 28) — api-key, sin firmar nada

| Herramienta | Scope | Plan mínimo | Qué hace |
|---|---|---|---|
| `bezhas_bez_swap_prepare` | `contracts` | creator_pro | Devuelve las dos transacciones sin firmar (autorizar y cambiar) para comprar o vender BEZ en el pool del DEX, con un mínimo a recibir según el deslizamiento. |
| `bezhas_bez_swap_quote` | `contracts` | creator_pro | Cuánto recibirías al comprar BEZ (pagando con la moneda de cotización, USDC por defecto) o al vender BEZ en el pool del DEX configurado. |
| `bezhas_checkout_prepare` | `wallet` | creator_pro | Abre una orden de cobro de BEZ-Pay y devuelve el enlace de checkout para que el cliente pague con tarjeta, transferencia SEPA o BEZ on-chain; los BEZ se entregan en la wallet de destino. |
| `bezhas_checkout_status` | `wallet` | creator_pro | Estado de una orden de cobro de BEZ-Pay abierta por esta misma api-key: pendiente, pagada, liquidada, caducada o reembolsada. |
| `bezhas_contracts_list` | `contracts` | creator_pro | Contratos desplegados con su dirección por cadena. |
| `bezhas_cost_estimate` | `wallet` | starter | Calcula cuánto cuesta un conjunto de operaciones antes de hacerlas: llamadas a la API, acciones de IA, consultas al oráculo, envíos on-chain, webhooks, tareas de OPERANT o la comisión de una compra de BEZ-Coin. |
| `bezhas_dex_pool` | `token` | creator_pro | Reservas y liquidez del pool BEZ. |
| `bezhas_dex_quote` | `token` | creator_pro | Cotiza un intercambio en el DEX. |
| `bezhas_erp_connections` | `contracts` | business | Conexiones con el ERP de la empresa (SAP S/4HANA, SAP Business One, Odoo, Dynamics, NetSuite) de esta api-key: sistema, estado y qué documentos se pueden leer. |
| `bezhas_erp_document` | `contracts` | business | Un documento concreto del ERP conectado (factura, pedido, albarán, activo o asiento). |
| `bezhas_erp_documents` | `contracts` | business | Lista facturas, pedidos, albaranes, activos o asientos del ERP conectado, con filtros acotados. |
| `bezhas_knowledge_search` | `token` | starter | Busca en la documentación pública de BeZhas (planes, precios, BEZ-Coin, MCP, API, tokenización, ERP, cobros, seguridad) y devuelve los fragmentos más relevantes con su documento, versión y relevancia. |
| `bezhas_network_stats` | `contracts` | starter | Altura de bloque, id de cadena y precio del gas de la L2 de BeZhas. |
| `bezhas_oracle_prices` | `token` | creator_pro | Mercados del par BEZ por cadena, con pool, precio y liquidez. |
| `bezhas_rwa_asset` | `contracts` | creator_pro | Datos públicos de un activo del RWAFactory de BeZhas en Polygon: nombre, categoría, fracciones, valoración, precio por fracción, rendimiento declarado, documentación (CID) y si exige KYC para comprar. |
| `bezhas_rwa_rent_claim_prepare` | `contracts` | creator_pro | Para un titular de fracciones: recalcula el reparto desde Polygon, comprueba que coincide con la raíz publicada y devuelve la transacción sin firmar que cobra su parte. |
| `bezhas_rwa_rent_distribute_prepare` | `contracts` | creator_pro | Para el creador de un activo: calcula desde Polygon quién tenía fracciones en el bloque de corte y devuelve las dos transacciones sin firmar que depositan las rentas (BEZ o USDC) y publican la raíz con la que cobrarán los titulares, más el justificante con la lista completa. |
| `bezhas_rwa_rent_distribution` | `contracts` | creator_pro | Datos públicos de un reparto de rentas de un activo RWA: token, importe, cuánto queda sin reclamar, bloque de corte, plazo y justificante (CID). |
| `bezhas_rwa_rent_distributions` | `contracts` | creator_pro | Los repartos de rentas de un activo RWA, del más reciente al más antiguo (hasta 50), con el mismo detalle público que bezhas_rwa_rent_distribution. |
| `bezhas_rwa_sale_buy_prepare` | `contracts` | creator_pro | Devuelve las dos transacciones sin firmar para comprar fracciones de una oferta de venta primaria pagando en BEZ: el BEZ va al emisor y las fracciones a la wallet compradora en la misma transacción. |
| `bezhas_rwa_sale_list_prepare` | `contracts` | creator_pro | Para el creador de un activo: devuelve las dos transacciones sin firmar que abren su venta primaria en BEZ (autorizar al contrato de venta y publicar la oferta). |
| `bezhas_rwa_sale_listing` | `contracts` | creator_pro | Estado de una oferta de venta primaria de fracciones: activo, precio en BEZ, fracciones disponibles y si sigue abierta. |
| `bezhas_subscription` | `wallet` | starter | Plan contratado, módulos activos, y qué incluye ese plan: nivel de razonamiento, frescura del dato de mercado, límites y régimen de privacidad. |
| `bezhas_token_info` | `token` | starter | Datos del token BEZ-Coin: símbolo, decimales, suministro y direcciones de contrato por red. |
| `bezhas_token_price` | `token` | starter | Precio actual de BEZ y su origen. |
| `bezhas_tokenize_prepare` | `contracts` | creator_pro | Prepara la tokenización de un activo real (inmueble, hotel, local, vehículo, barco, aeronave, objeto) en fracciones, con un contrato RWAFactory de BeZhas en Polygon: «activos» para el registro general y «industrial» para clientes de Factory industrial (plantas, maquinaria, lotes). |
| `bezhas_tx_prepare` | `wallet` | creator_pro | Prepara un pago o transferencia (cripto→cripto, FIAT→cripto, cripto→FIAT o FIAT→FIAT) y devuelve la decisión de la política, el riesgo, la simulación y cuántas aprobaciones humanas firmadas necesita. |
| `bezhas_tx_status` | `wallet` | creator_pro | Estado de una operación preparada por esta misma api-key: decisión, aprobaciones y ejecución. |

## Alta y despliegue (`config/mcp-onboarding-tools.js`, 10)

| Herramienta | Acceso | Qué hace |
|---|---|---|
| `bezhas_bank_setup_start` | api-key | Abre la pantalla segura para configurar cobros y pagos, precargada con los datos de la empresa. |
| `bezhas_connect_start` | anónimo | Para quien YA es cliente y sólo tiene que identificarse desde una IA nueva. |
| `bezhas_erp_integration_plan` | api-key | Cómo conectar BeZhas con SAP S/4HANA, Business One, Odoo, Dynamics o NetSuite: objetos implicados, campos mínimos y permisos a pedir. |
| `bezhas_intro` | anónimo | Qué hace la plataforma, qué SubApps existen y qué se puede probar sin ser cliente. |
| `bezhas_node_provision_start` | api-key | Abre la pantalla con el token de registro del nodo y devuelve los pasos. |
| `bezhas_node_requirements` | api-key | Qué hace falta para levantar un nodo edge o enterprise de la red BeZhas: máquina, puertos, plan mínimo y tiempo estimado. |
| `bezhas_onboarding_status` | anónimo | Estado de una sesión abierta antes, por su identificador. |
| `bezhas_recommend_plan` | anónimo | Recomienda plan, SubApps y permisos a partir del perfil de la empresa. |
| `bezhas_sdk_install_plan` | api-key | Cómo instalar el SDK de BeZhas: paquete, versión, comando, comprobación de integridad y verificación posterior. |
| `bezhas_signup_start` | anónimo | Crea una sesión de alta y devuelve un enlace a la pantalla segura de BeZhas, ya rellena con lo que sepas del perfil. |
