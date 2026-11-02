# Vídeos «Cómo funciona BeZhas» — guiones

| Archivo | Formato | Duración |
|---|---|---|
| `BeZhas-como-funciona.mp4` (+ `-ligero`) | 16:9 1080p, ES | 8:39 |
| `BeZhas-how-it-works.mp4` (+ `-ligero`) | 16:9 1080p, EN | 8:34 |
| `BeZhas-short-es.mp4` | 9:16 1080×1920, ES | 0:50 |
| `BeZhas-short-en.mp4` | 9:16 1080×1920, EN | 0:50 |

Datos sacados de `api/config/plans.js`, `plan-entitlements.js`, `public-kb.js` y la sección OPERANT de CLAUDE.md. Las cifras de las maquetas son de demostración y se rotulan así.
Para cambiar un texto: editar el `.json` correspondiente y volver a lanzar `pipeline/render.sh` (ver cabecera del script). Todo se renderiza en la RTX: Chromium por EGL y NVENC.

## Vídeo completo (ES)

### BeZhas

**0:00 — Tu empresa es una isla. BeZhas es el puerto común.**

> Tu empresa es una isla. Proveedores, bancos, aduanas y clientes trabajan cada uno con su sistema, sus papeles y sus tiempos. BeZhas es el puerto común. Soy el responsable de marketing de BeZhas y en los próximos minutos te voy a enseñar cómo funciona toda la plataforma, cada aplicación, cada plan y lo que gana cada sector y cada cargo de tu empresa.

### La plataforma

**0:23 — Cuatro capas, una sola cuenta**

> BeZhas se apoya en cuatro capas. Abajo, la blockchain: BEZ-Coin, nuestro token ERC-20 en Polygon, y los contratos de pagos, escrow, tokenización y gobernanza. Encima, la inteligencia artificial: OpenClaw coordina varios modelos y un conector MCP permite que tu propia IA trabaje con BeZhas. Después, las SubApps, una para cada necesidad. Y arriba, OPERANT, agentes de IA que trabajan por departamentos. Todo con una sola cuenta y una sola factura.

### Cómo empezar

**0:57 — De cero a operando en cinco pasos**

> Empezar es sencillo. Uno: das de alta tu empresa y verificas la identidad. Dos: eliges un plan. Tres: el Hub y la Wallet vienen incluidos en cualquier suscripción. Cuatro: activas las SubApps que necesitas, solo esas. Y cinco: conectas BeZhas con tus sistemas por API o SDK, o directamente con tu asistente de IA a través del conector MCP.

### Planes

**1:23 — Un plan para cada etapa**

> Hay cuatro planes. Starter es gratis: quince días de prueba y después pagas solo lo que usas. Creator Pro, noventa y nueve euros al mes, para pymes y creadores: tiempo real y primeras operaciones con cripto. Business, cuatrocientos noventa y nueve euros: razonamiento avanzado, histórico de mercado, ERP gestionado y cero retención de datos. Y Enterprise VIP, dos mil cuatrocientos noventa y nueve euros, para holdings e instituciones, con agentes en paralelo, nodo dedicado y transferencias de euro a euro. Si pagas con BEZ-Coin, ahorras un veinte por ciento, y en anual tienes dos meses gratis.

**2:03 — Qué cambia de verdad al subir de plan**

> Y no es solo un contador de uso. Cada plan abre carriles de dinero con techos claros. A partir de cierto importe hace falta la aprobación firmada de una persona, y por encima, de dos personas distintas. Así tu equipo opera rápido en el día a día y la dirección mantiene el control en las operaciones grandes.

### SubApps

**2:24 — BeZhas-Hub**

> Empezamos el recorrido por las SubApps. BeZhas-Hub es la puerta de entrada: el perfil verificado de tu empresa, un marketplace de servicios B2B y la comunidad del ecosistema. Aquí encuentras socios que ya han pasado verificación, en lugar de empezar de cero con cada proveedor.

**2:43 — BEZ Wallet**

> La BEZ Wallet también viene incluida. Es una billetera no custodial: las claves son de tu empresa, no nuestras. La empresa puede patrocinar el gas para que sus empleados no necesiten cripto para operar, y si alguien pierde el acceso, los guardianes que tú designes lo recuperan.

**3:01 — BeZhas Pay**

> BeZhas Pay es tu caja registradora. Creas páginas de pago alojadas, gestionas reembolsos y, si vendes online, lo conectas con un plugin de WordPress. Tu cliente paga con tarjeta, con transferencia SEPA o con BEZ-Coin, y la liquidación queda registrada en Polygon.

**3:20 — BeZhas-DeFi**

> BeZhas-DeFi es la tesorería Web3 de tu empresa: staking y farming de BEZ, puente entre redes, liquidez y la DAO, donde las empresas votan las actualizaciones de la red. Y desde la API, el SDK o tu IA puedes cambiar BEZ sin salir de tus sistemas. El gasto en infraestructura pasa a ser un activo que participa en la red.

**3:42 — BZ PureScan**

> BZ PureScan pone ojos a tu cadena de suministro. La visión artificial escanea productos y documentos, el Food Oracle verifica la calidad alimentaria y cada activo puede tener un gemelo digital inmutable. Si alguien pregunta de dónde viene un lote, la respuesta ya está en la cadena.

**4:01 — BEZ-Energy**

> BEZ-Energy tokeniza la energía. Los certificados de ahorro energético, los créditos de carbono y los datos ESG se convierten en activos verificables, y las empresas pueden intercambiar energía entre ellas en un mercado P2P.

**4:17 — BZ-CargoLink**

> BZ-CargoLink es logística y aduanas en cadena. Cada envío tiene su NFT con todo su historial, el pago queda en un escrow que se libera solo cuando la entrega se confirma, y el despacho aduanero se puede verificar sin perseguir papeles.

**4:33 — OPERANT**

> Y OPERANT, la gestión empresarial autónoma. Son agentes de IA que trabajan por departamentos: ventas, soporte, finanzas, legal y más. En Starter preparan borradores; en Creator Pro te asisten; en Business trabajan de forma autónoma; y en Enterprise VIP su autonomía la gobierna la DAO. Cada acción queda auditada y anclada en la blockchain.

### Tu IA + BeZhas

**4:57 — Tu IA ya sabe usar BeZhas**

> Todo esto también funciona desde tu asistente de IA. Conectas Claude, ChatGPT, Cursor o tu propio agente al servidor MCP de BeZhas y le preguntas en lenguaje natural. Él consulta, resume y prepara operaciones. Pero nunca firma ni mueve fondos por su cuenta: eso lo hace siempre una persona.

### Por sector

**5:18 — Logística y aduanas**

> Veamos cada sector. En logística y aduanas, el envío sale con su NFT, PureScan verifica la carga en origen, la aduana consulta el historial en la cadena y, al confirmarse la entrega, el escrow paga al transportista. Sin esperar facturas ni conciliaciones. Recomendamos Business por el volumen de llamadas y el paso de cripto a euros.

**5:41 — Energía**

> En energía, la producción se registra, se emiten certificados de ahorro y créditos de carbono, se venden en el mercado P2P o se retiran, y el informe ESG sale verificable para el auditor.

**5:54 — Agroalimentario**

> En agroalimentario, cada lote tiene su gemelo digital y el Food Oracle controla la calidad. El distribuidor escanea y ve el origen. Y si hay un problema, la retirada se hace solo sobre los lotes afectados. Una cooperativa puede empezar con Creator Pro.

**6:13 — Inmobiliario y activos reales**

> En inmobiliario y activos reales, el activo se tokeniza en la RWA Factory, se abre una venta primaria por fracciones y los compradores firman desde su propia wallet. Para holdings y gestoras recomendamos Enterprise VIP, con euro a euro y doble aprobación.

**6:30 — Fintech y comercio**

> En fintech y comercio, el checkout acepta tarjeta, SEPA o BEZ, la liquidación es inmediata y los reembolsos se concilian solos. Se empieza en Creator Pro y se pasa a Business para convertir a euros.

**6:44 — Industria**

> Y en industria, cada máquina y cada lote tiene su gemelo digital, los agentes de OPERANT se ocupan de compras y mantenimiento, y la maquinaria tokenizada puede servir de garantía ante un banco.

### Por cargo

**6:57 — CEO**

> Ahora, por cargos. Al CEO, BeZhas le da una red de socios ya verificados, una due diligence inmutable que acorta las fusiones de meses a días, y voto en la DAO sobre el futuro de la red.

**7:11 — CFO**

> Al director financiero, liquidación en tiempo real, techos y aprobaciones por importe para cada operación, y un veinte por ciento de ahorro si paga la suscripción con BEZ-Coin.

**7:23 — Director de Operaciones**

> Al director de operaciones, cada envío y cada lote trazado, pagos que se liberan solos al entregar y agentes que se ocupan del trabajo repetitivo.

**7:33 — CTO**

> Al CTO, una API, un SDK y un conector MCP documentados, hasta mil doscientas llamadas por minuto, ERP gestionado y, en Enterprise, nodo dedicado. Sin montar su propia blockchain.

**7:48 — Legal y Compliance**

> Y a legal y compliance, una plataforma diseñada pensando en MiCA, la AEAT, SEPA y DAC8, con verificación de identidad, cero retención de datos desde Business y una regla que no se negocia: la IA nunca firma.

### BEZ-Coin

**8:02 — BEZ-Coin: combustible, no especulación**

> Todo lo mueve BEZ-Coin. No es especulación: es el combustible que paga el gas de las operaciones, da acceso al staking y al voto en la DAO, y abarata tu suscripción. Se compra con tarjeta o transferencia SEPA en BeZhas Pay. Como decimos a nuestros clientes: el token es la llave del club.

### Empieza hoy

**8:23 — Empieza gratis hoy**

> Tu empresa no tiene por qué seguir siendo una isla. Empieza hoy gratis con Starter, conecta tu IA en mcp punto bezhas punto com y, cuando crezcas, BeZhas crece contigo. Te esperamos en bezhas punto com.

## Short 60 s (ES)

**0:00 — ¿Tu empresa sigue siendo una isla ?**

> ¿Tu empresa sigue siendo una isla? Proveedores, bancos y aduanas, cada uno con su sistema.

**0:07 — BeZhas es el puerto común**

> BeZhas es el puerto común: blockchain, inteligencia artificial y aplicaciones de negocio con una sola cuenta.

**0:14 — apps**

> Pay cobra. CargoLink paga al transportista cuando la carga llega. PureScan verifica cada lote con visión artificial. Energy certifica energía y carbono. Y OPERANT pone agentes de IA en cada departamento.

**0:29 — ia**

> Y se lo pides a tu propia IA. Ella consulta y prepara. Pero nunca firma: eso lo haces tú.

**0:37 — planes**

> Desde cero euros con Starter hasta Enterprise VIP. Y si pagas con BEZ-Coin, ahorras un veinte por ciento.

**0:45 — Empieza gratis**

> Empieza gratis hoy. bezhas punto com.
