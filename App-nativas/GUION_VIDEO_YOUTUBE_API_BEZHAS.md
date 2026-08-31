# 🎬 Guion de vídeo YouTube — La API de BeZhas

> **Formato:** explainer para YouTube · **Duración objetivo:** ~7 min · **Tono:** claro, cercano, técnico-comercial (founder → CEO/CTO)
> **Estética:** reutilizar el look del recorrido animado existente (`@bezhas/guided-tour` / `como-usar.html`) — dark luxury, teal `#00D4AA` · gold `#FFD700` · pink `#FF6B9D`, fuentes Syne (títulos) + Space Mono (código).
>
> **Estructura de leyenda por escena:**
> 🎙️ = narración (voz en off) · 🖥️ = texto/UI en pantalla · 🎬 = b-roll / visual / animación

---

## 🎯 Mapa del vídeo (los 6 focos pedidos)

| # | Bloque | Escenas | Duración aprox. |
|---|--------|---------|-----------------|
| 1 | Facilidad de adopción de la API | 2 | 0:00–1:15 |
| 2 | Cómo se usa (paso a paso, código real) | 3 | 1:15–2:45 |
| 3 | Jerarquía de las API y casos de uso | 4 | 2:45–4:00 |
| 4 | Rentabilidad (caso real simulado) | 5 | 4:00–5:15 |
| 5 | Planes de suscripción | 6 | 5:15–6:05 |
| 6 | SubApps donde se usa la API | 7 | 6:05–6:50 |
| — | Cierre + CTA | 8 | 6:50–7:10 |

---

## ESCENA 1 — Hook (0:00–0:25)

🎙️ *"Tu empresa es una isla. Cada proveedor, cada sucursal, cada repartidor… hablan idiomas distintos. Reconciliar todo eso te cuesta tiempo, dinero y disputas. ¿Y si una sola API conectara todo tu negocio — y encima te generara ingresos?"*

🖥️ Título grande: **"Una API. Todo tu ecosistema."** → debajo, más pequeño: `BeZhas Connect`

🎬 Apertura: islas dispersas en un mapa oscuro → una línea teal las une formando una red (metáfora "isla → puerto común"). Cierra con el logo yin-yang BEZ (teal/pink).

---

## ESCENA 2 — Facilidad de adopción (0:25–1:15)

🎙️ *"Empezar no requiere reescribir nada. La API de BeZhas es agnóstica: cero dependencias, funciona en Node y en el navegador, y se instala como una extensión sobre lo que ya tienes. Sin migrar tu sistema. Sin tocar tu POS. Una clave, y estás dentro."*

🖥️ Tres bullets que aparecen en secuencia:
- ✓ **Cero dependencias** · Node ≥ 18 y navegador
- ✓ **Se integra sobre tu stack** · SAP · Shopify · Salesforce · WordPress
- ✓ **Una API key con scope** · y ya operas

🎬 Terminal escribiendo en vivo (Space Mono):
```bash
pnpm add @bezhas/connect
```
Cursor parpadeante → check verde ✓.

🎙️ (cierre de escena) *"La misma filosofía que una extensión de VSCode: tu app sigue al mando, BeZhas trae el servicio."*

---

## ESCENA 3 — Cómo se usa · paso 1: la clave (1:15–1:45)

🎙️ *"Paso uno: creas tu organización y emites una API key. Puedes acotarla a toda la empresa… o a una sola sede. Esa clave es la que da acceso — y define qué puede hacer cada parte de tu negocio."*

🖥️ Mock del panel "API & Sedes" del Hub: botón **"+ Nueva API key"** → modal con selector de scope (Organización / Sede) → clave generada `bzh_live_general_…` con aviso *"Guárdala: no se volverá a mostrar"*.

🎬 Zoom sobre el scope-selector; resaltar que la clave hereda el scope org/sede.

---

## ESCENA 4 — Cómo se usa · paso 2: la primera llamada (1:45–2:15)

🎙️ *"Paso dos: tu primera integración. Cobrar en BEZ, tarjeta o SEPA es una sola llamada. Y si eres logística, enlazas tu POS una vez y BeZhas absorbe tus pedidos automáticamente."*

🖥️ Código real en pantalla (Space Mono, resaltado de sintaxis):
```js
import { BeZhasConnect } from '@bezhas/connect';
const bezhas = new BeZhasConnect({ apiKey: process.env.BEZHAS_API_KEY });

// Cobro (tarjeta → checkout listo para incrustar)
const order = await bezhas.pay.buy({ amountUSD: 49.9, paymentMethod: 'card', email });

// Logística: enlaza el POS y sincroniza pedidos (idempotente)
const pos = bezhas.cargolink.withRoleKey(process.env.BEZHAS_POS_KEY);
await pos.linkPos({ baseUrl: 'https://shop.example/api', provider: 'shopify' });
const { created } = await pos.syncOrders();
```

🎬 Las líneas se van iluminando conforme el narrador las nombra. Al final, un panel lateral muestra la respuesta JSON (`paymentId`, `checkoutUrl`).

---

## ESCENA 5 — Cómo se usa · paso 3: webhooks firmados (2:15–2:45)

🎙️ *"Paso tres: recibes el estado en tiempo real. Cada evento llega firmado con HMAC — verificable, imposible de falsificar. Tu sistema solo confía en lo que BeZhas ha firmado."*

🖥️ Snippet corto:
```js
const payload = webhooks.verifyAndParse(
  req.body, req.headers['x-bezhas-signature'], process.env.BEZHAS_WEBHOOK_SECRET
); // lanza error si la firma no cuadra
```

🎬 Animación: un webhook entrante con candado 🔒 → sello "firma válida ✓" en teal.

---

## ESCENA 6 — Jerarquía de las API (2:45–3:20)

🎙️ *"Y aquí está lo que nadie más ofrece: la jerarquía. Un holding, un consorcio, una naviera… no gestiona una API. Gestiona un árbol de APIs. La matriz crea claves para cada franquicia, cada flota, cada centro — con permisos y planes que ella misma asigna."*

🖥️ Árbol jerárquico animado, de arriba abajo:
```
        SEUR HOLDING  (Enterprise VIP)
        ┌──────┼──────┐
   Franquicia  Franquicia  Franquicia   (Business)
      │           │           │
  repartidores  flota      centro       (sedes / operadores)
```

🎬 Cada nivel se despliega en cascada. Etiquetas de rol aparecen al lado: `owner · org_admin · site_manager · operator · auditor`.

🎙️ (cierre) *"Cinco roles. La matriz lo ve todo; cada sede, solo lo suyo."*

---

## ESCENA 7 — Jerarquía · qué controla y qué gana la matriz (3:20–4:00)

🎙️ *"¿Qué gana la matriz? Control y dinero. Ve el consumo agregado de cada sede en tiempo real. Impone límites de gasto y de scope a sus subordinados. Mueve tesorería entre niveles. Y — lo mejor — cobra una comisión por cada transacción que sus subordinados validan en la red."*

🖥️ Cuatro tarjetas que entran una a una:
- 📊 **Datos agregados** · consumo, envíos, actividad por sede
- 🛡️ **Políticas** · límite de gasto · scope · geofencing
- 💸 **Tesorería interna** · adelanto ↕ barrido entre niveles
- 🪙 **Comisión en cascada** · % por cada validación de un subordinado

🎬 Endpoint real apareciendo en un tooltip de código:
```http
POST /api/organizations/:orgId/hierarchy/subordinates
POST /api/organizations/:orgId/hierarchy/validations
GET  /api/organizations/:orgId/hierarchy/commissions
```

🎙️ (cierre) *"La comisión no es sobre el valor del envío. Es sobre la comisión de red. Ingreso nuevo, sobre infraestructura que ya tenías."*

---

## ESCENA 8 — Rentabilidad · el caso (4:00–4:45)

> ⚠️ **NOTA DE PRODUCCIÓN (legal):** usar una empresa real por su nombre con cifras de beneficio en un vídeo público implica riesgo de marca. **Recomendado:** anonimizar a *"un operador logístico de ~800 M€"* o mostrar el nombre solo con consentimiento. El on-screen debe rotular siempre **"simulación ilustrativa · cifras estimadas"**.

🎙️ *"Pongámoslo en números. Un operador logístico que factura 800 millones al año, con 85 franquicias. Al liquidar sus transacciones a través de BeZhas, esto es lo que recupera — cada año."*

🖥️ Contador animado subiendo hasta cada cifra:
- Conciliación & auditoría automatizada → **6,8 M€**
- Resolución de litigios (oráculo de disputas) → **5,5 M€**
- Capital circulante liberado → **2,0 M€**
- Tokenización de activos (RWA) → **1,0 M€**
- Gas subvencionado 100% → **0,55 M€**
- Comisión de red de la jerarquía → **1,6 M€**

🎬 Barras horizontales creciendo (reutilizar el widget de la simulación). Rótulo permanente abajo: *"simulación ilustrativa · cifras estimadas"*.

---

## ESCENA 9 — Rentabilidad · el total (4:45–5:15)

🎙️ *"Suma total: más de diecisiete millones de euros de valor al año. ¿El coste del plan que lo desbloquea? Veinticuatro mil. Por cada euro que inviertes en la suscripción, recuperas más de setecientos."*

🖥️ Tarjeta grande, centrada:
```
   VALOR TOTAL / AÑO      17,45 M€
   − Suscripción           0,024 M€
   ─────────────────────────────────
   NETO / AÑO             17,43 M€
   ROI sobre el plan      ~721× 
```

🎬 El "721×" pulsa en gold. Debajo, micro-texto: *"El gasto se convierte en activo."*

---

## ESCENA 10 — Planes de suscripción (5:15–6:05)

🎙️ *"Cuatro planes, para cada tamaño. Empiezas gratis quince días y pagas solo por lo que uses. Y cuanto más subes, más red controlas: la jerarquía se activa en Business, y se despliega a lo grande en Enterprise."*

🖥️ Cuatro columnas (destacar Creator Pro como "POPULAR" y Enterprise como "WHITE LABEL"):

| | **Starter** | **Creator Pro** | **Business** | **Enterprise VIP** |
|---|---|---|---|---|
| Precio | 0 € · pago por uso | 99 €/mes | 499 €/mes | 2.499 €/mes |
| Perfil | Autónomos | Pymes | Empresas | Holdings / Instituciones |
| Jerarquía | — | — | ✓ 5 sub-empresas | ✓ 50 sub-empresas |
| Comisión sub-empresas | — | — | 10 % | 20 % |
| Cascada de niveles | — | — | 1 | 3 |
| Gas subvencionado | 0 % | 25 % | 50 % | 100 % |
| Staking APY | 12,5 % | 18,75 % | 25 % | 31,25 % |
| Extra | 15 días gratis | Smart Escrows | Universal Bridge API | White-Label + API institucional |

🎬 Barrido lateral por las cuatro columnas; los ✓ de jerarquía se encienden en Business y Enterprise. Nota: *"−20 % pagando en \$BEZ"*.

---

## ESCENA 11 — SubApps donde se usa la API (6:05–6:50)

🎙️ *"Y todo esto no es teoría: la API ya vive en trece aplicaciones del ecosistema. Pagos, logística, energía, trazabilidad con IA, finanzas Web3… La misma clave, el mismo SDK, en cada una."*

🖥️ Grid de 13 tarjetas (icono + nombre + una línea):

| SubApp | Para qué |
|--------|----------|
| **BeZhas Hub** | Centro social y marketplace |
| **BEZ Wallet** | Cartera corporativa BEZ |
| **Gas Tank Manager** | Gestión de gas / Paymaster |
| **Edge Node Manager** | Nodos edge de la red |
| **BEZ Vision Scan** | Visión artificial + trazabilidad |
| **BZ Capital / DeFi** | Staking · farming · bridge · DAO |
| **BZ Prestige** | Programa VIP / fidelización |
| **BZ CargoLink** | Logística y aduanas on-chain |
| **BeZhas Pay Manager** | Pagos BEZ / SEPA / tarjeta |
| **BZ PureScan** | IA, sensores IoT y Food Oracle |
| **BZ Sphere** | Comunidad / social |
| **BEZ Energy** | Tokenización energética · CAE · ESG |
| **BZ Genesis** | Onboarding / génesis del ecosistema |

🎬 Las 13 tarjetas entran en cascada (reutilizar el carrusel de la landing). Al final, todas se conectan con líneas teal al icono central de la API.

🎙️ (cierre) *"Una integración. Trece destinos. Y creciendo."*

---

## ESCENA 12 — Cierre + CTA (6:50–7:10)

🎙️ *"BeZhas no te vende software. Te da la llave de un ecosistema de socios ya conectados. Empieza gratis hoy, y convierte tu gasto operativo en un activo que trabaja para ti."*

🖥️ Pantalla final:
- **"Empieza gratis · 15 días"** (botón teal)
- `developers.bez.digital` · `@bezhas/connect`
- Iconos: suscríbete 🔔 · documentación 📄

🎬 Logo BEZ yin-yang cerrando; música sube y corta.

---

## 📋 Notas de producción

- **Voz:** española neutra, ritmo pausado; dejar respiración entre cifras (escenas 8–9).
- **Subtítulos:** quemar subtítulos ES; preparar pista EN para versión internacional (traducir cifras a formato anglosajón: `€17.45M`).
- **Código en pantalla:** usar los snippets **reales** de este repo (`packages/connect/README.md`) — no inventar sintaxis. Space Mono, tema oscuro, resaltado teal.
- **Datos de la simulación:** provienen de `App-nativas/Bezhas-Hub/backend/scripts/simulations/seur-hierarchy-simulation.js`. Si cambian los parámetros, re-renderizar los rótulos de las escenas 8–9.
- **Disclaimer permanente** en escenas 8–9: *"simulación ilustrativa · cifras estimadas · no constituye asesoramiento financiero"*.
- **Legal:** decidir antes de publicar si se nombra a SEUR (requiere consentimiento) o se anonimiza. Por defecto: anonimizar.
- **Reutilización de assets:** el recorrido `como-usar.html` y el paquete `@bezhas/guided-tour` ya tienen la estética y varias de estas animaciones; se pueden capturar en pantalla como b-roll.
- **Miniatura (thumbnail):** árbol jerárquico + "17,43 M€ / año" + logo BEZ. Alto contraste sobre fondo oscuro.
- **Duración flexible:** para un corto de 60 s (YouTube Shorts / Reels), usar solo escenas 1, 6, 9 y 12.
