# Correo propio (Stalwart) para bez.digital

Runbook para pasar de "el conector de correo existe" a "los correos salen y llegan".
Dominio elegido: **bez.digital**, un buzón por departamento.

> **Estado a 2026-08-11.** El conector está implementado y comprueba el canal solo
> (`EmailConnector.verify()`, `/healthz`). Stalwart arranca en modo bootstrap. Falta el
> paso 2 (configuración inicial), el 3 (DNS) y el 4 (IP con reputación). Hasta entonces la
> plataforma reporta el canal como **degradado** y no da por enviado nada.

---

## 0. Por qué no basta con poner SMTP_HOST

Un `SMTP_HOST` apuntando a un servidor que no responde dejaba a la plataforma creyendo que
podía enviar. Ahora no: el conector hace un handshake real (no un simple "¿el puerto está
abierto?") antes de enviar, y si no hay servicio se declara degradado.

La diferencia importa más de lo que parece. Con Stalwart en modo bootstrap, Docker publica
los puertos 25/465/993 aunque el servicio de correo todavía no atienda: un chequeo de puerto
diría "abierto" y el handshake dice la verdad —
`Client network socket disconnected before secure TLS connection was established`.

Comprobar el estado en cualquier momento:

```bash
curl -s localhost:4000/healthz | jq .email
```

---

## 1. Dominio y buzones

**bez.digital**: el mismo dominio de la web de la empresa. Enviar desde el dominio que el
destinatario reconoce es la mitad de la entregabilidad; un remitente en un dominio distinto
al de la web baja la reputación y despista a quien lo recibe.

Un buzón por departamento, declarado en `config/business/bezhas.json` (sección `email`):

| Departamento | Buzón | Remitente que ve el destinatario |
|---|---|---|
| Ventas | `ventas@bez.digital` | BeZhas · Ventas |
| Soporte | `soporte@bez.digital` | BeZhas · Soporte |
| Marketing | `marketing@bez.digital` | BeZhas · Marketing |
| Finanzas | `facturacion@bez.digital` | BeZhas · Facturación |
| RR.HH. | `rrhh@bez.digital` | BeZhas · RR.HH. |
| Operaciones | `operaciones@bez.digital` | BeZhas · Operaciones |
| Blockchain Ops | `infraestructura@bez.digital` | BeZhas · Infraestructura |
| Legal | `legal@bez.digital` | BeZhas · Legal |
| Tesorería | `tesoreria@bez.digital` | BeZhas · Tesorería |
| Fundraising | `inversores@bez.digital` | BeZhas · Inversores |
| (general) | `hola@bez.digital` | BeZhas |

Cada agente envía desde el buzón de su departamento sin que haya que tocar ni un agente:
lo resuelve `BusinessProfile.senderFor()` y lo inyecta `BaseAgent._execute()`, el único
punto por el que pasan todas las acciones de los 60 especialistas.

**No son `no-reply@`, y es a propósito.** Un correo de Ventas al que no se puede responder
no es una venta, es un anuncio. Cada buzón tiene que ser una bandeja que alguien lea (o
que Chatwoot recoja, perfil `comms`), porque las respuestas llegan ahí.

A día de hoy `bez.digital` resuelve (alojado en Google) pero **no tiene MX, SPF, DKIM ni
DMARC**: no puede enviar ni recibir correo todavía.

> Cuando cambies `MAIL_FROM` en el `.env`, ponlo a `hola@bez.digital`: es el remitente de
> lo que no sale de un departamento concreto (encuestas CSAT, avisos del sistema).

## 2. Levantar Stalwart

```bash
docker compose -f infra/docker-compose.full.yml --profile comms up -d mail
docker logs operant-mail-1        # imprime UNA vez el usuario/contraseña temporales
```

Arranca en modo bootstrap con solo el 8080 abierto. La configuración inicial se hace a mano
en `http://localhost:8080/admin`:

1. Entrar con las credenciales temporales del log.
2. Crear el administrador permanente.
3. Dar de alta el dominio `bez.digital`.
4. Crear los **11 buzones** de la tabla de arriba. La plataforma se autentica con una sola
   credencial SMTP (`SMTP_USER`/`SMTP_PASS`) y envía en nombre de cualquiera de ellos, así
   que en Stalwart hay que permitir que esa cuenta use esos remitentes (en Stalwart:
   dominio → cuenta → *aliases*, o una cuenta de envío con permiso sobre el dominio).
   La lista exacta la da el propio perfil:
   ```bash
   node -e "console.log(require('./src/platform/BusinessProfile').fromFile('bezhas').mailboxes().join('\n'))"
   ```
5. Certificado TLS: con Let's Encrypt cuando el dominio ya apunte al servidor. Mientras
   sea autofirmado, `SMTP_TLS_REJECT_UNAUTHORIZED=false` en el `.env` — y quitarlo después.

Al terminar, Stalwart genera la **clave pública DKIM**, que hace falta para el paso 3.

> Exposición: el compose publica 25, 465, 993 y 8080 en todas las interfaces. En un
> servidor con IP pública, el 8080 (panel de administración) debería quedar en
> `127.0.0.1` y accederse por túnel SSH, como se hace con Langfuse.

## 3. DNS de bez.digital

Cuatro registros. Sustituir `<IP>` por la IP pública del servidor y `<DKIM>` por la clave
que genera Stalwart.

| Tipo | Nombre | Valor |
|---|---|---|
| A | `mail.bez.digital` | `<IP>` |
| MX | `bez.digital` | `10 mail.bez.digital.` |
| TXT | `bez.digital` | `v=spf1 mx a:mail.bez.digital -all` |
| TXT | `<selector>._domainkey.bez.digital` | `v=DKIM1; k=rsa; p=<DKIM>` |
| TXT | `_dmarc.bez.digital` | `v=DMARC1; p=none; rua=mailto:dmarc@bez.digital; adkim=s; aspf=s` |

Notas que evitan los errores típicos:

- **`-all` (hard fail) desde el principio.** Un SPF en `~all` invita a que otros suplanten
  el dominio; el coste de equivocarse es que tus propios correos rebotan, y eso se ve
  enseguida. Peor es enterarte tarde de que alguien te suplanta.
- **DMARC empieza en `p=none`.** Es modo observación: recoges informes sin que nadie
  rechace nada. Pasar a `p=quarantine` y luego a `p=reject` cuando los informes salgan
  limpios un par de semanas.
- El **selector** de DKIM lo decide Stalwart al generar la clave (suele ser `default` o
  uno con fecha). Usa el que te dé, no lo inventes.
- `bez.digital` ya tiene web, que es justo lo que un filtro antispam espera encontrar
  detrás de un dominio que envía. Cuida no romper los TXT de verificación de Google que ya
  están puestos: añade registros, no sustituyas el conjunto.

Verificación después de propagar:

```bash
dig +short MX bez.digital
dig +short TXT bez.digital          # debe aparecer el v=spf1
dig +short TXT _dmarc.bez.digital
```

## 4. IP con reputación

Es lo que decide de verdad si el correo llega, y no depende del código.

- Una IP doméstica o de un VPS barato suele estar en listas negras (Spamhaus PBL/SBL) desde
  antes de que la alquiles. Compruébalo **antes** de montar nada:
  `https://check.spamhaus.org/` y `https://mxtoolbox.com/blacklists.aspx`.
- Hace falta **PTR (DNS inverso)** que resuelva a `mail.bez.digital`. Lo configura el
  proveedor del servidor, no tú desde el DNS del dominio. Sin PTR, Gmail y Outlook
  rechazan directamente.
- Muchos proveedores domésticos y algunos cloud **bloquean el puerto 25 saliente**. Si es
  el caso, no hay servidor propio que valga: hay que pedir el desbloqueo o usar un relay.
- **Alternativa honesta:** un relay de salida (Resend, Postmark, SES) con tu dominio y tu
  DKIM. El conector ya lo soporta — basta `RESEND_API_KEY` y el `.env` deja de necesitar
  SMTP. Sigues siendo dueño del dominio y del contenido; delegas solo la reputación de la
  IP, que es justo la parte que cuesta años construir. Para el volumen de un piloto es la
  opción sensata; el servidor propio tiene sentido cuando el volumen o la soberanía del
  dato lo justifiquen.

## 5. Comprobar de punta a punta

Con el canal ya operativo:

```bash
curl -s localhost:4000/healthz | jq .email     # reachable: true
```

Y para la entregabilidad real, enviar a un buzón de prueba de
[mail-tester.com](https://www.mail-tester.com/) — puntúa SPF, DKIM, DMARC, PTR y listas
negras de una vez. Por debajo de 8/10, no lances campañas.
