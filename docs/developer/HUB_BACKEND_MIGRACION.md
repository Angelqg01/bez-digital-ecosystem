---
estado: vigente
dominio: api
revisado: 2026-11-15
---

# Backend del Hub: qué migrar a Postgres y por qué no se mueve a `api/` en bloque

`App-nativas/Bezhas-Hub/backend` tiene 101 rutas, 91 servicios y 80 ficheros de test. Mover todo a `api/` sería una
reescritura de semanas con mucho riesgo y poco valor. Lo que hace falta es acabar la migración **de Mongo a Postgres**, que
ya está hecha a medias, y dejar el backend donde está.

## Estado medido (2026-11-15)

- La conexión a Mongo es **opcional**: `server.js` sólo conecta si hay `MONGODB_URI` y hace caer a `models/pg/*` (p. ej. `User`)
  si Mongoose no está. 48 módulos ya usan `models/pg`; 25 siguen con modelos de Mongoose.
- De los 37 modelos de Mongoose, **19 ya tienen gemelo en `models/pg`**. Los 18 sin gemelo, por dominio:

| Dominio | Modelos | Rutas/servicios que los usan |
|---|---|---|
| DAO y DeFi | `DAODelegate`, `DAOProposal`, `DAOSettings`, `DAOVote`, `DeFiProposal`, `TreasuryTransaction` | `daoRoutes.js`, `deFi.routes.js` |
| Publicidad | `adBalance`, `advertiserProfile`, `campaign` | `billing`, `campaigns`, `adminAds`, `advertiserProfile`, `stripe-webhook` |
| Puente y OpenClaw | `BridgeApiKey`, `OpenClawClient` | `bridge`, `bridgeAdmin`, `openclaw`, `payment-openclaw-bridge` |
| Otros | `B2BLead`, `Share`, `affiliateEvent`, `contact`, `validation`, `product` | una o dos rutas cada uno |

## Orden recomendado (de menor a mayor riesgo)

1. **Sin dinero ni custodia:** ~~`contact`~~, ~~`affiliateEvent`~~, ~~`B2BLead`~~ (hechos). **`Share`** se migró junto a `Post` (ver arriba). **`validation`** también está migrada (ver arriba). Una ruta cada uno; se prueban con la suite del Hub.
2. **Puente/OpenClaw:** `BridgeApiKey` y `OpenClawClient`. Llevan claves: migrar con hash y no volver a escribir el valor en claro.
3. **Publicidad:** ~~`adBalance`~~, ~~`campaign`~~, ~~`advertiserProfile`~~ (hechos). Los saldos de Mongo no se copian: sólo existían si alguien había recargado, y habría que comprobar si hay saldos reales en producción antes de cortar.
4. **DAO/DeFi:** al final y sólo si la gobernanza sigue en uso; la fuente de verdad es la cadena, esto es caché.

Regla de cada paso: modelo nuevo en `models/pg` + migración SQL + el test de la ruta antes y después, y retirar el modelo de Mongoose al
pasar a producción. Mientras haya un modelo de Mongoose en uso, `MONGODB_URI` tiene que seguir definida en producción.

## Migrados

| Dominio | Fecha | Qué cambió |
|---|---|---|
| `contact` (sincronización de contactos) | 2026-11-15 | Tabla `contacts` (migración 021), `models/pg/Contact.js`, `routes/contacts.routes.js` y `workers/contactSync.worker.js` sobre Postgres; borrado `models/contact.model.js`. Probado contra Postgres real (`tests/integration/contacts-pg.test.js`, 9 casos). Detalle abajo. |

| `affiliateEvent` (afiliados) y `B2BLead` (leads y envío con aprobación) | 2026-11-15 | Tablas `affiliate_events` y `b2b_leads` (migración 022), `models/pg/AffiliateEvent.js` y `models/pg/B2BLead.js`; `routes/affiliate.routes.js` y `services/outbound-messaging.service.js` sobre Postgres; borrados los dos modelos de Mongoose. 10 casos contra Postgres real (`tests/integration/affiliate-b2b-pg.test.js`). |

| Saldo publicitario: `adBalance` y `billingTransaction` (billing, webhook de Stripe y chequeo de saldo de campañas) | 2026-11-15 | Tabla `ad_balances` (migración 023; `billing_transactions` ya existía desde la 006), `models/pg/AdBalance.js`, `services/adTopup.service.js` y `services/bezDepositVerifier.js`; `routes/billing.routes.js`, `routes/stripe-webhook.routes.js` y `routes/campaigns.routes.js` sobre Postgres; borrados los dos modelos de Mongoose. 24 casos contra Postgres real (`tests/integration/ad-balance-pg.test.js`) y 10 sin base en el CI (`tests/bez-deposit-verifier.test.js`). |

| Campañas y anunciantes (`campaign`, `advertiserProfile`: rutas `campaigns`, `adminAds` y `advertiserProfile`) | 2026-11-15 | Tablas `advertiser_profiles` y `ad_campaigns` (migración 024, con los mínimos del esquema como CHECK), `models/pg/Campaign.js` y `models/pg/AdvertiserProfile.js`; las tres rutas sobre Postgres; borrados los dos modelos de Mongoose. 18 casos contra Postgres real (`tests/integration/campaigns-pg.test.js`). |

| Posts, feed social y `Share` (`routes/feed.routes.js`, `routes/share.routes.js`, oráculo de calidad y automatizaciones) | 2026-11-15 | Columnas nuevas en `posts` y tabla `post_shares` (migración 025), `models/pg/Post.js` y `models/pg/Share.js`; las dos rutas y los servicios `oracle`, `automation-engine`, `diagnosticAgent` y `rewardSystem` sobre Postgres; borrados `post.model.js` y `Share.js`. 16 casos contra Postgres real (`tests/integration/posts-shares-pg.test.js`). |

**Lo que se encontró al migrar el feed y los compartidos (varios son vulnerabilidades):**
- **Suplantación:** crear un post, dar «me gusta» y comentar tomaban el `author` del cuerpo **sin exigir sesión**: cualquiera podía publicar, comentar o dar like en nombre de
  cualquier dirección. Ahora exigen sesión y el autor es la wallet (o el usuario) del token; el `author` del cuerpo se ignora. El frontend (`lib/api.js`) ya envía el token.
- **Moderación saltada:** `GET /api/feed` decidía «es administrador» con `authorization.includes('Bearer')`: bastaba enviar `Authorization: Bearer x` para ver los posts ocultos por
  moderación. Ahora se comprueba un token de administrador real (`middleware/isAdminRequest.js`, 2FA incluido).
- **IP y user-agent expuestos:** `GET /api/social/share/:postId` es público y devolvía el documento completo de cada compartido, con la IP y el navegador de quien compartió. Ya no se
  devuelven (se guardan para antiabuso).
- **Analítica y historial abiertos:** `/share/analytics` tenía un `TODO: verificar admin` (la leía cualquier usuario autenticado; además la tapaba `/share/:postId` y era inalcanzable) y el
  historial `/share/user/:userId` lo podía leer cualquiera sobre cualquier usuario. Ahora la analítica es de administradores y el historial es del propio usuario o de un administrador.
- **Recompensa farmeable:** se pagaban 5 BEZ en cada compartido (hasta 20 al día): compartir el mismo post 20 veces daba 100 BEZ diarios. Ahora se paga **una vez por post y usuario**, con tope de
  20 compartidos al día aplicado dentro de una transacción serializada por usuario (30 compartidos simultáneos → 20 recompensas), y se anota en `bezcoin_transactions` (antes escribía un campo
  `bezTokenBalance` que no existe). Sin wallet se registra el compartido pero no se paga.
- Likes y comentarios eran leer-modificar-guardar y se perdían o duplicaban con peticiones simultáneas: ahora son sentencias atómicas (10 comentarios simultáneos → 10 guardados).
- `ADMIN_TOKEN` se comparaba con `===` (fuga por tiempo): ahora en tiempo constante.
- El oráculo de calidad llamaba a `Post.update(...)`, un método que Mongoose ya no tiene (nada se guardaba) y a campos que ni el esquema tenía (`userId`, `qualityScore`): ahora hay columnas y un
  `Post.update` con lista blanca. **Sigue roto el reparto de recompensas del oráculo y de las automatizaciones**: llaman a `User.update(id, {$inc: …})`, que el usuario de Postgres no
  entiende; es trabajo de diseño (recompensas como asientos del libro de BEZ), no de migración.
- La retención de compartidos (TTL de un año de Mongo) pasa a `Share.purgeExpired()`, que se ejecuta como mucho una vez por hora tras un alta.
- `tests/feed.test.js` se actualiza al nuevo contrato (401 sin sesión); `tests/automation/rewardSystem.test.js` ya fallaba antes (sus mocks de Mongoose no funcionan) y sigue igual.

| Validación de contenido (`validation`: `validation-queue.service.js`) | 2026-11-15 | Tabla `validation_records` (migración 026), `models/pg/Validation.js`; la cola de validación sobre Postgres; borrado `validation.model.js`. 8 casos contra Postgres real (`tests/integration/validation-pg.test.js`). |

**Lo que se encontró al migrar la validación de contenido:**
- **Pagos validados guardados en memoria:** el modelo `Validation` usaba Mongo sólo si había conexión y, si no, un `Map` del proceso. En producción sin Mongo, el registro de una validación **pagada**
  (sesión de Stripe + transacción en cadena + gas) vivía en memoria: se perdía al reiniciar, no lo compartían las instancias de Cloud Run y nadie se enteraba. Ahora se guarda siempre en Postgres, y un
  fallo de la base **ya no se disfraza de éxito** (`queueValidation` devuelve el error). Si el registro de una validación ya confirmada en cadena no se puede guardar, el log incluye ahora la
  transacción y la sesión de pago para poder conciliarlo a mano.
- Una misma sesión de pago o transacción en cadena sólo puede registrarse una vez (índices únicos): un job reintentado tras la confirmación ya no duplica el pago.
- Un registro `confirmed` no se degrada (un reintento tardío con error no puede marcar como fallida una validación pagada).
- Los filtros de `find/findOne/count` eran los de Mongo (cualquier clave y operador: `$where`, `$ne`…); ahora sólo se aceptan campos conocidos.
- La cola enviaba `contentType` y `contentUri` y el esquema de Mongoose los descartaba: ahora se conservan.
- `backend/migrations/001_create_validation_tables.sql` (`content_validations`) **nunca formó parte de `db/migrations`** (usa ids enteros y una tabla `content` que no existe): no se aplica ni se toca; la tabla
  nueva es `validation_records`.
- Sigue en `database/inMemoryDB.js` el almacén en memoria de `validations`, ya sin usos.

**Lo que se encontró al migrar campañas y anunciantes:**
- **Mass assignment:** al crear, `creative`, `targeting`, `budget` y `schedule` se guardaban tal cual venían del cliente (Mongoose descartaba lo que no estaba en el esquema; en JSONB no).
  Ahora `Campaign.normalizar` se queda con los campos conocidos, con su tipo, sus enumerados y topes de tamaño; el estado, las métricas y `approvedBy` no son editables.
- **La edición se saltaba los mínimos:** `PUT /campaigns/:id` fusionaba el presupuesto sin validarlo (Mongoose lo validaba en `save`). Ahora la edición lleva las mismas
  validaciones del alta, los CHECK de la tabla y la regla «fin no anterior al inicio».
- **Suspensión incompleta:** al suspender a un anunciante sólo pasaban a `suspended` sus campañas **activas**; una pausada o aprobada se podía reanudar estando él suspendido. Ahora
  se suspenden las activas, aprobadas y pausadas en la misma transacción, el anunciante suspendido no puede reanudar y el administrador no puede reactivar su campaña sin
  reactivarlo antes (409).
- **Carreras entre administradores:** aprobar, rechazar, pausar y reanudar eran leer-modificar-guardar. Ahora son `UPDATE … WHERE status = …` atómicos: de 6 aprobaciones
  simultáneas pasa una. La edición sólo ocurre si la campaña sigue en borrador o pendiente.
- El mensaje del wizard de perfil decía siempre «actualizado» (`isNew` ya era falso tras `save`); ahora distingue creado de actualizado. El perfil se busca sólo por usuario (antes
  también por wallet, lo que permitía leer el perfil de otro usuario con la misma wallet).
- Se quitan los «fallbacks» que devolvían una lista vacía con 200 si la base fallaba.
- **Sin cambios de comportamiento a propósito:** una pausa del administrador sigue pudiendo reanudarla el anunciante (no hay estado propio para «pausada por admin»; si se quiere
  forzar, el administrador debe usar «suspender»).

**Lo que se encontró al migrar el saldo publicitario (dinero):**
- **Vulnerabilidad real:** `POST /api/billing/add-bez-funds` acreditaba el importe que dijera el cliente con **cualquier `txHash`**: había un `TODO` donde debía
  comprobarse la transacción. Cualquier usuario autenticado podía regalarse saldo. Ahora se acredita **sólo lo que demuestra la cadena** (un `Transfer` de BEZ desde la
  wallet del usuario a `BEZ_ADS_DEPOSIT_ADDRESS`, con 20 confirmaciones) e ignora el importe del cliente; un hash no se puede acreditar dos veces (índice único). **Sin
  `BEZ_ADS_DEPOSIT_ADDRESS` configurada el endpoint responde 503**: hay que definirla (qué dirección recibe los BEZ de publicidad es decisión de negocio) antes de que
  vuelva a funcionar.
- El webhook de Stripe marcaba la recarga como completada y sumaba el saldo **sin comprobar si ya lo había hecho**: una entrega repetida (Stripe reintenta) abonaba dos
  veces. Ahora el paso a `completed` y el abono son una transacción SQL y sólo la primera entrega abona; además se abona lo que Stripe cobró, no lo guardado, y un
  importe o moneda distintos no abonan nada.
- `AdBalance` se modificaba en memoria y se guardaba (leer-modificar-guardar): abonos simultáneos se perdían y dos cobros podían gastar el mismo saldo. Ahora cada
  operación es una sentencia atómica con `CHECK (saldo >= 0)`: 30 cobros simultáneos con saldo para 20 dejan pasar exactamente 20.
- El saldo sumaba EUR y BEZ **sin convertir** (`fiat + bez`); ahora usa el precio BEZ/EUR del oráculo (`AdBalance.availableEur`).
- Aparecida al probar: dos primeros abonos simultáneos de un usuario nuevo chocaban en el índice de la wallet (`ON CONFLICT (user_id)` no lo cubría).
- `/balance` devolvía un saldo vacío con 200 si la base fallaba («Base de datos no disponible»): el usuario veía 0 en vez de un error. Se quita.
- Si Stripe falla al crear el PaymentIntent, la recarga pendiente se cierra como fallida en vez de quedar huérfana.
- Nadie descuenta saldo todavía (el gasto de campañas no está implementado): `AdBalance.deduct` queda listo y probado para cuando se conecte.

**Publicidad completa:** campañas y anunciantes se migraron después (fila siguiente). El historial de facturación sigue sin incluir el nombre de la campaña (`populate`): `billing_transactions.campaign_id` ya es compatible (UUID), falta añadir el JOIN cuando se conecte el cobro de campañas.

**Lo que se encontró al migrar afiliados y leads B2B:**
- `/api/affiliate/me` leía y escribía `user.affiliate.referralCode`, un campo de Mongo que el usuario de Postgres no tiene (el código vive en
  `users.affiliate_referral_code`): regeneraba un código en cada petición y `user.save()` intentaba escribir una columna `affiliate` inexistente.
  Ahora `User.ensureReferralCode` lo genera una vez, de forma atómica y sin pisar el existente.
- Aprobar un lead era leer-modificar-guardar: dos aprobaciones simultáneas (doble clic, dos administradores) **enviaban el mismo mensaje dos
  veces**. Ahora `B2BLead.approve` es un `UPDATE … WHERE outreach_status = 'needs_approval'`: sólo una pasa y el resto recibe «not pending approval».
- El código de referido usaba `nanoid`, ESM puro que no se podía cargar con `require` en las pruebas: se sustituye por `crypto.randomInt`.
- No hay quien escriba eventos `click`/`signup` todavía (sólo la lectura estaba conectada): `AffiliateEvent.record` queda listo para cuando se conecte.

**Lo que se encontró al migrar `contact`** (el modo Postgres ya estaba roto, no sólo el modelo):
- El worker buscaba al usuario con `User.findOne({$or: [{emailHash}, {phoneHash}]})`, una consulta de Mongo que el modelo pg ignora y
  devuelve `null`: **ningún contacto se emparejaba nunca**. Ahora `User.findByContactHashes` consulta `users.email_hash/phone_hash`.
- `User.update(id, {$set: ...})` generaba una columna `$set`: la marca de «ha sincronizado» no se guardaba.
- La recompensa de 50 BEZ no podía anotarse: `bezcoin_transactions.wallet_address` es NOT NULL y la llamada no lo enviaba, ni la moneda
  (caía en `EUR`) ni el estado. Ahora lleva wallet (409 `WALLET_REQUIRED` sin ella), `currency: 'BEZ'` y el contacto en `metadata`.
- La recompensa se podía cobrar varias veces con peticiones simultáneas (`findOne` + `save`). Ahora el paso a `invited` es un
  `UPDATE … WHERE status = 'is_user'` atómico y un contacto ya invitado no se reabre al re-sincronizar. Si falla el pago, el contacto
  se devuelve a `is_user`.

**Para producción:** aplicar la migración 021 (flujo de despliegue del Hub) antes de desplegar esta versión. Al no haber migración de
datos, los contactos que existieran en Mongo no se copian; como el emparejamiento en Postgres no funcionaba, no hay nada válido que perder.

## Hecho en la primera ronda

- Retirados tres modelos que nadie referenciaba (`ClothingRental.model.js`, `affiliateEvent.model.new.js`, `contact.model.new.js`).
- `MIGRATION_DIRECTIVE.md` corregido: decía que el gestor de paquetes destino era npm; es pnpm.
