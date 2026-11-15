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

1. **Sin dinero ni custodia:** ~~`contact`~~, ~~`affiliateEvent`~~, ~~`B2BLead`~~ (hechos). **Aplazados con motivo:** `Share` depende del dominio social `Post` (la ruta lee y escribe `post.shares` y el saldo `bezTokenBalance`, que ni `posts` ni `users` tienen en Postgres) y debe migrarse junto a posts, likes y comentarios; `validation` (318 líneas, con cola BullMQ, contrato `ContentValidator` y almacén en memoria de reserva) es un dominio propio que ya tiene `models/pg/ValidationEvent` a medias. Una ruta cada uno; se prueban con la suite del Hub.
2. **Puente/OpenClaw:** `BridgeApiKey` y `OpenClawClient`. Llevan claves: migrar con hash y no volver a escribir el valor en claro.
3. **Publicidad:** ~~`adBalance`~~ (hecho, ver arriba); quedan `campaign` y `advertiserProfile`. Los saldos de Mongo no se copian: sólo existían si alguien había recargado, y habría que comprobar si hay saldos reales en producción antes de cortar.
4. **DAO/DeFi:** al final y sólo si la gobernanza sigue en uso; la fuente de verdad es la cadena, esto es caché.

Regla de cada paso: modelo nuevo en `models/pg` + migración SQL + el test de la ruta antes y después, y retirar el modelo de Mongoose al
pasar a producción. Mientras haya un modelo de Mongoose en uso, `MONGODB_URI` tiene que seguir definida en producción.

## Migrados

| Dominio | Fecha | Qué cambió |
|---|---|---|
| `contact` (sincronización de contactos) | 2026-11-15 | Tabla `contacts` (migración 021), `models/pg/Contact.js`, `routes/contacts.routes.js` y `workers/contactSync.worker.js` sobre Postgres; borrado `models/contact.model.js`. Probado contra Postgres real (`tests/integration/contacts-pg.test.js`, 9 casos). Detalle abajo. |

| `affiliateEvent` (afiliados) y `B2BLead` (leads y envío con aprobación) | 2026-11-15 | Tablas `affiliate_events` y `b2b_leads` (migración 022), `models/pg/AffiliateEvent.js` y `models/pg/B2BLead.js`; `routes/affiliate.routes.js` y `services/outbound-messaging.service.js` sobre Postgres; borrados los dos modelos de Mongoose. 10 casos contra Postgres real (`tests/integration/affiliate-b2b-pg.test.js`). |

| Saldo publicitario: `adBalance` y `billingTransaction` (billing, webhook de Stripe y chequeo de saldo de campañas) | 2026-11-15 | Tabla `ad_balances` (migración 023; `billing_transactions` ya existía desde la 006), `models/pg/AdBalance.js`, `services/adTopup.service.js` y `services/bezDepositVerifier.js`; `routes/billing.routes.js`, `routes/stripe-webhook.routes.js` y `routes/campaigns.routes.js` sobre Postgres; borrados los dos modelos de Mongoose. 24 casos contra Postgres real (`tests/integration/ad-balance-pg.test.js`) y 10 sin base en el CI (`tests/bez-deposit-verifier.test.js`). |

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

**Pendiente de este dominio:** `campaign` y `advertiserProfile` (las rutas `campaigns`, `adminAds` y `advertiserProfile`, ~1.250 líneas) siguen en Mongo; el historial
ya no incluye el nombre de la campaña (`populate`) porque `billing_transactions.campaign_id` es UUID y las campañas aún tienen `_id` de Mongo.

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
