# @bezhas/guided-tour

Recorrido animado **"Cómo usar"** reutilizable para las SubApps de BeZhas. Una sola
fuente para la mecánica de la animación; cada SubApp aporta solo el **contenido de sus
escenas**. Cero dependencias en el core; los bindings React son opcionales.

Tres piezas:

| Pieza | Qué hace | Import |
| :--- | :--- | :--- |
| **engine** | `renderTourHTML(config)` → documento HTML **autónomo** (CSP-safe) | `@bezhas/guided-tour/engine` |
| **generate** | CLI: `config.mjs` → `public/como-usar.html` | `bin/generate.mjs` |
| **launcher** | modal + iframe + auto-show + evento (vanilla) | `@bezhas/guided-tour/launcher` |
| **react** | `<GuidedTour/>` + `<TourButton/>` (wrappers) | `@bezhas/guided-tour/react` |

## Cómo lo consume una SubApp

El monorepo usa un **workspace scoped**: las SubApps con su propio `node_modules` no se
enlazan automáticamente. Añade el paquete como dependencia `file:` e instala ignorando
el workspace:

```jsonc
// package.json de la SubApp
{
  "devDependencies": { "@bezhas/guided-tour": "file:../packages/guided-tour" },
  "scripts": {
    "tour:build": "node \"../packages/guided-tour/bin/generate.mjs\" tour.config.mjs public/como-usar.html"
  }
}
```

```bash
pnpm install --ignore-workspace   # enlaza el paquete file:
pnpm tour:build                   # genera public/como-usar.html desde tour.config.mjs
```

### 1. Define tus escenas — `tour.config.mjs`

Copia `tour.config.example.mjs`. Una escena por función **real** de tu app (6–10).
Referencia iconos con `{{ico:NAME}}`; tema con overrides parciales.

```js
export default {
  appName: 'BZ CargoLink',
  logo: '⚓',
  theme: { primary: '#00F0FF' },      // el resto = tema BeZhas por defecto
  scenes: [
    { label: 'Ruta Activa', kicker: 'Pestaña · Active', title: '…', body: '…',
      tags: [['c','Mapa'],['g','POD firmado']],
      visual: `<div class="phone">{{ico:map}} …</div>` },
    // …
  ],
};
```

### 2. Monta el reproductor in-app

**React** (recomendado): coloca `<GuidedTour/>` cerca de la raíz y un `<TourButton/>` en la cabecera.

```jsx
import GuidedTour, { TourButton } from '@bezhas/guided-tour/react'

// cabecera:
<TourButton compact />
// raíz (fuera del gate de auth):
<GuidedTour appName="BZ CargoLink" seenKey="cargolink_tour_seen_v1" eventName="cargolink:start-tour" />
```

**Cualquier framework** (vanilla):

```js
import { mountGuidedTour, openGuidedTour } from '@bezhas/guided-tour/launcher'
mountGuidedTour({ appName: 'BZ CargoLink', seenKey: 'cargolink_tour_seen_v1', eventName: 'cargolink:start-tour' })
// abrir desde un botón propio:
button.onclick = () => openGuidedTour('cargolink:start-tour')
```

## API

### `renderTourHTML(config) → string`
`config`: `{ appName, subtitle?, logo?, title?, lang?, durationMs?, theme?, icons?, scenes }`.
Devuelve el HTML completo autónomo. Lanza si `scenes` está vacío.

### `mountGuidedTour(opts) → { open, close, destroy }`
`opts`: `{ src='/como-usar.html', appName, eventName='guided-tour:open', seenKey='bez_tour_seen_v1', autoShow=true, delayMs=1200 }`.
Auto-muestra en la 1ª visita (flag localStorage) y abre al recibir el evento window.

### `<GuidedTour {...} />` / `<TourButton compact label eventName />`
Wrappers React de lo anterior (React es peer opcional).

## Iconos disponibles
`map finger box globe radio shield scale anchor wallet cpu pin code play scan zap coins users chart lock gift`
— añade propios con `icons: { nombre: '<path d="…"/>' }`.

## Notas
- El HTML generado es **self-contained**: sin CDNs, sin fuentes remotas, sin `fetch`. Seguro bajo CSP estricta.
- Regenera `public/como-usar.html` (`pnpm tour:build`) cuando cambies las escenas.
- Consumidor de referencia: **BZ CargoLink** (`tour.config.mjs`, cabecera y `GuidedTour` cableados).

Tests: `node --test test/*.test.js`.
