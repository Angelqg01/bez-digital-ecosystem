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

1. **Sin dinero ni custodia:** `contact`, `Share`, `affiliateEvent`, `B2BLead`, `validation`. Una ruta cada uno; se prueban con la suite del Hub.
2. **Puente/OpenClaw:** `BridgeApiKey` y `OpenClawClient`. Llevan claves: migrar con hash y no volver a escribir el valor en claro.
3. **Publicidad:** `adBalance` mueve saldos y lo toca el webhook de Stripe: migración con doble escritura y comparación antes de cortar.
4. **DAO/DeFi:** al final y sólo si la gobernanza sigue en uso; la fuente de verdad es la cadena, esto es caché.

Regla de cada paso: modelo nuevo en `models/pg` + migración SQL + el test de la ruta antes y después, y retirar el modelo de Mongoose al
pasar a producción. Mientras haya un modelo de Mongoose en uso, `MONGODB_URI` tiene que seguir definida en producción.

## Hecho en esta ronda

- Retirados tres modelos que nadie referenciaba (`ClothingRental.model.js`, `affiliateEvent.model.new.js`, `contact.model.new.js`).
- `MIGRATION_DIRECTIVE.md` corregido: decía que el gestor de paquetes destino era npm; es pnpm.
