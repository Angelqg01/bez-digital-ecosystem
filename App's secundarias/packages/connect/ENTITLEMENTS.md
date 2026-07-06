# Suscripción ↔ Entitlements — un solo contrato para SDK / API / ABI / Plugin

El cliente elige **qué SubApps usará** en su suscripción. Esa elección (los
*entitlements*) se respeta en **todas** las superficies de integración. Una sola
fuente de verdad, comprobada en cada capa.

```
        Suscripción del cliente (plan + SubApps activadas)
                          │
        ┌─────────────────┼─────────────────────────────┐
        ▼                 ▼                 ▼            ▼
      SDK              REST API           Widget      Plugin WP
  service() gate   gateway 403 si       solo monta   solo habilita
  ENTITLEMENT_*    no entitled          lo activado   lo activado
```

## El contrato

`GET /api/gateway/v1/subscription` → `{ plan, subapps: [...], status, renewsAt }`
donde `subapps` = ids de las SubApps activadas (los core `hub`/`wallet` siempre).

- `POST /subscription/activate` `{ subapp }` — añade a factura + entitlements
- `POST /subscription/deactivate` `{ subapp }` — corta al siguiente ciclo
- `GET /subscription/quote?plan&addons&annual` — cotiza sin comprometer

## Cómo lo consume cada superficie

### SDK (`@bezhas/connect`)
```js
const bez = new BeZhasConnect({ apiKey });
await bez.subscription.sync();           // carga entitlements del backend
bez.service('pay').call('buy', {...});   // OK si Pay está activada
bez.service('energy').call('assets');    // throw BeZhasEntitlementError si no
```
También offline: `new BeZhasConnect({ apiKey, entitlements: ['pay','cargolink'] })`.

### REST API / gateway
El gateway valida la API key → resuelve la suscripción → si la ruta pertenece a
una SubApp no activada, responde `403 { error: 'ENTITLEMENT_REQUIRED', subapp }`.
(El SDK corta antes para ahorrar la llamada; la API es la autoridad final.)

### ABI / on-chain
El **pago** de la suscripción se liquida en BEZ (token v1 Polygon
`0xEcBa…11A8`) vía `BeZhasPayment`. El entitlement se deriva del pago confirmado:
el backend lee el `Transfer`/evento de suscripción y materializa `subapps`. La
capa on-chain es la prueba de pago; la activación efectiva la aplica el gateway
(off-chain, revocable al instante para soportar cancelaciones).

### Plugin WordPress
`bezhas-entitlements.php` → `BeZhas_Entitlements::fetch($key)` (cache 5 min):
```php
$ent = BeZhas_Entitlements::fetch($api_key, $base_url);
if ($ent->allows('cargolink')) { /* muestra el bloque de tracking */ }
```

## Precio
La selección de SubApps determina el precio (ver Hub `config/pricing.js`
`calculatePricing()` + el calculador `#activar-subapps`). El plan base incluye N
SubApps; el resto suma; bundle 3+ −15%, 5+ −25%; anual = 2 meses gratis.

## Estado
- ✅ SDK: `subscription` module + `Entitlements` + gating en `service()` (42 tests verdes).
- ✅ Registry: SubApp `subscription` (get/quote/activate/deactivate), nunca gateada.
- ✅ Plugin WP: helper de entitlements con fallback core-only.
- ⏳ Backend gateway: faltan las rutas `/subscription*` reales + materialización
  del entitlement desde el pago on-chain (hoy el contrato está definido; el SDK y
  el plugin ya hablan ese contrato).
