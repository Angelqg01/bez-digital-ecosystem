# Guiones de Video — Tutoriales BeZhas

Scripts listos para grabar. Cada video esta pensado para ser corto, directo y con demostracion en pantalla.

---

## Video 1: Introduccion a BeZhas — 3 Formas de Integrar

**Duracion:** 3 minutos
**Audiencia:** Cualquier cliente nuevo
**Formato:** Presentacion + capturas de pantalla

### Guion

[00:00 - 00:30] INTRO
"Bienvenido a BeZhas, el ecosistema blockchain empresarial B2B.
En este video te voy a mostrar las 3 formas que tienes para integrar BeZhas
en tu plataforma. Da igual si tienes una tienda online, un ERP corporativo
o una app movil — hay un metodo para ti."

[00:30 - 01:00] METODO 1: API REST
"El primer metodo es la API REST. Es ideal si tienes un backend propio y
quieres control total. Haces peticiones HTTP a nuestros endpoints, recibes
JSON, y configuras webhooks para recibir eventos. Funciona con cualquier
lenguaje: Python, Java, Go, PHP, Node.js... lo que uses."

Mostrar en pantalla: curl al endpoint /health, respuesta JSON

[01:00 - 01:30] METODO 2: SDK JAVASCRIPT
"El segundo metodo es nuestro SDK para JavaScript, el paquete @bezhas/connect.
Lo instalas con un npm install, inicializas con tu API Key, y ya tienes
metodos listos para hacer pagos, crear transacciones logisticas y verificar
webhooks. Zero dependencias. Funciona en Node.js y en el navegador."

Mostrar en pantalla: pnpm add, codigo de inicializacion

[01:30 - 02:00] METODO 3: PLUGIN WORDPRESS
"Y si tienes una tienda en WordPress con WooCommerce, el tercer metodo
es nuestro plugin. Lo descargas, lo subes a WordPress, pegas tu API Key
en los ajustes y ya esta. Tus clientes pueden pagar con tarjeta, banco o
cripto directamente desde el checkout. Sin codigo."

Mostrar en pantalla: WordPress admin, upload plugin, settings

[02:00 - 02:40] LAS 13 SUBAPPS
"Ademas, BeZhas tiene 13 aplicaciones especializadas:
CargoLink para logistica, BeZhas Pay para pagos, BZ Capital para DeFi,
BZ Energy para energia, y muchas mas. Cada una se accede desde la API,
el SDK o directamente por URL."

Mostrar en pantalla: grid de 13 SubApps con iconos

[02:40 - 03:00] CIERRE
"Para empezar, ve a hub.bez.digital/client-guides. Ahi tienes
guias paso a paso para cada metodo. Y si tienes dudas, nuestro
soporte responde en menos de 2 horas. Gracias por ver el video."

Mostrar en pantalla: URL de las guias

---

## Video 2: Integracion API REST — Paso a Paso

**Duracion:** 5 minutos
**Audiencia:** Desarrolladores backend
**Formato:** Screencast con terminal + editor de codigo

### Guion

[00:00 - 00:45] OBTENER API KEY
"Vamos a integrar BeZhas usando la API REST. Lo primero: necesitas una
API Key. Ve a hub.bez.digital/developers, haz click en 'Generar API Key'
y copiala. Esta clave es como tu contrasena de acceso a la API, asi que
guardala en un archivo .env y nunca la subas a git."

Demo en pantalla:
- Abrir hub.bez.digital/developers
- Click generar
- Copiar key
- Crear archivo .env

[00:45 - 01:30] GUARDAR CREDENCIALES
"Crea un archivo .env con tres variables: la API Key, la URL base, y el
webhook secret que vas a necesitar despues."

Mostrar codigo:
```
BEZHAS_API_KEY=bez_key_xxxxxxxxxxxxxxxx
BEZHAS_API_URL=https://api.bez.digital:3001
BEZHAS_WEBHOOK_SECRET=wh_secret_yyyyyyyyyyy
```

[01:30 - 02:15] PRIMERA LLAMADA
"Ahora vamos a verificar que todo funciona. Abre tu terminal y haz
un curl al endpoint /health con tu API Key en el header. Si ves
'status: ok', estas conectado."

Demo en terminal:
```bash
curl -H "x-api-key: $BEZHAS_API_KEY" \
  https://api.bez.digital:3001/health
```

[02:15 - 03:00] CREAR UN PAGO
"Perfecto. Ahora vamos a crear un pago real. Hacemos un POST a
/api/gateway/v1/pay con el monto, el metodo de pago y el email del
cliente. La respuesta incluye un checkoutUrl al que redirigir al
usuario."

Demo en terminal:
```bash
curl -X POST \
  -H "x-api-key: $BEZHAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amountUSD":100,"paymentMethod":"card","email":"demo@ejemplo.com"}' \
  https://api.bez.digital:3001/api/gateway/v1/pay
```

[03:00 - 03:45] CREAR TRANSACCION LOGISTICA
"Si tambien necesitas logistica, el endpoint es /api/cargolink/transactions.
Le pasas la referencia de tu pedido, el origen y el destino. BeZhas te
devuelve un txId que puedes usar para rastrear el envio."

Demo en terminal con curl

[03:45 - 04:30] CONFIGURAR WEBHOOKS
"Ahora la parte importante: los webhooks. Cuando un pago se completa o
un cargo se entrega, BeZhas te avisa. Tu servidor necesita un endpoint
que reciba el POST, verifique la firma HMAC-SHA256 y procese el evento."

Mostrar codigo de verificacion en editor

[04:30 - 05:00] CHECKLIST PRODUCCION
"Antes de ir a produccion, verifica:
1. API Key en .env, no en codigo
2. Webhook secret configurado
3. Verificacion de firma en todos los webhooks
4. Rate limiting: maximo 1000 peticiones por minuto
5. Logs activos para monitorizar

Y listo. Tu integracion esta completa."

---

## Video 3: SDK @bezhas/connect — Quick Start

**Duracion:** 4 minutos
**Audiencia:** Desarrolladores frontend y Node.js
**Formato:** Screencast con editor + terminal

### Guion

[00:00 - 00:30] INSTALAR
"Vamos a integrar BeZhas con el SDK de JavaScript. Es un paquete npm
sin dependencias que funciona tanto en Node.js como en el navegador.
Instalamos con pnpm add @bezhas/connect."

Demo: pnpm add en terminal

[00:30 - 01:00] INICIALIZAR
"Importamos BeZhasConnect, creamos una instancia con nuestra API Key
y ya tenemos acceso a todas las interfaces: pay para pagos, cargolink
para logistica, y webhooks para verificar eventos."

Mostrar codigo en editor

[01:00 - 02:00] PAGOS
"Para hacer un pago con tarjeta, llamamos a bezhas.pay.buy con el
monto, el metodo 'card' y el email. Nos devuelve un checkoutUrl.
Para banco, cambiamos el metodo a 'bank' y nos devuelve el IBAN."

Demo: ejecutar codigo, mostrar respuesta

[02:00 - 03:00] LOGISTICA
"Para logistica, primero necesitamos un role key. Creamos un cliente
con ese rol usando withRoleKey. Luego createTx para crear la
transaccion y advanceTx para avanzar el estado."

Demo: crear transaccion, avanzar estado

[03:00 - 03:30] WEBHOOKS
"Para verificar webhooks, importamos la funcion webhooks del SDK.
verifyAndParse recibe el body crudo, la firma del header y tu secret.
Si la firma no coincide, lanza un error."

Mostrar codigo en editor

[03:30 - 04:00] EJEMPLO REACT
"Aqui tienes un componente React completo: un boton de pago que llama
a bezhas.pay.buy y redirige al checkout. Copia este codigo y adaptalo
a tu app."

Mostrar componente React PaymentButton

---

## Video 4: Plugin WordPress — Setup en 5 Minutos

**Duracion:** 3 minutos
**Audiencia:** Duenos de tiendas online
**Formato:** Screencast de WordPress Admin

### Guion

[00:00 - 00:30] DESCARGAR
"Si tienes una tienda en WordPress, integrar BeZhas es super facil.
Ve a hub.bez.digital/downloads y descarga el plugin. Es un archivo
ZIP que pesa unos pocos kilobytes."

Demo: abrir hub, click descargar

[00:30 - 01:00] INSTALAR
"En tu WordPress, ve a Plugins, 'Anadir nuevo', 'Subir plugin'.
Selecciona el ZIP que descargaste. Click 'Instalar ahora' y luego
'Activar'. Ya esta instalado."

Demo: WordPress admin, upload, activar

[01:00 - 01:30] CONFIGURAR API KEY
"Ahora ve a Ajustes, 'Configuracion BeZhas'. Aqui necesitas pegar
tu API Key. Si no tienes una, ve a hub.bez.digital/developers y
genera una. Copia, pega, y guarda."

Demo: settings panel, pegar key

[01:30 - 02:00] ACTIVAR PAGOS
"Si usas WooCommerce, ve a WooCommerce > Ajustes > Pagos. Activa
'BeZhas Pay'. Tus clientes ahora pueden pagar con tarjeta, banco
o criptomoneda."

Demo: WooCommerce settings

[02:00 - 02:30] PROBAR
"Vamos a hacer una compra de prueba. Agrego un producto al carrito,
voy al checkout, selecciono BeZhas Pay... y el pago se procesa.
Puedo ver la transaccion en el dashboard del plugin."

Demo: compra de prueba completa

[02:30 - 03:00] CIERRE
"Y ya esta. Tu tienda acepta pagos con BeZhas. En el dashboard
puedes ver estadisticas de pagos, ultimas transacciones y el estado
de cada pedido. Si tienes dudas: support@bez.digital."

---

## Video 5: Autenticacion y Seguridad

**Duracion:** 4 minutos
**Audiencia:** Todos los integradores
**Formato:** Presentacion + diagramas

### Guion

[00:00 - 00:45] TRES FORMAS
"Antes de usar cualquier SubApp de BeZhas, necesitas autenticarte.
Hay 3 formas: SIWE si tienes wallet, Email con 2FA si prefieres
lo tradicional, y API Key si eres un servidor."

Mostrar diagrama de las 3 opciones

[00:45 - 01:30] SIWE
"SIWE significa Sign In With Ethereum. Conectas tu wallet — MetaMask
por ejemplo — y firmas un mensaje. No es una transaccion, no cuesta
gas. BeZhas verifica tu firma y te da un token JWT. Es el metodo
mas seguro porque no hay contrasena que robar."

Diagrama: wallet -> firma -> JWT

[01:30 - 02:15] EMAIL + 2FA
"Si prefieres email, ingresas tu correo y contrasena. Luego recibes
un codigo por SMS o en tu app de autenticacion. Lo confirmas y
recibes tu JWT. El 2FA es obligatorio — protege tu cuenta."

Diagrama: email -> password -> 2FA -> JWT

[02:15 - 03:00] API KEY
"Para integraciones server-to-server, usas una API Key. La generas
en el Developer Console y la incluyes en cada peticion como header
x-api-key. La key tiene scopes: puede ser solo lectura, escritura,
o admin."

Diagrama: API Key -> header -> validacion -> respuesta

[03:00 - 03:30] JWT EXPLICADO
"El token JWT contiene tu userId, tu orgId, tus permisos y una fecha
de expiracion. Caduca en 24 horas. Para renovarlo, usas el refresh
token que dura 30 dias. Nunca guardes tokens en localStorage en
produccion — usa httpOnly cookies."

Mostrar estructura del JWT

[03:30 - 04:00] BUENAS PRACTICAS
"Para terminar, 5 reglas de seguridad:
1. Activa 2FA siempre
2. Guarda API Keys en .env, nunca en codigo
3. Rota tus keys cada 90 dias
4. Verifica la firma de todos los webhooks
5. Usa HTTPS en todos tus endpoints

Siguiendo estas reglas, tu integracion sera segura."

---

## Notas de Produccion

**Formato recomendado para grabar:**
- Resolucion: 1920x1080
- Audio: microfono externo, sin musica de fondo
- Screencast: OBS Studio o Loom
- Edicion: cortar pausas, anadir subtitulos

**Subtitulos:**
Todos los videos deben tener subtitulos en espanol e ingles.

**Donde publicar:**
1. YouTube (canal BeZhas)
2. hub.bez.digital/learn
3. Embeber en la pagina /client-guides del Hub

**Proximos videos (fase 2):**
- CargoLink: integracion completa con WooCommerce
- Energy VPP: configurar trading automatico
- Genesis: verificacion de identidad
- Capital: staking paso a paso

---

**Ultima actualizacion: Junio 2026**
