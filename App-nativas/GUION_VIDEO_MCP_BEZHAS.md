# 🎬 Guion de vídeo — BeZhas MCP: conecta tu IA, crea tu API key y tokeniza un activo real

> **Formato:** explainer interactivo para YouTube y onboarding · **Duración objetivo:** ~10 min · **Tono:** claro, cercano, técnico-comercial
> **Estética:** la misma de los vídeos actuales (`GUION_VIDEO_YOUTUBE_API_BEZHAS.md`, recorrido `@bezhas/guided-tour`): dark luxury, teal `#00D4AA` · gold `#FFD700` · pink `#FF6B9D`, Syne en títulos y Space Mono en código.
>
> **Leyenda por escena:**
> 🎙️ narración / diálogo · 🖥️ texto o UI en pantalla · 🎬 b-roll, visual o animación · ⏸️ **pausa interactiva** (el espectador lo hace a la vez) · ❓ pregunta en pantalla
>
> **Personajes del diálogo:**
> - **LÍA** — guía de BeZhas. Voz de la plataforma: explica y marca el ritmo.
> - **MARCOS** — director de una gestora de inmuebles y flotas en Algeciras. No es desarrollador; pregunta lo que preguntaría cualquier cliente.
> - **DANI** — el desarrollador del equipo de Marcos. Solo aparece en las escenas técnicas.
>
> Todo lo que sale en pantalla entre comillas `«…»` es **texto real de la plataforma**, copiado del código en producción. La fuente de cada fragmento está en la sección [Fuentes de los fragmentos reales](#-fuentes-de-los-fragmentos-reales) al final.

---

## 🎯 Mapa del vídeo

| # | Bloque | Escenas | Duración aprox. | Capítulo de YouTube |
|---|--------|---------|-----------------|---------------------|
| 1 | Hook: qué es BeZhas MCP | 1–2 | 0:00–1:00 | `0:00 Qué es BeZhas MCP` |
| 2 | Conectar tu IA (Claude, ChatGPT, Codex, Gemini) | 3–5 | 1:00–3:15 | `1:00 Conecta tu IA en 2 minutos` |
| 3 | Qué puede hacer tu IA con BeZhas | 6 | 3:15–4:15 | `3:15 Las 4 herramientas` |
| 4 | Conectar la API: tu API key | 7 | 4:15–5:30 | `4:15 Crea tu API key` |
| 5 | Tokenizar un activo real, paso a paso | 8–11 | 5:30–8:45 | `5:30 Tokeniza un activo` |
| 6 | Seguridad y cierre | 12–13 | 8:45–10:00 | `8:45 Seguridad y próximos pasos` |

---

## ESCENA 1 — Hook (0:00–0:25)

🎬 Apertura: un chat de IA en blanco sobre fondo oscuro. Un cursor escribe una pregunta y aparece una línea teal que conecta el chat con un bloque de Polygon.

🎙️ **MARCOS:** *"Tengo tres apartamentos, dos locales y una flota de furgonetas. Me dicen que puedo tokenizarlos… pero yo no sé programar blockchain."*

🎙️ **LÍA:** *"No hace falta. Si sabes hablar con una IA, ya sabes usar BeZhas. Hoy vas a conectar tu IA a la blockchain, vas a crear tu API key y vas a tokenizar un activo real. En diez minutos."*

🖥️ Título grande: **«Tu IA, conectada a la blockchain.»** · debajo, en Space Mono: `mcp.bezhas.com/mcp`

---

## ESCENA 2 — Qué es BeZhas MCP (0:25–1:00)

🎙️ **LÍA:** *"MCP es el estándar abierto con el que las IA consultan datos reales. BeZhas MCP es el conector oficial: una sola dirección que funciona en Claude, ChatGPT, Codex, Gemini y en tu editor."*

🎙️ **MARCOS:** *"¿Y tengo que pegar contraseñas en el chat?"*

🎙️ **LÍA:** *"Nunca. Entras con tu cuenta de BeZhas en una pantalla segura, igual que cuando inicias sesión con Google. La IA recibe un permiso que caduca a los diez minutos y que puedes retirar cuando quieras."*

🖥️ Tres tarjetas que entran en secuencia (textos reales de la página `/mcp`):
- 🔐 **«OAuth 2.1 + PKCE»** · «Autorizas con tu cuenta de BeZhas. Sin claves pegadas en el chat.»
- ✍️ **«La IA nunca firma»** · «Todo lo que mueve valor necesita la firma de una persona.»
- 🇪🇺 **«MiCA · DAC8 · RGPD»** · «Diseñado para operar dentro del marco europeo.»

❓ **En pantalla:** *«¿Qué IA usas tú? Escríbelo en los comentarios: Claude, ChatGPT, Codex o Gemini.»*

---

## ESCENA 3 — Conectar Claude o ChatGPT, sin código (1:00–1:50)

🎙️ **LÍA:** *"Empezamos por lo fácil. Abre Claude, ve a Configuración, Conectores, y pulsa «Añadir conector personalizado». Pega esta dirección."*

🖥️ Captura del panel de conectores de Claude con el campo URL resaltado:
```
https://mcp.bezhas.com/mcp
```

⏸️ **Pausa interactiva** · 🖥️ *«Pausa el vídeo y pega la URL en tu IA. Te esperamos.»* (contador de 5 s con el logo BEZ girando)

🎙️ **LÍA:** *"Al guardar, se abre la pantalla de BeZhas. Fíjate en el título: así sabes que estás en la de verdad."*

🖥️ Recreación fiel de la pantalla de consentimiento real:
```
┌──────────────────────────────────────────────┐
│  Conecta tu asistente con BeZhas             │
│  Aplicación: Claude (…)                      │
│                                              │
│  Correo      [ marcos@gestora.es          ]  │
│  Contraseña  [ ••••••••••                 ]  │
│  Código de verificación [ 123456 ]           │
│                              [ Entrar ]      │
│                                              │
│  Pantalla segura de BeZhas · no compartas    │
│  esta URL                                    │
└──────────────────────────────────────────────┘
```

🎙️ **MARCOS:** *"¿Y ese código de verificación?"*

🎙️ **LÍA:** *"Si tienes activada la verificación en dos pasos, BeZhas te lo pide aquí. Si no, puedes dejarlo en blanco."*

---

## ESCENA 4 — Autorizar el conector (1:50–2:30)

🎙️ **LÍA:** *"Ahora BeZhas te dice exactamente qué va a poder hacer tu IA. Léelo antes de aceptar: esto es lo único a lo que tendrá acceso."*

🖥️ Segunda pantalla real, con los dos permisos como lista:
```
┌──────────────────────────────────────────────┐
│  Autorizar conector                          │
│  Aplicación: Claude (…)                      │
│                                              │
│  • Consultar la red: gas, contratos y        │
│    saldos públicos en el explorador          │
│  • Cotizar pagos en BEZ-Coin (sin            │
│    ejecutarlos)                              │
│                                              │
│  No podrá mover fondos, enviar mensajes ni   │
│  cambiar nada en tu cuenta.                  │
│                                              │
│            [ Cancelar ]   [ Autorizar ]      │
└──────────────────────────────────────────────┘
```

🎬 Zoom lento sobre la frase *«No podrá mover fondos, enviar mensajes ni cambiar nada en tu cuenta.»* → subrayado en teal.

🎙️ **MARCOS:** *"O sea, que mi IA puede mirar, pero no tocar."*

🎙️ **LÍA:** *"Exacto. Pulsa «Autorizar» y vuelves a Claude ya conectado. En ChatGPT el proceso es el mismo: añades el conector, pegas la URL e inicias sesión."*

---

## ESCENA 5 — Conectar Claude Code, Codex y Gemini (desarrolladores) (2:30–3:15)

🎙️ **DANI:** *"Yo trabajo en terminal. ¿Cambia algo?"*

🎙️ **LÍA:** *"Solo el sitio donde pegas la dirección. El inicio de sesión es el mismo."*

🖥️ Tres pestañas que se van activando (estética de la sección «Conecta tu IA» de `/mcp`):

**Claude Code**
```bash
claude mcp add --transport http bezhas https://mcp.bezhas.com/mcp
```

**Codex** — `~/.codex/config.toml`
```toml
[mcp_servers.bezhas]
url = "https://mcp.bezhas.com/mcp"
```

**Gemini CLI** — `~/.gemini/settings.json` · **Antigravity** — `mcp_config.json`
```json
{ "mcpServers": { "bezhas": { "httpUrl": "https://mcp.bezhas.com/mcp" } } }
```
```json
{ "mcpServers": { "bezhas": { "serverUrl": "https://mcp.bezhas.com/mcp" } } }
```

🎙️ **DANI:** *"¿Y cómo sabe mi cliente dónde iniciar sesión?"*

🎙️ **LÍA:** *"Lo descubre solo. Mira qué responde BeZhas si alguien llama sin permiso."*

🎬 Terminal en vivo, respuesta real del servidor en producción:
```bash
$ curl -i -X POST https://mcp.bezhas.com/mcp
HTTP/2 401
www-authenticate: Bearer resource_metadata="https://mcp.bezhas.com/.well-known/oauth-protected-resource"
```

🎙️ **LÍA:** *"Ese 401 no es un error: es la señal para que tu cliente abra el navegador, te lleve a la pantalla de BeZhas y vuelva con el permiso. No configuras nada más."*

---

## ESCENA 6 — Qué puede hacer tu IA con BeZhas (3:15–4:15)

🎙️ **LÍA:** *"Ya estás conectado. Pregúntale a tu IA qué herramientas de BeZhas tiene."*

🖥️ Chat de Claude. **MARCOS** escribe: *«Dime qué herramientas de BeZhas tengo»*. La respuesta muestra las cuatro herramientas en producción:

| Herramienta | Permiso | Qué hace (descripción real) |
|---|---|---|
| `get_wallet_balance` | Consultar la red | «Consulta el saldo de BEZ-Coins de una wallet en la blockchain. La respuesta indica la red y el chainId reales del nodo consultado.» |
| `blockscout_explorer` | Consultar la red | Explorador de bloques y auditoría on-chain del token $BEZ en Polygon: holders, historial de transacciones, supply y verificación de contratos. |
| `analyze_gas_strategy` | Consultar la red | «Analiza si es rentable ejecutar una transacción ahora o esperar, quién paga el gas…» |
| `get_payment_quote` | Cotizar pagos | «Calcula cuántos BEZ-Coins se obtienen por una cantidad de Fiat o Crypto.» Acepta USD, EUR, ETH, USDT, USDC, BTC y MATIC. |

🎙️ **MARCOS:** *"¿Y si alguien le pide a mi IA que pague con Stripe o que publique en GitHub?"*

🎙️ **LÍA:** *"No puede. Tu IA solo ve las herramientas que cubren los permisos que autorizaste. Las demás, para ella, no existen."*

❓ **Quiz en pantalla (tarjeta de YouTube):** *«¿Puede la IA transferir tus BEZ-Coins?»* → A) Sí, si se lo pides · B) **No: solo consulta y cotiza** · (respuesta revelada a los 3 s)

---

## ESCENA 7 — Conectar la API: crea tu API key (4:15–5:30)

🎙️ **LÍA:** *"El MCP es para hablar con tu IA. Para que tu propio software trabaje con BeZhas necesitas una API key. Entra en la Consola de Desarrollo."*

🖥️ Navegador: `https://www.bezhas.com/developers` → botón **«Crear Nueva API Key»**.

🎬 Formulario real, rellenándose campo a campo:
- **Nombre:** `Gestora Algeciras — Inmuebles` *(placeholder real: «Mi Aplicación E-commerce»)*
- **Descripción:** *«Descripción de tu integración…»*
- **Sector:** **«Bienes Raíces»**
- **Entorno:** **«Development»** / «Production»

🎙️ **LÍA:** *"Fíjate: al elegir «Bienes Raíces», BeZhas marca solo los permisos de tu sector."*

🖥️ Aparece el aviso real **«✅ 7 permisos auto-configurados para este sector»** y los permisos, uno a uno:
```
realestate:tokenize        realestate:fractionate
realestate:manage          realestate:rent:collect
payments:read              payments:escrow:create
legal:contract:deploy
```

🎙️ **DANI:** *"¿Por qué me pide conectar la wallet?"*

🎙️ **LÍA:** *"Porque la clave se emite con tu firma. Pulsa «Firmar y Crear API Key» y confirma en la wallet: así nadie puede crear claves en tu nombre."*

🖥️ Botón **«Firmar y Crear API Key»** → estado **«Firmando Autorización...»** → clave generada, **desenfocada** en el vídeo, con el aviso real:
> **«Importante:** Por seguridad, esta clave solo se muestra una vez.»

⏸️ **Pausa interactiva** · 🖥️ *«Copia tu clave ahora y guárdala en un archivo `.env`. No la pegues nunca en un chat ni la subas a git.»*
```bash
# .env
BEZHAS_API_KEY=… # tu clave, fuera del repositorio
```

🎙️ **LÍA:** *"Desde la misma tarjeta puedes «Rotar clave» o «Revocar» si alguna vez se expone. Y en «Métricas de Uso» ves tus peticiones de hoy y de este mes."*

---

## ESCENA 8 — Tokenizar un activo · paso 1: Categoría (5:30–6:05)

🎙️ **MARCOS:** *"Vale. Ahora lo que de verdad quiero: tokenizar mi local de la calle Real."*

🎙️ **LÍA:** *"Ve a la sección de activos reales y pulsa «Tokenizar Activo». Son cuatro pasos y siempre ves en cuál estás."*

🖥️ Navegador: `https://www.bezhas.com/rwa` · subtítulo real: **«Tokeniza activos reales (inmuebles, vehículos, arte) en fracciones ERC-1155»** → botón **«Tokenizar Activo»**.

🎬 Barra de progreso real en dorado: **«Categoría» → «Detalles» → «Tokenización» → «Documentos»**. Se ilumina el paso 1.

🖥️ Rejilla con las 8 categorías reales y sus iconos: Inmueble 🏢 · Hotel 🏨 · Local 🏪 · Ropa 👕 · Coche 🚗 · Barco 🚢 · Helicóptero 🚁 · Objeto 💎

🎙️ **LÍA:** *"Marcos elige «Inmueble», que es lo que es su local. Si fuera una furgoneta de su flota, elegiría «Coche»."*

---

## ESCENA 9 — Paso 2: Detalles (6:05–6:40)

🖥️ Formulario real del paso 2:
- **«Nombre del Activo *»** → `Local comercial calle Real 14`
- **«Descripción»** → *«Describe las características principales del activo...»*
- **«Valoración Total (USD) *»** → `240000`
- Campos propios de la categoría «Inmueble»: **«Dirección Completa»** · *«Calle, Ciudad, País»* y **«Metros Cuadrados»**

🎙️ **LÍA:** *"Los campos cambian según la categoría. Para un coche te pide «Marca y Modelo» y «Matrícula/VIN»; para un barco, «Puerto Base» y «Eslora»."*

🎙️ **MARCOS:** *"¿Esta valoración la decido yo?"*

🎙️ **LÍA:** *"La declaras tú, y por eso en el paso 4 subes la documentación que la respalda. La cadena no crea el derecho sobre el activo: lo refleja."*

---

## ESCENA 10 — Paso 3: Tokenización (6:40–7:35)

🖥️ Panel dorado real, arriba del paso 3:
```
Fee de Tokenización           100 BEZ
Tu balance: 350.00 BEZ
```

🎙️ **LÍA:** *"Tokenizar cuesta 100 BEZ. Es la comisión que cobra el contrato en Polygon, y la puedes comprobar tú mismo en la cadena. Antes de seguir, pregúntale a tu IA si tienes saldo."*

🎬 **Momento MCP en paralelo** — pantalla partida: a la izquierda el asistente, a la derecha el chat de Claude.

🖥️ **MARCOS** escribe en Claude: *«¿Cuántos BEZ tengo en la wallet 0x…? ¿Y cuánto me costaría en euros comprar 100 BEZ más?»*
→ Claude llama a `get_wallet_balance` y a `get_payment_quote` (`fromCurrency: "EUR"`) y responde con el saldo, la red (`chainId 137`) y la cotización con su fecha (`rateAsOf`).

🎙️ **LÍA:** *"Mira cómo la IA te dice de qué red saca el saldo y de cuándo es el cambio. Una cotización caducada no sirve para pagar, y BeZhas no te la oculta."*

🖥️ De vuelta al asistente, campos reales:
- **«Total de Fracciones *»** → `1000`
- **«Precio por Fracción (BEZ) *»** → `100.00`
- **«Rendimiento Estimado (APY %) *»** → `8.5` · *«Estimación anual de rentas pasivas»*

🎬 Recuadro **«Vista Previa de Cálculos»** calculándose en vivo:
```
Capital Total a Recaudar:     100,000 BEZ
Valor por Fracción (USD):     $240.00
```

❓ **En pantalla:** *«Si divides tu local en 1.000 fracciones, ¿cuánto vale cada una? → valoración ÷ fracciones.»*

---

## ESCENA 11 — Paso 4: Documentos y firma (7:35–8:45)

🖥️ Paso 4 real:
- **«Documentación Legal * (PDF)»** · *«Escrituras, contratos, seguros, licencias»*
- **«Imágenes (Opcional)»** · *«JPG, PNG, WEBP. Max 10MB por archivo»*
- Visibilidad: **Público** («Visible para todos en el marketplace») · **Solo DAO** («Exclusivo para miembros de la DAO») · **Privado** («Solo accesible mediante enlace directo»)
- **«Requisitos de Acceso»:** «Sin restricciones (Cualquiera puede invertir)» · «Requiere KYC Verificado» · «Solo Whitelist (Lista Blanca)» · «Solo Inversores Acreditados»

🎙️ **LÍA:** *"Los documentos se suben a IPFS y el token guarda su referencia. Consejo: no subas datos personales de inquilinos. Lo que se publica en la cadena es público y permanente."*

🎙️ **MARCOS:** *"Elijo «Requiere KYC Verificado». Quiero saber quién invierte en mi local."*

🖥️ Botón **«Tokenizar Activo»** → estado **«Tokenizando...»**. La wallet pide dos firmas, una detrás de otra:
1. **Aprobar** que el contrato cobre los 100 BEZ de la comisión.
2. **Crear el activo** (`tokenizeAsset`).

🎬 Bloque de Polygon que se confirma → sello teal **«AssetTokenized ✓»** con el `assetId`.

🎙️ **DANI:** *"¿Y si quiero hacerlo desde nuestro sistema, sin pasar por la web?"*

🎙️ **LÍA:** *"Llamas al mismo contrato. Es exactamente la función que usa el asistente:"*

🖥️ Código real (Space Mono), con las líneas iluminándose según las nombra:
```js
import { ethers } from 'ethers';

const factory = new ethers.Contract(RWA_FACTORY_ADDRESS, [
  'function tokenizationFee() view returns (uint256)',
  'function tokenizeAsset(string name, uint8 category, string legalCID, string imagesCID, uint256 supply, uint256 valuationUSD, uint256 pricePerFraction, uint256 estimatedYield, string location) returns (uint256)',
], signer);

const fee = await factory.tokenizationFee();          // 100 BEZ
// …approve(fee) sobre BEZ-Coin, igual que hace el asistente…

const tx = await factory.tokenizeAsset(
  'Local comercial calle Real 14',
  0,                                // 0 = Inmueble
  legalCID, imagesCID,              // CIDs de IPFS
  1000,                             // fracciones
  240000,                           // valoración en USD
  ethers.parseEther('100'),         // precio por fracción en BEZ
  85,                               // rendimiento estimado
  'Algeciras, España',
);
await tx.wait();                     // emite AssetTokenized(assetId, …)
```

🎙️ **LÍA:** *"Y para cerrar el círculo, pídele a tu IA que lo compruebe en la cadena."*

🖥️ Chat: *«Muéstrame las últimas transacciones del contrato de tokenización»* → Claude usa `blockscout_explorer` (`transaction_history`) y enseña la operación recién confirmada.

---

## ESCENA 12 — Seguridad: lo que BeZhas no te deja hacer mal (8:45–9:30)

🎙️ **MARCOS:** *"Última duda. Si mañana despido a alguien que tenía mi IA conectada…"*

🎙️ **LÍA:** *"Desconectas BeZhas en los conectores de su IA y el permiso deja de valer. El acceso dura diez minutos y se renueva solo mientras siga autorizado. Y si alguien copia un permiso de renovación y lo intenta usar dos veces, BeZhas corta la sesión entera."*

🖥️ Cuatro tarjetas (la última, texto real de `/mcp`):
- ✍️ **La IA nunca firma** · todo lo que mueve valor lo firmas tú en tu wallet, como en la tokenización.
- 🎛️ **Tus permisos mandan, no el prompt** · la IA solo ve las herramientas de los permisos que autorizaste.
- ⏱️ **Permisos de 10 minutos** · se renuevan solos mientras sigas autorizado; si los retiras, se acaban.
- 🌐 **«Un conector para todas las IA»** · «Estándar abierto MCP con OAuth 2.1 y PKCE.»

---

## ESCENA 13 — Cierre y llamada a la acción (9:30–10:00)

🎙️ **LÍA:** *"Recapitulamos. Uno: conectas tu IA con una URL. Dos: creas tu API key firmada con tu wallet. Tres: tokenizas tu activo en cuatro pasos por 100 BEZ. Y tu IA te acompaña en cada uno."*

🎙️ **MARCOS:** *"Mi local ya está en la blockchain. Y no he escrito ni una línea de código."*

🖥️ Checklist final animado (cada ítem con ✓ teal):
- ✓ `https://mcp.bezhas.com/mcp` añadido a mi IA
- ✓ API key creada en `www.bezhas.com/developers`
- ✓ Activo tokenizado en `www.bezhas.com/rwa`

🖥️ Pantalla final de YouTube: dos tarjetas → **«Vídeo: La API de BeZhas»** · **«Vídeo: Integración API REST paso a paso»** + botón de suscripción.

🎬 Cierre: las islas del hook unidas por la red teal → logo yin-yang BEZ.

🎙️ **LÍA:** *"Tu empresa es una isla. BeZhas es el puerto común."*

---

## 🎙️ Locución condensada (versión corta ~60 s, para Shorts/Reels)

| Escena | Entra | Sale | Locución |
|---|---|---|---|
| Hook | 0:00 | 0:05 | Si sabes hablar con una IA, ya sabes usar BeZhas. |
| Conectar | 0:05 | 0:14 | Pega mcp.bezhas.com/mcp en Claude, ChatGPT, Codex o Gemini, e inicia sesión con tu cuenta. |
| Permisos | 0:14 | 0:22 | Tu IA consulta la red y cotiza en BEZ. No puede mover fondos ni cambiar nada en tu cuenta. |
| API key | 0:22 | 0:32 | En la Consola de Desarrollo eliges tu sector y firmas tu API key con tu wallet. |
| Tokenizar | 0:32 | 0:48 | Categoría, detalles, fracciones y documentos. Cuatro pasos y cien BEZ, y tu activo queda en Polygon. |
| Verificar | 0:48 | 0:55 | Y tu IA lo comprueba en la cadena por ti. |
| Cierre | 0:55 | 1:00 | Tu empresa es una isla. BeZhas es el puerto común. |

---

## ✅ Antes de grabar

- [ ] **Graba con una wallet de demostración.** La tokenización es real: el contrato de Polygon cobra 100 BEZ. Comprobado on-chain el 2026-09-27: `tokenizationFee() = 100 BEZ`, contrato `0xa7e6656eFA45EB59ca247aa15F883330692C0d9A`, el que usa el frontend de producción.
- [ ] **Desenfoca** la API key, el correo, la dirección de la wallet y cualquier CID de documentos reales.
- [ ] **La página `/mcp` todavía muestra `mcp.bez.digital/mcp`**, un dominio que ha caducado. En el vídeo se usa `mcp.bezhas.com/mcp`, el que funciona en producción. Corrige la página antes de publicar o las capturas no coincidirán con el vídeo.
- [ ] **Comprueba el login en Codex y Gemini CLI** con las versiones que vayas a grabar. La configuración es la de la página `/mcp`; el comando para iniciar la autorización cambia entre versiones de cada cliente.
- [ ] **El frontend de producción no tiene configurada la dirección del Vault RWA** (`VITE_RWA_VAULT_ADDRESS`). La tokenización no la necesita, pero no enseñes en el vídeo las funciones de dividendos o de compra de fracciones hasta configurarla.
- [ ] Las herramientas del MCP de las escenas 6, 10 y 11 son las cuatro que hay **hoy** en producción. El catálogo ampliado de la página `/mcp` (preparar operaciones, estado de operaciones, suscripción, coste) aún no está desplegado: no lo anuncies como disponible.
- [ ] Los saldos, cotizaciones y valoraciones del vídeo (350 BEZ, 240.000 USD, etc.) son de ejemplo. Si grabas con datos reales, sustitúyelos por los que salgan.

---

## 📎 Fuentes de los fragmentos reales

Todos los textos entre `«…»` salen de `main`, desplegado en producción el 2026-09-26 (`7765a21c`), salvo donde se indica:

| Fragmento | Fichero |
|---|---|
| Pantalla de consentimiento («Conecta tu asistente con BeZhas», «Autorizar conector», «No podrá mover fondos…») | `backend/routes/oauth-mcp.routes.js` |
| Descripción de los permisos (`chain.read`, `payments.quote`) | `backend/services/oauth/consent.js` |
| Respuesta 401 con `WWW-Authenticate` | Producción, `curl` a `https://mcp.bezhas.com/mcp` (2026-09-26) |
| Herramientas del MCP y sus descripciones | `packages/mcp-server/src/tools/payment-tools.ts`, `analyzeGasStrategy.ts`, `blockscoutMcp.ts` |
| Qué herramientas ve cada permiso | `packages/mcp-server/src/public-mcp.ts` |
| Consola de desarrollo y API key («Crear Nueva API Key», «Firmar y Crear API Key», permisos por sector) | `frontend/src/components/developer-console/ApiKeyManagement.jsx` |
| Página RWA («Tokeniza activos reales… ERC-1155») | `frontend/src/pages/RWAPage.jsx` |
| Asistente de 4 pasos, campos y categorías | `frontend/src/components/RealEstateRWAForm.jsx` |
| `tokenizeAsset`, `tokenizationFee`, `AssetTokenized` y las 8 categorías | `frontend/src/hooks/useRWAContracts.js` |
| Tarjetas de beneficios y configuración de cada cliente de IA | `control-center/frontend/app/(landing)/mcp/page.tsx` (rama `feat/seguridad-transaccional-mcp`) |
