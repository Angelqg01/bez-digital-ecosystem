# Vídeo «Tokenización de propiedades en BeZhas» — guion de producción

| | |
|---|---|
| Audiencia | Inversores y directivos de inmobiliarias |
| Formato | 16:9, 1080p · versión larga (≈ 4 min) y corte de ≈ 80 s para redes |
| Idioma | **Locución en inglés** (voz sintética edge-tts, `en-US-ChristopherNeural`) · **subtítulos en español** incrustados (y SRT en ES y EN) |
| Estilo | Oscuro y moderno con la paleta de BeZhas (teal `#00D4AA`, oro `#FFD700`, rosa `#FF6B9D`; Syne y Space Mono): escenas gráficas animadas y pantallas reales con cursor, marca de paso y resaltes |
| Qué se enseña | Asistente de tokenización del Hub → venta y rentas en BZ Capital → herramienta MCP de tokenización |
| Entorno | Cadena local de demostración (chain id 137), rotulada «Demonstration environment» en todo el vídeo. **No** hay nada en Polygon |
| Cierre | bezhas.com y «conecta el MCP de BeZhas a tu IA favorita» |

Texto exacto de la locución y de los subtítulos: [`scenes.en.json`](scenes.en.json).

---

## 1. Reglas de veracidad

| Se dice (verificado en el código) | No se dice | Por qué |
|---|---|---|
| Fracciones ERC-1155 en Polygon; BeZhas no las custodia; cada operación la firma la wallet de cada parte | «Título de propiedad en la blockchain», «regulado», «auditado» | Se registra la huella de los documentos; los derechos los define la estructura legal de cada oferta |
| El emisor **declara** valoración y rendimiento; el rendimiento no está garantizado | «Rentabilidad garantizada» | Es una cifra declarada |
| Precio del BEZ: 0,0075 USD, **precio fijo de la fase semilla, no de mercado** (`api/config/bez-price.js`). El asistente sugiere el precio por fracción que cuadra con la valoración | Una cotización «de mercado» | BEZ aún no tiene pool de liquidez |
| Tarifa de tokenización: 100 BEZ (< 1 USD) | — | Es la comisión vigente de la fábrica |
| La venta paga al emisor en BEZ menos una comisión y entrega las fracciones en la misma operación | Cifra de la comisión | Se fija al desplegar; en la demo es 2,5 % y no se enseña |
| El reparto de rentas se calcula a prorrata en el bloque de corte; el emisor no cobra por lo que conserva; no se cobra dos veces; lo no reclamado vuelve al emisor | «Dividendos automáticos» | Sólo se reparten cuando el emisor los deposita |
| KYC verificado para comprar en inmuebles, hoteles y barcos | «Mercado secundario», «liquidez inmediata» | Hoy sólo hay venta primaria |
| El MCP prepara las transacciones sin firmar; firma la wallet; planes Creator Pro o superiores; funciona con cualquier asistente compatible con MCP | «Tokeniza en minutos» | Hacen falta la documentación legal en IPFS y la estructura legal |

**Datos de la demo:** ático «Penthouse Madrid Centro», valoración 1.200.000 USD, 10.000 fracciones a 16.000 BEZ (= 120 USD) y rendimiento declarado del 5 %. El emisor ofrece 1.000 fracciones; Ana compra 600 (72.000 USD) y Luis 200; el emisor reparte 5.000 USDC y Ana cobra 3.750 USDC. Todo ocurre de verdad en la cadena local; la escena del MCP muestra la respuesta real de la herramienta `bezhas_tokenize_prepare`.

---

## 2. Escenas

| # | Escena | Qué se ve |
|---|---|---|
| T01 | Gancho | Un edificio que se fracciona en piezas de colores; «Un edificio. Diez mil fracciones. Y la renta, repartida entre todos» |
| T02 | El problema | Tres tarjetas: ticket de 1,2 M$, un solo comprador, esperar a un banco |
| T03 | La idea | Propiedad → documentos legales → 10.000 fracciones → wallets; Polygon, sin custodia |
| T04–T07 | Los 4 pasos del asistente | Hub real: tipo de activo, datos y valoración, fraccionar (precio sugerido al precio real del BEZ, rendimiento declarado, tarifa), documentación en IPFS y firma → «Activo creado» |
| T08 | Cumplimiento | Sociedad propietaria, jurisdicción, inversores admitidos, KYC verificado |
| T09 | Vender fracciones | BZ Capital: el emisor publica la oferta; el inversor la ve y compra (BEZ al emisor, fracciones al inversor) |
| T10 | Repartir rentas | BZ Capital: 5.000 USDC, resumen con titulares, comisión y total, firma |
| T11 | Cobrar | BZ Capital: «Cobrar 3750 USDC», un clic, «Ya cobrado» |
| T12 | Tokenizar con tu IA (MCP) | Conversación con un asistente y respuesta real de `bezhas_tokenize_prepare`: dos transacciones para firmar |
| T13 | Todo en la cadena | Eventos reales de la demo (tokenización, oferta, compra, reparto, cobro) |
| T14 | Cierre | «Tokenize · Fraction · Sell · Distribute» · bezhas.com · conecta el MCP a tu IA favorita |

**Pie legal (visible de principio a fin):** «Entorno de demostración. Activos, importes y rentabilidades de ejemplo; las rentabilidades las declara el emisor y no están garantizadas. No es asesoramiento financiero ni una oferta de valores.» (en inglés en pantalla, con los subtítulos en español sobre él).

## 3. Producción

```bash
cd marketing/video-tokenizacion/pipeline
./demo_env.sh up            # cadena, contratos, API de demostración y sesiones (en segundo plano: no cierra la terminal)
python3 voice.py && python3 voice.py --short
python3 record.py           # hub → venta → rentas_emisor → rentas_titular → graficos (el orden importa: la cadena avanza)
python3 assemble.py         # larga, ligera (720p) y corte corto
```

Hacen falta el Hub en :5175 (`VITE_API_PROXY=http://localhost:3021`, `VITE_RWA_FACTORY_ADDRESS=<fábrica de la demo>`) y BZ Capital en :3014 con `NEXT_PUBLIC_API_URL=http://localhost:3021`.
