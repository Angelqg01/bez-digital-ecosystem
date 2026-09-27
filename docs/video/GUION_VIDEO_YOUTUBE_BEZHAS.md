# 🎬 Guion de vídeo para YouTube: «BeZhas Blockchain: la confianza digital para tu empresa»

> **Fuente:** *Presentación abierta de BeZhas* (PDF, 15 págs.) + pantallas reales de la plataforma (`frontend/src/pages`).
> **Canal:** YouTube · BeZhas BlockConnetion
> **Formato:** 16:9 · 1920×1080 (máster 4K opcional) · 30 fps
> **Duración objetivo:** ~6:30 min
> **Tono:** comercial, cercano y seguro. Se habla de beneficios y no de tecnicismos. Cada concepto técnico va acompañado de una imagen que lo explica.
> **Público:** gerentes de PYMEs, directores de operaciones y logística, autoridades portuarias, instituciones públicas, energía, salud, agroalimentario e industria.
> **Idioma:** español (España). Se recomienda subtitular también en inglés.

---

## 0. Herramientas: qué usar y para qué

| Necesidad | Herramienta recomendada | Motivo |
|---|---|---|
| **B-roll generado por IA** (puertos, contenedores, fábricas, nodos, cadenas de bloques en 3D) | **Higgsfield** (`generate_video`, modelos de cámara cinematográfica) | Crea planos a medida de la marca que no existen en bancos de stock: un contenedor con un chip que brilla, o datos convertidos en bloques. Así se cubren todos los huecos sin imágenes. |
| **B-roll real y de stock** (personas, oficinas, almacenes, barcos) | **Adobe Stock**, a través de Adobe Express o Premiere | Aporta planos humanos y reales con licencia comercial. La IA todavía falla con caras y manos en planos cercanos. |
| **Edición final, rótulos, subtítulos y música** | **Adobe Premiere Pro** o **Adobe Express** (vídeo) | Montaje multipista, *motion graphics* con las plantillas de marca y subtítulos automáticos. |
| **Locución** | Higgsfield `generate_audio` (voz IA) **o** un locutor humano | La voz IA sirve para el animatic y la versión final debería ser humana. Si se usa voz IA, se limpia con Adobe *Enhance Speech*. |
| **Capturas de la plataforma** | Grabación de pantalla (OBS o la grabadora del sistema) en `app.bezhas.com` o en el entorno de *staging* | Muestra el producto real, que es lo que genera confianza en el cliente. |

**Resumen:** Higgsfield se usa para generar los planos conceptuales y de marca, y Adobe para montar, rotular y buscar stock real. Ninguna de las dos herramientas cubre por sí sola el vídeo completo.

### Identidad visual (extraída del PDF)
- **Paleta:** azul noche `#0A1128` de fondo, cian neón `#00E5FF`, verde menta `#2EF2B0` y degradado magenta-violeta del logo `#E0218A → #6A3DE8`, con acentos dorados para los contratos inteligentes.
- **Estilo:** isométrico 3D con luz neón, igual que las infografías de las págs. 5 y 7 del PDF.
- **Tipografía:** sans geométrica en negrita para los titulares (p. ej. *Montserrat ExtraBold* o *Space Grotesk*) y *Inter* para el texto.
- **Logo:** esquina superior derecha con un 60 % de opacidad durante todo el vídeo, y animado en la intro y el cierre.

### ✅ Datos validados por BeZhas (revisión del PDF)
1. **Ortografía:** en todo el material se escribe **«Blockchain»**. La errata «Bolckchain» de la portada del PDF queda corregida y no debe aparecer en ningún rótulo.
2. **Precios:** no hay contradicción. Los **5.000 €** de la pág. 8 son la **inversión mínima de entrada** (capital) por servicio blockchain, y los **2.500 €/mes** son el **máximo de suscripción**. Las suscripciones son los planes de la pág. 10: 0 €, 99 €, 499 € y 2.499 €/mes.
3. **Ahorro:** las etiquetas de la pág. 11 estaban invertidas. El ahorro anual conjunto de las empresas clientes va de un **mínimo de 4.007.200 €** a un **máximo de 72.003.600 €**. Estas cifras se usan en la escena 8. Hay que corregir también el PDF.
4. **Cumplimiento normativo:** en el vídeo se dice que la blockchain está **«diseñada y certificada»** para RGPD y ENS. Conviene tener a mano la referencia del certificado ENS (categoría y entidad certificadora) por si un cliente la pide.
5. **Rutas de la plataforma** (sin cambios): las rutas de la columna «Captura» salen del router del frontend (`frontend/src/App.jsx`). Antes de grabar, hay que verificar que cada pantalla esté completa en *staging* y usar **datos de demostración, nunca datos reales de clientes, claves ni wallets**.

---

## 1. Estructura y tiempos

| # | Sección | Tiempo | Pág. PDF |
|---|---|---|---|
| 1 | Gancho | 0:00 – 0:20 | 2 |
| 2 | El problema: la doble presión sobre la PYME | 0:20 – 0:55 | 2–3 |
| 3 | Qué es BeZhas | 0:55 – 1:40 | 1, 4, 5 |
| 4 | Cómo funciona, en 4 pasos | 1:40 – 2:40 | 4, 7 |
| 5 | Las aplicaciones del ecosistema | 2:40 – 3:55 | 6 |
| 6 | Sectores y casos de uso | 3:55 – 4:50 | 5, 9 |
| 7 | BeZhas frente a otras blockchains | 4:50 – 5:25 | 8 |
| 8 | Planes y precios | 5:25 – 5:55 | 10 |
| 9 | Por qué BeZhas, y cierre con CTA | 5:55 – 6:30 | 14, 15 |

---

## 2. Guion completo por escenas

**Leyenda**
- 🎙️ **VOZ**: texto que se locuta.
- 🖥️ **CAPTURA**: fragmento grabado de la plataforma BeZhas (ruta del frontend).
- 🎥 **B-ROLL**: vídeo de apoyo. **[HF]** indica un *prompt* para Higgsfield y **[AS]** una búsqueda en Adobe Stock.
- 🔤 **RÓTULO**: texto que aparece en pantalla.
- 🎵 **AUDIO**: música o efectos.

---

### ESCENA 1 · GANCHO (0:00 – 0:20)

🎙️ **VOZ:**
> «¿Y si tu próximo gran cliente te pidiera mañana demostrar, con pruebas imposibles de falsificar, de dónde viene tu mercancía, cuándo salió y en qué estado llegó?
> ¿Podrías hacerlo… sin contratar a un equipo de programadores?
> Con BeZhas, sí.»

| Tiempo | Visual |
|---|---|
| 0:00–0:07 | 🎥 **[HF]** Plano aéreo de un puerto al amanecer con grúas cargando contenedores. Se hace zoom a un contenedor y sobre él aparece un sello holográfico cian. |
| 0:07–0:14 | 🎥 **[AS]** `business owner worried documents office` o `warehouse manager tablet checking inventory`: la cara del empresario, preocupado. |
| 0:14–0:20 | Aparece el logo BeZhas con partículas magenta y violeta que forman una cadena de bloques. |

🔤 **RÓTULO:** «Pruebas imposibles de falsificar. Sin programadores.»
🎵 **AUDIO:** pulso electrónico grave y tenso, y un *whoosh* al entrar el logo.

**Prompt Higgsfield (escena 1):**
```
Cinematic aerial drone shot of a modern container port at sunrise, gantry cranes loading
shipping containers onto a cargo ship, slow push-in towards a single blue container,
a glowing cyan holographic verification seal materializes on the container door,
teal and navy color grade, volumetric light, photorealistic, 16:9, 6 seconds
```

---

### ESCENA 2 · EL PROBLEMA: LA DOBLE PRESIÓN SOBRE LA PYME (0:20 – 0:55)

🎙️ **VOZ:**
> «Hoy las PYMEs viven bajo una doble presión.
> Por un lado, la **ley**: la normativa europea y española exige cada vez más que los datos sean digitales, inalterables y ciberseguros.
> Por otro, **sus propios clientes**: las grandes industrias ya piden a sus proveedores trazabilidad y seguridad total.
> Y adaptarse cuesta. Esta fricción puede llegar a consumir **hasta el 25 % del margen operativo**.
> En España, las PYMEs son el 99,8 % del tejido empresarial, casi 3 millones de empresas. Pero **solo el 10 %** ha dado el paso al blockchain.
> ¿Por qué? Costes impredecibles, integraciones complicadas con el ERP y la necesidad de gestionar claves y criptomonedas.»

| Tiempo | Visual |
|---|---|
| 0:20–0:30 | Pantalla dividida con animación 2D al estilo de la pág. 2. A la izquierda, un icono de balanza y documentos legales UE con el rótulo «Presión legal». A la derecha, un camión con el logo de una gran fábrica y el rótulo «Presión corporativa». |
| 0:30–0:38 | Gráfico: un margen del 100 % que se reduce en 25 puntos con una animación roja. |
| 0:38–0:48 | Mapa de España formado por puntos: 2.950.000 puntos grises, de los que solo el 10 % se ilumina en cian. |
| 0:48–0:55 | 🎥 **[AS]** `frustrated employee spreadsheets paperwork` y `complex server cables IT`. Aparecen tres iconos rojos: 💸 coste volátil · 🧩 integración ERP · 🔑 claves cripto. |

🔤 **RÓTULOS:**
- «Hasta el 25 % del margen operativo se pierde en fricción»
- «99,8 % de las empresas son PYMEs · Solo el 10 % usa blockchain»

🎵 **AUDIO:** la tensión se mantiene y suena un *tick* de reloj en el dato del 25 %.

**Prompt Higgsfield (escena 2):**
```
Stylized 3D isometric map of Spain made of thousands of small grey dots on a dark navy
background, camera slowly orbits, only one in ten dots lights up in neon cyan one by one,
futuristic data visualization, clean, minimal, 16:9, 8 seconds
```

---

### ESCENA 3 · QUÉ ES BEZHAS (0:55 – 1:40)

🎙️ **VOZ:**
> «BeZhas es la **blockchain middleware de confianza digital** para la economía azul y la logística global.
> Dicho de forma sencilla: BeZhas se conecta a los sistemas que tu empresa ya usa, como el ERP, los sensores IoT o la web, y convierte cada evento importante en una **prueba digital inmutable**: un envío, una inspección, una lectura de energía o una factura.
> Todo esto ocurre en su propia red, una **Layer 2 soberana basada en OP Stack**, con nodos en Europa.
> Y lo mejor: **tu equipo no necesita saber nada de cripto**. Se trabaja desde un panel web tradicional, se paga en **euros** y no hacen falta billeteras digitales.»

| Tiempo | Visual |
|---|---|
| 0:55–1:05 | Portada del PDF (pág. 1) animada con efecto *parallax* y el titular «La Blockchain Middleware de confianza digital». |
| 1:05–1:20 | Animación basada en la pág. 5: unos engranajes con el rótulo «Procesos tradicionales» se transforman en bloques verificables encadenados con el rótulo «Operaciones on-chain». |
| 1:20–1:32 | 🖥️ **CAPTURA:** `/business-dashboard` (Business Dashboard). Recorrido lento por las tarjetas de métricas: «Así se ve BeZhas: un panel, no una consola de código». |
| 1:32–1:40 | 🖥️ **CAPTURA:** `/bez-pay` (BeZhas Pay). Se muestra el pago en EUR. Aparecen los iconos «€» y «wallet» tachada. |

🔤 **RÓTULOS:**
- «Tu ERP / IoT ➜ BeZhas ➜ Prueba inmutable»
- «Layer 2 soberana · OP Stack · Nodos en la UE»
- «Pagas en euros · Sin wallets · Sin cripto»

🎵 **AUDIO:** la música pasa a un tono esperanzador y ascendente al entrar la solución.

**Prompt Higgsfield (escena 3):**
```
3D isometric animation: silver mechanical gears on the left rotate and emit glowing data
streams that flow to the right and assemble into a chain of translucent cyan glass cubes,
each cube locks with a green checkmark, dark navy background with subtle grid, neon
teal and magenta accents, smooth camera dolly right, 16:9, 8 seconds
```

---

### ESCENA 4 · CÓMO FUNCIONA, EN 4 PASOS (1:40 – 2:40)

🎙️ **VOZ:**
> «¿Cómo funciona? En cuatro pasos.
> **Uno: conectas.** Los datos llegan desde tu ERP, como SAP, Odoo o Salesforce, a través de la API universal, el SDK o incluso un plugin de WordPress. También desde sensores IoT.
> **Dos: se valida.** El **BeZhas Edge Node** recibe los datos, calcula su huella digital única, el *hash*, y los firma.
> **Tres: la IA audita.** Antes de registrar nada, **Aegis AI** revisa que cumpla la normativa y detecta anomalías. Si algo no cuadra, te avisa. Así, a la cadena solo llega información fiable.
> **Cuatro: queda registrado para siempre.** Los contratos inteligentes de BeZhas guardan la prueba en la blockchain. Nadie puede modificarla, ni siquiera nosotros.
> ¿Y el coste de cada transacción? Lo cubre el **Corporate Gas Tank**: un saldo corporativo en euros, recargable y predecible. Es un *gas invisible* que se paga por debajo, sin que tu equipo tenga que pensar en ello.»

| Tiempo | Visual |
|---|---|
| 1:40–1:50 | Diagrama de la pág. 7 animado de izquierda a derecha, con el paso **①** iluminado: «Ingresa datos (ERP/IoT)». Aparecen los logos genéricos de SAP, Odoo y Salesforce como iconos neutros (ver nota legal). |
| 1:50–1:58 | 🖥️ **CAPTURA:** `/developer-console` (Developer Console). Se muestran la API key **enmascarada** y un fragmento de código del SDK. |
| 1:58–2:08 | Paso **②** iluminado: Edge Node. 🎥 **[HF]** Un servidor compacto en un rack con luces cian y datos que se convierten en un *hash* hexadecimal. |
| 2:08–2:20 | Paso **③** iluminado: Aegis AI. 🖥️ **CAPTURA:** `/aegis` (Aegis Dashboard), con la puntuación de riesgo y una alerta de anomalía en rojo que pasa a verde al corregirse. |
| 2:20–2:30 | Paso **④** iluminado: los cubos dorados de los Smart Contracts se apilan. 🖥️ **CAPTURA:** `/compliance` (Compliance), con un registro verificado y su sello. |
| 2:30–2:40 | Animación de un bidón de combustible dorado («Corporate Gas Tank») que se llena con monedas de euro. 🖥️ **CAPTURA:** `/wallet` (Enterprise Wallet), con el saldo corporativo. |

🔤 **RÓTULOS:**
- «① Conecta · ② Valida · ③ Audita con IA · ④ Registra»
- «Aegis AI: compliance y anomalías antes de la blockchain»
- «Gas invisible: saldo corporativo en €»

🎵 **AUDIO:** un *click* suave en cada paso y un *pad* electrónico constante.

**Prompts Higgsfield (escena 4):**
```
Close-up of a sleek compact edge server in a dark rack, cyan status LEDs pulsing,
holographic stream of numbers flows into it and exits as a glowing hexadecimal hash string,
shallow depth of field, cinematic, navy and teal palette, 16:9, 5 seconds
```
```
Futuristic AI brain made of translucent blue circuitry inside a glowing shield icon,
scanning floating documents, one document flashes red then turns green with a checkmark,
dark background, neon cyan and magenta, smooth slow rotation, 16:9, 6 seconds
```
```
Golden translucent cubes labeled with abstract icons stacking into a stable chain,
each cube locks with a soft golden light burst, isometric 3D, dark navy background,
premium look, 16:9, 5 seconds
```

> 🔒 **Seguridad en las capturas:** en la Developer Console **no deben aparecer claves reales**. Hay que usar una cuenta de demostración con claves revocadas o difuminar el campo en Premiere (efecto *Mosaic* con seguimiento).

---

### ESCENA 5 · LAS APLICACIONES DEL ECOSISTEMA (2:40 – 3:55)

🎙️ **VOZ:**
> «Sobre esta red funciona un ecosistema de aplicaciones listas para usar.
>
> **BeZhas Hub** es tu centro de mando: gestionas en un solo lugar las operaciones digitales, financieras y logísticas, con conectores ERP y herramientas Web3, sin conocimientos técnicos.
>
> **BZ CargoLink** es la terminal de validación para la logística, las aduanas y la última milla: cada carga, trazada y optimizada.
>
> **BeZhas Energy** monitoriza el consumo energético con IoT, valida los nodos y rentabiliza los tokens energéticos.
>
> **BZ PureScan** lleva la trazabilidad alimentaria al siguiente nivel: la IA escanea y analiza el producto y genera su **Pasaporte Digital de Producto**, el DPP que exige la Unión Europea.
>
> **BZ Capital** es el brazo financiero: tokeniza activos del mundo real, como inmuebles, maquinaria o mercancía, y los convierte en liquidez.
>
> Y **BeZhas Vision Scan** es el ojo de la red: una IA que valida visualmente contenedores e infraestructuras y conecta el mundo físico con los contratos inteligentes.»

| Tiempo | App | Visual |
|---|---|---|
| 2:40–2:52 | **BeZhas Hub** | 🖥️ **CAPTURA:** `/superpanel` (SuperPanel) y `/business-dashboard`. 🎥 **[AS]** `executive dashboard control room screens`. |
| 2:52–3:04 | **BZ CargoLink** | 🖥️ **CAPTURA:** `/logistics` (Logistics). 🎥 **[AS]** `customs inspection port container` y `last mile delivery van`. |
| 3:04–3:16 | **BeZhas Energy** | 🎥 **[HF]** Paneles solares y aerogeneradores con líneas de datos hacia un nodo. 🖥️ **CAPTURA:** `/dao/energia-smart-cities`. |
| 3:16–3:30 | **BZ PureScan** | 🎥 **[HF]** Un smartphone escanea un pescado fresco o una caja de frutas y aparece una ficha holográfica con el texto «DPP ✓». 🎥 **[AS]** `food quality inspection laboratory`. |
| 3:30–3:42 | **BZ Capital** | 🖥️ **CAPTURA:** `/rwa` (Real World Assets) y `/defi-hub`. 🎥 **[HF]** Un edificio que se transforma en fichas digitales. |
| 3:42–3:55 | **Vision Scan** | 🖥️ **CAPTURA:** `/oracle` (Oracle) o `/ml-dashboard`. 🎥 **[HF]** Una cámara con recuadros de detección de IA sobre contenedores. |

🔤 **RÓTULOS:** nombre de cada app con su icono, y una frase de beneficio debajo:
- Hub: «Todo tu negocio, un solo panel»
- CargoLink: «Cada carga, trazada»
- Energy: «Energía medida, energía rentable»
- PureScan: «Pasaporte Digital de Producto en segundos»
- Capital: «Tus activos, convertidos en liquidez»
- Vision Scan: «La IA que ve y certifica»

🎵 **AUDIO:** ritmo que sube un punto, con una transición *swipe* entre apps.

**Prompts Higgsfield (escena 5):**
```
Solar panel field and wind turbines at golden hour, glowing cyan data lines rise from
each panel and converge into a floating hexagonal node icon in the sky, cinematic
wide shot, slow drone pull-back, 16:9, 6 seconds
```
```
Hand holding a smartphone scanning a fresh fish on ice at a fish market, the phone screen
projects a holographic product passport card with a green verified checkmark and QR code,
realistic, shallow depth of field, cool blue tones, 16:9, 6 seconds
```
```
Modern office building in the city dissolves into hundreds of glowing golden digital
tokens that orbit and reassemble into the building, isometric, dark background,
premium fintech aesthetic, 16:9, 6 seconds
```
```
Security camera view over a container terminal, AI computer-vision bounding boxes
track containers with labels and green confidence scores, one box turns into a
blockchain block icon, HUD overlay, teal palette, 16:9, 6 seconds
```

---

### ESCENA 6 · SECTORES Y CASOS DE USO (3:55 – 4:50)

🎙️ **VOZ:**
> «BeZhas nace en la **economía azul**: puertos, sector marítimo-pesquero, acuicultura y trazabilidad de la carga en origen. Pero su tecnología resuelve problemas reales en muchos sectores.
>
> En **logística y supply chain**, adiós a los proveedores sin auditoría: checkpoints, IoT y registros de inventario verificables.
> En **salud**, los datos médicos fragmentados se unifican con credenciales seguras y trazabilidad farmacéutica.
> En **energía**, la sostenibilidad ESG por fin se puede verificar: créditos de carbono tokenizados y mercados de energía entre particulares.
> En **gobierno**, identidad digital ciudadana y presupuestos públicos transparentes.
> En **seguros**, ajustes automáticos y pagos rápidos con pólizas paramétricas.
> En **legal**, contratos que se ejecutan solos y evidencias custodiadas.
>
> Y más: automoción, manufactura, agricultura, educación, inmobiliario, entretenimiento y servicios.»

| Tiempo | Visual |
|---|---|
| 3:55–4:08 | 🎥 **[HF]** Barco pesquero al amanecer, granja de acuicultura y puerto. 🎥 **[AS]** `fishing boat harbor sunrise` y `aquaculture fish farm aerial`. |
| 4:08–4:40 | Rueda de sectores animada al estilo de la pág. 5. Cada sector se ilumina con su tarjeta roja «Problema» que pasa a verde «Solución», con los nombres de los contratos (*SupplyTracker*, *HealthRecordSBT*, *CarbonCreditToken*, *CitizenIdentitySBT*, *PolicyNFT*, *SmartLegalContract*). En paralelo se insertan 1–2 s de stock de cada sector (ver tabla). |
| 4:40–4:50 | 🖥️ **CAPTURA:** menú `/dao` con las verticales (Logística, Salud, Energía, Gobierno, Industria 4.0, Banca, Educación). Cuadrícula final con los iconos de las 8 verticales adicionales. |

**B-roll por sector** (Adobe Stock, de 1 a 2 s cada uno):

| Sector | Búsqueda Adobe Stock | Captura BeZhas |
|---|---|---|
| Logística | `forklift warehouse pallets scanning barcode` | `/dao/logistica-supply-chain` |
| Salud | `hospital doctor tablet patient records`, `pharmacy medicine packaging line` | `/dao/salud-biotecnologia` |
| Energía | `smart grid power lines city night` | `/dao/energia-smart-cities` |
| Gobierno | `city hall public administration digital id` | `/dao/gobierno-gobernanza` |
| Seguros | `insurance agent storm damage assessment` | — |
| Legal | `lawyer signing digital contract tablet` | — |
| Industria 4.0 | `robotic arm factory automation` | `/dao/industria-4-0` |
| Agricultura | `farmer drone crop field` | — |
| Educación | `graduation digital certificate` | `/dao/educacion-credenciales` |
| Banca | `fintech mobile banking` | `/dao/banca-fintech` |

🔤 **RÓTULO:** «Nacida en la Economía Azul · Preparada para 14 sectores»

**Prompt Higgsfield (escena 6):**
```
Fishing trawler returning to a small Spanish harbor at sunrise, seagulls, calm sea,
crates of fresh fish on deck each with a small glowing cyan QR tag, cinematic
documentary style, warm sunrise with teal shadows, 16:9, 6 seconds
```

---

### ESCENA 7 · BEZHAS FRENTE A OTRAS BLOCKCHAINS (4:50 – 5:25)

🎙️ **VOZ:**
> «¿En qué se diferencia BeZhas de las grandes nubes o de las redes públicas?
> **Costes:** allí el precio de cada transacción sube y baja según la congestión de la red. Con BeZhas pagas una **tarifa plana mensual en euros**, y tu contabilidad lo agradece.
> **Integración:** otras redes obligan a reescribir tus sistemas y contratar desarrolladores Web3. BeZhas se conecta a tu ERP con un **SDK, una API universal o un plugin**.
> **Soberanía:** tus datos no salen a servidores fuera de la UE. BeZhas trabaja con **nodos locales** y una blockchain soberana **diseñada y certificada para cumplir el RGPD y el ENS**.
> **Sencillez:** nada de wallets ni de comprar criptomonedas. Tu equipo usa una web normal.»

| Tiempo | Visual |
|---|---|
| 4:50–5:25 | Tabla comparativa animada (pág. 8) con dos columnas: «Redes públicas / Big Cloud» en gris y rojo, y «BeZhas» en cian y verde. Las filas entran una a una: **Costes · Integración · Soberanía · Fricción**. Al terminar cada fila, un ✔ verde en la columna BeZhas. |
| Insertos | Gráfico de *gas* volátil en rojo frente a una línea plana en verde con «€/mes». Bandera de la UE con candado. 🖥️ **CAPTURA:** `/developer-console`, sección SDK o plugins. |

🔤 **RÓTULOS:** «Tarifa plana en €» · «Sin reescribir tu IT» · «Datos en la UE · Certificada RGPD y ENS» · «Gas invisible»

> ⚖️ **Nota legal:** no se deben mostrar los logotipos de Solana, Avalanche o Ripple. Hay que usar el texto genérico «Redes públicas / Grandes nubes» para evitar problemas de marca y de publicidad comparativa.

---

### ESCENA 8 · PLANES Y PRECIOS (5:25 – 5:55)

🎙️ **VOZ:**
> «Y hay un plan para cada tamaño de empresa.
> **Starter**, gratis, para empezar sin fricción.
> **Creator Pro**, por 99 euros al mes, pensado para la pequeña PYME, con un ahorro estimado del 34 % en gestión manual.
> **Business**, por 499 euros al mes, con integración total con tu ERP vía API.
> Y **Enterprise VIP**, para holdings y autoridades portuarias: marca blanca, multigestión y pago por uso.
> BeZhas convierte tu gasto operativo en **rentabilidad neta**: en conjunto, nuestras empresas clientes pueden ahorrar **entre 4 y 72 millones de euros al año** en costes administrativos, multas, tiempos muertos e ineficiencias logísticas.»

| Tiempo | Visual |
|---|---|
| 5:25–5:50 | Cuatro tarjetas de precio que suben una a una con un leve rebote: **Starter 0 €** · **Creator Pro 99 €/mes** · **Business 499 €/mes** (destacada con la etiqueta «Más popular») · **Enterprise VIP 2.499 €/mes**. |
| 5:50–5:55 | 🖥️ **CAPTURA:** `/be-vip` o `/vip` (BeVIP), con la página de planes real. Contador animado de ahorro: de 4.007.200 € a 72.003.600 €. |

🔤 **RÓTULOS:**
- «De OPEX a rentabilidad neta»
- «Servicio blockchain desde 5.000 € de inversión de entrada · Suscripción máx. 2.500 €/mes»
- «Ahorro anual conjunto: de 4 M€ a 72 M€»

> ℹ️ En YouTube conviene añadir la nota «Precios sin IVA. Consulta condiciones en la web».

---

### ESCENA 9 · POR QUÉ BEZHAS Y CIERRE CON CTA (5:55 – 6:30)

🎙️ **VOZ:**
> «¿Por qué BeZhas?
> Porque la digitalización inalterable de los datos **ya no es opcional**.
> Porque pagas una **tarifa plana en euros**, sin sorpresas.
> Porque tus datos se quedan **en Europa**, con soberanía y seguridad.
> Y porque **tokenizar los activos de tu empresa** te da una doble rentabilidad y funciona como un seguro frente a incidencias.
>
> BeZhas: la confianza digital que tu empresa necesita, sin la complejidad del cripto.
> Solicita tu demo hoy.»

| Tiempo | Visual |
|---|---|
| 5:55–6:15 | Montaje rápido de las mejores tomas (puerto, fábrica, hospital, panel BeZhas) con 4 ✔ animados: «Obligatorio por ley» · «Tarifa plana €» · «Soberanía UE» · «Doble rentabilidad». |
| 6:15–6:30 | Logo BeZhas centrado sobre fondo azul noche con partículas. Tarjeta final de YouTube (*end screen*) con el botón de suscribirse y el vídeo recomendado. |

🔤 **RÓTULO FINAL (CTA):**
```
Solicita tu demo gratuita
✉ info.angelqg@gmail.com
▶ YouTube: BeZhas BlockConnetion
in LinkedIn: Yoel Ángel Hernández
```
🎵 **AUDIO:** clímax musical y cierre con un golpe de sonido al aparecer el logo.

> 📝 Recomendación: sustituir el Gmail personal por un correo corporativo (p. ej. `demo@bezhas.com`) y un enlace de demo con UTM (`?utm_source=youtube&utm_campaign=explainer`) para medir conversiones. **No se debe publicar el teléfono personal** en un vídeo público.

---

## 3. Mapa de capturas de la plataforma

Lista de grabación para el operador de pantalla. Hay que grabar a 1920×1080, con el cursor resaltado, zoom suave en Premiere y **datos de demostración**.

| # | Ruta | Página (archivo) | Qué mostrar | Escena |
|---|---|---|---|---|
| 1 | `/business-dashboard` | `BusinessDashboard.jsx` | Tarjetas de KPIs y gráficas | 3, 5 |
| 2 | `/bez-pay` | `BezPayPage.jsx` | Pago en EUR | 3 |
| 3 | `/developer-console` | `DeveloperConsole.jsx` | API key (**enmascarada**) y snippet del SDK | 4, 7 |
| 4 | `/aegis` | `AegisDashboard.jsx` | *Risk score* y alerta de anomalía | 4 |
| 5 | `/compliance` | `CompliancePage.jsx` | Registro verificado | 4 |
| 6 | `/wallet` | `WalletPage.jsx` | Saldo corporativo (sin direcciones reales) | 4 |
| 7 | `/superpanel` | `SuperPanel.jsx` | Vista unificada (Hub) | 5 |
| 8 | `/logistics` | `Logistics/LogisticsPage.jsx` | Seguimiento de carga | 5 |
| 9 | `/rwa` | `RWAPage.jsx` | Activo tokenizado | 5 |
| 10 | `/defi-hub` | `DeFiHub.jsx` | Rendimiento o liquidez | 5 |
| 11 | `/oracle` | `OraclePage.jsx` | Validación del oráculo (Vision Scan) | 5 |
| 12 | `/ml-dashboard` | `MLDashboard.jsx` | Modelos de IA | 5 |
| 13 | `/dao/*` | verticales | Menú de sectores | 6 |
| 14 | `/be-vip` | `BeVIP.jsx` | Planes | 8 |

> Si BZ PureScan, BeZhas Energy o Vision Scan no tienen una pantalla terminada en el frontend, se sustituye la captura por el B-roll **[HF]** indicado en su escena.

---

## 4. Plan de producción paso a paso

1. **Validar el contenido.** Corregir en el PDF la errata «Bolckchain» y las etiquetas de ahorro de la pág. 11 (sección 0), y tener a mano la referencia del certificado ENS.
2. **Grabar la locución de prueba.** Voz IA con Higgsfield `generate_audio` para el *animatic* y ajuste de tiempos. La locución final puede ser humana o IA mejorada con Adobe *Enhance Speech*.
3. **Generar el B-roll en Higgsfield.** Son 12 *prompts* **[HF]**, que se pueden lanzar en lote con `generate_video_batch`. Conviene revisar el saldo de créditos antes (`balance`).
4. **Descargar el stock de Adobe.** Buscar las entradas **[AS]** y licenciar solo lo que se use.
5. **Grabar las capturas.** Seguir la lista de la sección 3.
6. **Montar en Premiere o Express.** Pistas: V1 B-roll, V2 capturas, V3 rótulos y *motion graphics*, A1 voz, A2 música (−18 dB bajo la voz), A3 efectos.
7. **Subtitular.** Subtítulos automáticos en ES, corregidos a mano, y traducción a EN.
8. **Exportar.** H.264, 1080p, 16 Mbps (o 4K a 45 Mbps), audio AAC 320 kbps y −14 LUFS para YouTube.
9. **Miniatura.** Fondo azul noche, contenedor con sello cian y el texto «¿Tu PYME está lista?» con el logo BeZhas.

---

## 5. Metadatos para YouTube

**Título (≤ 70 caracteres):**
`BeZhas Blockchain: certifica los datos de tu empresa sin cripto | Explicado`

**Descripción:**
```
¿Tu empresa necesita demostrar trazabilidad, cumplir la normativa y proteger sus datos
sin complicarse con criptomonedas? BeZhas es la blockchain middleware de confianza
digital para PYMEs, la economía azul y la logística global.

⏱️ Capítulos
00:00 ¿Puedes demostrarlo?
00:20 La doble presión sobre la PYME
00:55 Qué es BeZhas
01:40 Cómo funciona en 4 pasos
02:40 Hub, CargoLink, Energy, PureScan, Capital y Vision Scan
03:55 Sectores: logística, salud, energía, gobierno, seguros, legal…
04:50 BeZhas vs otras blockchains
05:25 Planes y precios
05:55 Por qué BeZhas + demo

✅ Conexión con SAP, Odoo, Salesforce y WordPress (API / SDK)
✅ Aegis AI: auditoría y detección de anomalías
✅ Tarifa plana en euros · Gas invisible
✅ Nodos en la UE · Diseñada y certificada para RGPD y ENS

📩 Solicita tu demo: [enlace]
```

**Etiquetas:** `blockchain empresas`, `blockchain pymes`, `trazabilidad blockchain`, `pasaporte digital de producto`, `DPP`, `economía azul`, `logística blockchain`, `SAP blockchain`, `tokenización RWA`, `BeZhas`, `Layer 2`, `ENS RGPD blockchain`

**Tarjeta final:** Suscribirse · Vídeo «Demo de BeZhas Hub» · Enlace a la web.

---

## 6. Texto completo de locución (para el locutor o la voz IA)

Son unas 930 palabras, unos 6:25 minutos a 145 palabras por minuto.

```
¿Y si tu próximo gran cliente te pidiera mañana demostrar, con pruebas imposibles de
falsificar, de dónde viene tu mercancía, cuándo salió y en qué estado llegó?
¿Podrías hacerlo… sin contratar a un equipo de programadores? Con BeZhas, sí.

Hoy las PYMEs viven bajo una doble presión. Por un lado, la ley: la normativa europea y
española exige cada vez más que los datos sean digitales, inalterables y ciberseguros.
Por otro, sus propios clientes: las grandes industrias ya piden a sus proveedores
trazabilidad y seguridad total. Y adaptarse cuesta. Esta fricción puede llegar a consumir
hasta el 25 % del margen operativo. En España, las PYMEs son el 99,8 % del tejido
empresarial, casi 3 millones de empresas. Pero solo el 10 % ha dado el paso al
blockchain. ¿Por qué? Costes impredecibles, integraciones complicadas con el ERP y la
necesidad de gestionar claves y criptomonedas.

BeZhas es la blockchain middleware de confianza digital para la economía azul y la
logística global. Dicho de forma sencilla: BeZhas se conecta a los sistemas que tu
empresa ya usa, como el ERP, los sensores IoT o la web, y convierte cada evento
importante en una prueba digital inmutable: un envío, una inspección, una lectura de
energía o una factura. Todo esto ocurre en su propia red, una Layer 2 soberana basada
en OP Stack, con nodos en Europa. Y lo mejor: tu equipo no necesita saber nada de
cripto. Se trabaja desde un panel web tradicional, se paga en euros y no hacen falta
billeteras digitales.

¿Cómo funciona? En cuatro pasos. Uno: conectas. Los datos llegan desde tu ERP, como SAP,
Odoo o Salesforce, a través de la API universal, el SDK o incluso un plugin de WordPress.
También desde sensores IoT. Dos: se valida. El BeZhas Edge Node recibe los datos,
calcula su huella digital única y los firma. Tres: la IA audita. Antes de registrar
nada, Aegis AI revisa que cumpla la normativa y detecta anomalías. Si algo no cuadra,
te avisa. Así, a la cadena solo llega información fiable. Cuatro: queda registrado para
siempre. Los contratos inteligentes de BeZhas guardan la prueba en la blockchain. Nadie
puede modificarla, ni siquiera nosotros. ¿Y el coste de cada transacción? Lo cubre el
Corporate Gas Tank: un saldo corporativo en euros, recargable y predecible. Es un gas
invisible que se paga por debajo, sin que tu equipo tenga que pensar en ello.

Sobre esta red funciona un ecosistema de aplicaciones listas para usar. BeZhas Hub es tu
centro de mando: gestionas en un solo lugar las operaciones digitales, financieras y
logísticas, con conectores ERP y herramientas Web3, sin conocimientos técnicos.
BZ CargoLink es la terminal de validación para la logística, las aduanas y la última
milla: cada carga, trazada y optimizada. BeZhas Energy monitoriza el consumo energético
con IoT, valida los nodos y rentabiliza los tokens energéticos. BZ PureScan lleva la
trazabilidad alimentaria al siguiente nivel: la IA escanea y analiza el producto y genera
su Pasaporte Digital de Producto, el DPP que exige la Unión Europea. BZ Capital es el
brazo financiero: tokeniza activos del mundo real, como inmuebles, maquinaria o
mercancía, y los convierte en liquidez. Y BeZhas Vision Scan es el ojo de la red: una IA
que valida visualmente contenedores e infraestructuras y conecta el mundo físico con los
contratos inteligentes.

BeZhas nace en la economía azul: puertos, sector marítimo-pesquero, acuicultura y
trazabilidad de la carga en origen. Pero su tecnología resuelve problemas reales en
muchos sectores. En logística y supply chain, adiós a los proveedores sin auditoría:
checkpoints, IoT y registros de inventario verificables. En salud, los datos médicos
fragmentados se unifican con credenciales seguras y trazabilidad farmacéutica.
En energía, la sostenibilidad ESG por fin se puede verificar: créditos de carbono
tokenizados y mercados de energía entre particulares. En gobierno, identidad digital
ciudadana y presupuestos públicos transparentes. En seguros, ajustes automáticos y pagos
rápidos con pólizas paramétricas. En legal, contratos que se ejecutan solos y evidencias
custodiadas. Y más: automoción, manufactura, agricultura, educación, inmobiliario,
entretenimiento y servicios.

¿En qué se diferencia BeZhas de las grandes nubes o de las redes públicas? Costes: allí
el precio de cada transacción sube y baja según la congestión de la red. Con BeZhas
pagas una tarifa plana mensual en euros, y tu contabilidad lo agradece. Integración:
otras redes obligan a reescribir tus sistemas y contratar desarrolladores Web3. BeZhas se
conecta a tu ERP con un SDK, una API universal o un plugin. Soberanía: tus datos no
salen a servidores fuera de la UE. BeZhas trabaja con nodos locales y una blockchain
soberana diseñada y certificada para cumplir el RGPD y el ENS. Sencillez: nada de wallets ni de comprar
criptomonedas. Tu equipo usa una web normal.

Y hay un plan para cada tamaño de empresa. Starter, gratis, para empezar sin fricción.
Creator Pro, por 99 euros al mes, pensado para la pequeña PYME, con un ahorro estimado
del 34 % en gestión manual. Business, por 499 euros al mes, con integración total con tu
ERP vía API. Y Enterprise VIP, para holdings y autoridades portuarias: marca blanca,
multigestión y pago por uso. BeZhas convierte tu gasto operativo en rentabilidad neta: en
conjunto, nuestras empresas clientes pueden ahorrar entre 4 y 72 millones de euros al año
en costes administrativos, multas, tiempos muertos e ineficiencias logísticas.

¿Por qué BeZhas? Porque la digitalización inalterable de los datos ya no es opcional.
Porque pagas una tarifa plana en euros, sin sorpresas. Porque tus datos se quedan en
Europa, con soberanía y seguridad. Y porque tokenizar los activos de tu empresa te da una
doble rentabilidad y funciona como un seguro frente a incidencias.

BeZhas: la confianza digital que tu empresa necesita, sin la complejidad del cripto.
Solicita tu demo hoy.
```

---

## 7. Contenido del PDF que queda fuera del vídeo comercial

Las págs. 9 (TAM/SAM/SOM), 11 (proyecciones financieras, salvo las cifras de ahorro, que sí se usan en la escena 8), 12 (equipo) y 13 (necesidades de inversión: 575.000 €) están dirigidas a **inversores**, no a clientes. Se recomienda usarlas en un **segundo vídeo, «BeZhas para inversores»**, y no en este explainer comercial. Mezclar ambos mensajes confunde al cliente y expone datos de la ronda de inversión.

---

## 8. Estado de producción en Higgsfield

Proyecto: **«BeZhas - Video explicativo YouTube»**.

**Pronunciación:** la marca se escribe **BeZhas** en rótulos y subtítulos, pero se pronuncia **«BiZhas»**. En los *prompts* de voz hay que escribir `BiZhas` para forzar esa pronunciación.

**Voz elegida:** *Fraser* (preset `6705e465-7b52-5915-a1d8-b1222885e01d`), modelo `seed_audio`, acento castellano neutro. Las cifras se escriben en letra para que se lean bien.

| Escena | Locución (Fraser) | Duración | Estado |
|---|---|---|---|
| 1 · Gancho | `0ed66b3a-49b5-4188-99fa-69e5afa3af48` | 22,5 s | ✅ (2,5 s más larga de lo previsto: recortar pausas o usar `speech_rate` +10) |
| 2 · Problema | `adbb1430-8775-4e0e-9de1-b3f8e928079f` | 36,0 s | ✅ |
| 3 · Qué es BeZhas | `a7c88c72-bb3d-4215-8e34-339fd570dec4` | 41,5 s | ✅ |
| 4 · Cómo funciona | — | — | ⏳ pendiente de créditos |
| 5 · Aplicaciones | — | — | ⏳ pendiente de créditos |
| 6 · Sectores | — | — | ⏳ pendiente de créditos |
| 7 · Comparativa | — | — | ⏳ pendiente de créditos |
| 8 · Planes | — | — | ⏳ pendiente de créditos |
| 9 · Cierre y CTA | `c70eb9ea-3a09-4272-9e10-f07db51735db` | 29,4 s | ✅ |

**Descartadas:** existe una primera versión de las escenas 1–9 con la voz *Julian*, que pronuncia «BeZhas» tal cual se escribe. No se usa en el montaje.

| B-roll | Modelo | Job | Estado |
|---|---|---|---|
| Escena 1 · Puerto al amanecer con sello holográfico | `seedance_2_5` 720p · 6 s | `6c7e48c7-489c-44cc-83e4-372666f2479d` | ⏳ en cola |
| Resto de B-roll **[HF]** (11 prompts) | `seedance_2_5` | — | ⏳ pendiente de créditos (~42 créditos/clip en 720p) |
