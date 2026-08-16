# Correo propio — qué falta y en qué orden

Estado: **Stalwart configurado y sirviendo**. El asistente de instalación está
completado y, tras reiniciar el contenedor para que leyera la configuración, el
servidor saluda de verdad:

```
25:  220 mail.bez.digital Stalwart ESMTP at your service
465: 220 mail.bez.digital Stalwart ESMTP at your service   (TLS)
993: * OK [CAPABILITY IMAP4rev2 ...]
DKIM signature created  id = "v1-ed25519-20260815" / "v1-rsa-20260815"  bez.digital
```

Queda **el buzón emisor** (paso 1) y **el DNS** (paso 3).

### Dos cosas que conviene no olvidar

**El 587 no está publicado.** El compose de `operant-saas` solo mapea 25, 465,
993 y 8080. Un `SMTP_PORT=587` da «conexión rechazada» y parece que el servidor
está caído cuando en realidad no hay puente. Se usa el **465**.

**El certificado es autofirmado.** Stalwart avisa `No TLS certificates
available` — el TLS automático se dejó apagado porque Let's Encrypt no puede
validar `localhost`. Por eso `SMTP_TLS_REJECT_UNAUTHORIZED=false`, y sólo
mientras el destino sea localhost.

---

## 1. Crear el buzón emisor  (tuyo)

En **http://localhost:8080** → `Settings` → `Accounts`, un buzón para
`hola@bez.digital`. **No sirven las credenciales del administrador**: el envío
se autentica con las del buzón.

Está comprobado contra el servidor — una transacción cortada antes del `DATA`,
sin llegar a enviar nada:

```
-> MAIL FROM:<hola@bez.digital>     <- 250 2.1.0 OK
-> RCPT TO:<destino@example.com>    <- 550 5.1.2 Relay not allowed.
```

Sin autenticar, Stalwart rechaza el relay. De ahí que el usuario y la clave no
sean opcionales.

> No lo hace el asistente: crear cuentas y fijar contraseñas queda fuera de lo
> que ejecuta.

## 2. Conectar business-ops  (una línea)

En el `.env` de la raíz, puerto, TLS y remitente ya están puestos. Rellenar las
credenciales del buzón del paso 1 y descomentar el host:

```
SMTP_HOST=localhost      # o `mail` si Stalwart entra en el compose de BeZhas
SMTP_PORT=465
SMTP_TLS_REJECT_UNAUTHORIZED=false
SMTP_USER=<buzón>
SMTP_PASS=<contraseña del buzón>
SMTP_FROM=hola@bez.digital
```

`SMTP_HOST` se dejó comentado **a propósito**. Con el host puesto y sin
credenciales el conector saldría de simulado y `verify()` pasaría —la conexión
sí abre—, pero cada envío moriría en el `RCPT`. Es exactamente la falsa
confianza contra la que avisa `EmailConnector.js`, y es peor que el simulado,
que al menos devuelve `sent: false`.

Y reiniciar: `docker compose up -d business-ops`.

Comprobar sin enviar nada:

```bash
curl -s localhost:4000/healthz | jq .email
```

- `mode: "smtp"` + `reachable: true` → el canal existe de verdad
- `mode: "smtp"` + `reachable: false` → **degradado**: lo reporta y no da por
  enviado lo que no salió
- `mode: "simulado"` → sigue sin `SMTP_HOST`

## 3. DNS de bez.digital  (tuyo — lo que de verdad decide)

Sin estos registros, un correo a un cliente real acaba en spam o rebotado por
mucho que el SMTP funcione:

| Registro | Para qué |
|---|---|
| **MX** | dónde se recibe el correo del dominio |
| **SPF** | qué servidores pueden enviar en su nombre |
| **DKIM** | firma que prueba que el mensaje no se alteró |
| **DMARC** | qué hacer con lo que falle SPF o DKIM |

Orden recomendado: SPF y DKIM primero, DMARC en `p=none` para observar, y
endurecerlo a `quarantine` cuando el informe salga limpio.

**Las claves DKIM ya están generadas** (`v1-ed25519-20260815` y
`v1-rsa-20260815`, ambas para `bez.digital`). Lo que hay que publicar es la
parte *pública*, y Stalwart la da hecha en formato de registro DNS:

> panel → `Settings` → `Domains` → `bez.digital` → **DNS records**

Ahí salen MX, SPF, DKIM y DMARC listos para copiar al proveedor de DNS. Hay que
entrar autenticado; no se pueden sacar del store por fuera (RocksDB comprimido,
y la imagen no trae CLI: `/usr/local/bin` solo contiene el binario `stalwart`).

---

## Por qué el modo simulado no miente

Un envío simulado devuelve `sent: false`, no `true`. Es deliberado: quien lo
consume (`LeadFunnel`, seguimientos) contaba envíos que nunca salieron. Hasta
que el paso 2 esté hecho, Ventas redacta borradores y **ninguno sale** — y el
sistema lo dice en vez de aparentar lo contrario.

Y aunque salga: todo primer contacto en frío pasa por HITL. El correo se manda
cuando un humano lo aprueba, no antes.
