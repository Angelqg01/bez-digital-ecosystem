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

1. **Sin dinero ni custodia:** ~~`contact`~~ (hecho), `Share`, `affiliateEvent`, `B2BLead`, `validation`. Una ruta cada uno; se prueban con la suite del Hub.
2. **Puente/OpenClaw:** `BridgeApiKey` y `OpenClawClient`. Llevan claves: migrar con hash y no volver a escribir el valor en claro.
3. **Publicidad:** `adBalance` mueve saldos y lo toca el webhook de Stripe: migración con doble escritura y comparación antes de cortar.
4. **DAO/DeFi:** al final y sólo si la gobernanza sigue en uso; la fuente de verdad es la cadena, esto es caché.

Regla de cada paso: modelo nuevo en `models/pg` + migración SQL + el test de la ruta antes y después, y retirar el modelo de Mongoose al
pasar a producción. Mientras haya un modelo de Mongoose en uso, `MONGODB_URI` tiene que seguir definida en producción.

## Migrados

| Dominio | Fecha | Qué cambió |
|---|---|---|
| `contact` (sincronización de contactos) | 2026-11-15 | Tabla `contacts` (migración 021), `models/pg/Contact.js`, `routes/contacts.routes.js` y `workers/contactSync.worker.js` sobre Postgres; borrado `models/contact.model.js`. Probado contra Postgres real (`tests/integration/contacts-pg.test.js`, 9 casos). Detalle abajo. |

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
