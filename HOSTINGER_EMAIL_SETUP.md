# Correo de BeZhas en Hostinger (bezhas.com)

**Estado verificado el 2026-09-21** contra la API de Hostinger, los registros DNS y un
envío real. Sustituye a la versión anterior, que describía buzones que no existen.

## Qué hay contratado

| Elemento | Valor |
|:---|:---|
| Plan | Starter Business Email (`business_s_v2`), **1 asiento**, hasta 2027-09-19 |
| Buzón | `yoelceo@bezhas.com` (el único) |
| Alias creados | `ventas@` · `facturacion@` · `support@` · `marketing@` · `infrastructure@` |

Las direcciones por departamento son **alias** del buzón, no buzones. Hostinger
rechaza con `553 5.7.1 Sender address rejected: not owned by user` cualquier remitente
que no sea el buzón o uno de sus alias.

**Decisión (2026-09-21): se usan solo las direcciones que ya existen, sin crear alias
nuevos.** El perfil de OPERANT (`business-ops/config/business/bezhas.json`) queda así:

| Departamento | Remitente |
|:---|:---|
| Ventas | `BeZhas · Ventas <ventas@bezhas.com>` |
| Soporte | `BeZhas · Soporte <support@bezhas.com>` |
| Marketing | `BeZhas · Marketing <marketing@bezhas.com>` |
| Finanzas | `BeZhas · Facturación <facturacion@bezhas.com>` |
| Blockchain | `BeZhas · Infraestructura <infrastructure@bezhas.com>` |
| RRHH, Operaciones, Legal, Tesorería, Fundraising y general | `BeZhas <yoelceo@bezhas.com>` (sin etiqueta de departamento, para no hacer creer al destinatario que escribe a un área concreta) |

Las respuestas caen siempre en el mismo buzón, sea cual sea el alias.

## Servidores

| Uso | Host | Puerto |
|:---|:---|:---|
| SMTP (envío) | `smtp.hostinger.com` | 465, SSL/TLS |
| IMAP (lectura, carpeta Enviados) | `imap.hostinger.com` | 993, SSL/TLS |

`mail.hostinger.com` **no sirve** para SMTP: resuelve a un frontal de Cloudflare con los
puertos de correo cerrados y el cliente se queda colgado.

## DNS de `bezhas.com`

| Registro | Estado |
|:---|:---|
| MX | `mx1.hostinger.com` (5) y `mx2.hostinger.com` (10) — correcto |
| SPF | `v=spf1 include:_spf.mail.hostinger.com ~all` — correcto |
| DKIM | 3 CNAME `hostingermail-a/b/c._domainkey` → `hostingermail-*.dkim.mail.hostinger.com`, con clave publicada — correcto |
| DMARC | `v=DMARC1; p=quarantine; sp=quarantine; pct=100; adkim=r; aspf=r; rua=mailto:yoelceo@bezhas.com` — subido de `p=none` el 2026-09-21 |

**Alineación comprobada con cabeceras reales** (correos recibidos en Gmail, enviados
como alias y como buzón): `spf=pass` con `smtp.mailfrom` en `bezhas.com` (el Return-Path
es la dirección de origen, así que SPF está alineado), `dkim=pass` con `d=bezhas.com` y
selector `hostingermail-a` (clave RSA de 2048 bits), y `dmarc=pass`. DMARC pasa por los
dos mecanismos a la vez, por eso la política estricta es segura para el correo de Hostinger.
Los selectores `b` y `c` son de rotación y aún no tienen clave. El correo va por el relé
de MailChannels con TLS 1.3 y llegó a la bandeja de entrada, no a spam.

El cambio de DMARC tarda hasta 1 h en verse en Gmail (TTL 3600): el primer correo tras el
cambio aún mostraba `p=NONE` por la caché. Cada cambio de zona deja un snapshot en
Hostinger; el estado anterior era el de `_dmarc` = `"v=DMARC1; p=none"`.

## Los envíos no aparecían en "Enviados"

Un envío por SMTP entrega el correo pero **no guarda copia** en el buzón del remitente:
eso lo hacen los clientes de correo (el webmail sí lo hace). Hostinger marcaba todos
los envíos como `Delivered` y `INBOX.Sent` seguía vacía.

`EmailConnector` (`business-ops/src/connectors/EmailConnector.js`) añade ahora por IMAP
el mismo mensaje (mismo Message-ID y fecha) a la carpeta `\Sent` tras cada envío. Si ese
guardado falla, se reintenta una vez y, si sigue fallando, el envío **no** se repite: el
resultado trae `sentCopy: { saved: false, reason }`.

Los 8 seguimientos del 2026-09-20 a fondos crypto se recuperaron en "Enviados" a partir
del log de salida de Hostinger. Llevan la cabecera `X-BeZhas-Backfill` y un Message-ID
nuevo, porque el original no se conservó.

## Activarlo en OPERANT

En `business-ops/.env` (la contraseña es la del buzón; no se guarda en el repositorio):

```env
# RESEND_API_KEY debe estar vacía o sin definir: si está puesta, gana a SMTP.
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=yoelceo@bezhas.com
SMTP_PASS=
MAIL_FROM=BeZhas <yoelceo@bezhas.com>
# Opcionales (se deducen): IMAP_HOST=imap.hostinger.com  IMAP_PORT=993
#   IMAP_SENT_FOLDER=INBOX.Sent  SAVE_SENT_COPY=true
```

Cada agente envía con el alias de su departamento (`BusinessProfile.senderFor`, definido
en `business-ops/config/business/bezhas.json`).

## Comprobar que funciona

```bash
# Envía una prueba desde cada alias que existe y confirma la copia en Enviados
node business-ops/test/hostinger-email-test.js tu@correo.com
```

En Hostinger: log de salida (`mail_listOutboundLogsV1` en el MCP de Hostinger, o hPanel) y
la carpeta `INBOX.Sent` del buzón.

## Pendiente

1. **DMARC a `p=reject`** tras 2-4 semanas de informes agregados limpios en el buzón. Si
   aparece algún otro servicio enviando como `@bezhas.com` sin pasar por Hostinger, hay
   que autorizarlo (SPF/DKIM) antes de endurecer.
2. **API (`api/services/channelService.js`):** su remitente por defecto era
   `noreply@bez.digital` (dominio caducado, y Hostinger lo habría rechazado). Ahora es
   `BeZhas <support@bezhas.com>`; con Hostinger hay que definir `SMTP_HOST=smtp.hostinger.com`,
   `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASS` y, si se quiere otro
   remitente, `SMTP_FROM` (siempre el buzón o un alias). Este camino no guarda copia en
   Enviados: los mensajes quedan registrados en la tabla `messages` de la base de datos.
3. **Deck de inversores:** `create_deck.js` (línea 967) imprime `investors@bez.digital` y
   un teléfono de relleno. `investors@` no existe y `bez.digital` está caído: los correos de
   un inversor rebotarían. Hay que poner una dirección real (por ejemplo `yoelceo@bezhas.com`)
   y regenerar el deck.
4. **Recepción por webhook** (`/webhooks/email-inbound`): sin configurar. Depende de que
   la API esté en pie; `api.bez.digital` sigue caído.
5. **Prácticas para llegar a la bandeja de entrada:** empezar con volumen bajo y
   personalizado (el buzón tiene 2 días), mantener el mismo nombre y remitente, incluir
   una salida clara ("responde «no» y no vuelvo a escribir") y no usar acortadores de
   enlaces ni imágenes en el primer contacto. Para envíos en frío, `send()` acepta
   `headers` (por ejemplo `List-Unsubscribe: <mailto:yoelceo@bezhas.com?subject=baja>`).
6. **Un solo asiento:** si algún departamento necesita bandeja propia (no solo alias),
   hay que ampliar el plan.
