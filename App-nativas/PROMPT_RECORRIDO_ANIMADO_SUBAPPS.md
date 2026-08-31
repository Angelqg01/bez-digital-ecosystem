# Prompt reutilizable — Recorrido animado "Cómo usar" para SubApps BeZhas (vía @bezhas/guided-tour)

> Pega este prompt en una sesión de Claude Code **abierta en la carpeta de la SubApp destino**
> (p. ej. `App-nativas/BZ PureScan`). Rellena primero el bloque `‹PARÁMETROS›`.
> La mecánica de la animación ya vive en el paquete compartido **`@bezhas/guided-tour`**
> (`App-nativas/packages/guided-tour`); esta tarea es sobre todo **escribir las escenas**
> reales de la SubApp y cablear el reproductor. Consumidor de referencia: **BZ CargoLink**.

---

## ‹PARÁMETROS› (rellena esto antes de enviar)

- **SUBAPP**: `<nombre visible, p. ej. BZ PureScan>`
- **CARPETA**: `<ruta, p. ej. App-nativas/BZ PureScan>`
- **PUERTO DEV**: `<puerto de vite, míralo en package.json → scripts.dev>`
- **FRAMEWORK / ROUTER**: `<React + react-router | React sin router | Vue | vanilla — averígualo>`
- **OBJETIVO DE NEGOCIO EN UNA FRASE**: `<qué resuelve para el usuario>`
- **EVENTO / FLAG** (deriva del slug): evento `‹slug›:start-tour`, flag localStorage `‹slug›_tour_seen_v1`
- **¿EXPONE API B2B?**: `<sí/no — si la SubApp tiene Developer Console, API Keys u onboarding B2B, marca sí>`
  - Si es sí, rellena también:
    - **SECTORES DE USO**: `<lista real, p. ej. Logística, Aduanas, RWA, Fintech, Energía·VPP, Industria, Legal/Compliance>`
    - **MODELO ORGANIZATIVO**: `<cómo se estructura el acceso — org/sede/membership, API Key por sede, scope por SubApp, etc. Mira OrgContext / OrgApiKeysTab si existen>`

---

## Tarea

Añade a **‹SUBAPP›** el recorrido animado **"Cómo usar"** para que los usuarios aprendan a
usarla, reutilizando el paquete compartido **`@bezhas/guided-tour`**. No reimplementes la
animación: solo **define las escenas reales** de esta SubApp y **cablea** el reproductor.

### Referencias — LÉELAS PRIMERO

- `App-nativas/packages/guided-tour/README.md` — API y flujo de consumo.
- `App-nativas/packages/guided-tour/tour.config.example.mjs` — plantilla de escenas.
- **Consumidor de referencia (cópialo como patrón):**
  - `App-nativas/BZ CargoLink/tour.config.mjs` — 9 escenas reales.
  - `App-nativas/BZ CargoLink/src/components/GuidedTour.jsx` — wrapper fino del paquete.
  - `App-nativas/BZ CargoLink/src/App.jsx` — botón "CÓMO USAR" en cabecera + `<GuidedTour/>` montado.
  - `App-nativas/BZ CargoLink/package.json` — dep `file:` + script `tour:build`.

## Paso 0 — Descubrimiento (obligatorio)

1. Lee el router/entry para listar **todas las pantallas** y su propósito.
2. Abre cada pantalla principal y extrae su **encabezado, subtítulo y acciones reales**.
3. Localiza los **tokens de tema** (CSS vars `--bz-*` en `src/index.css` u otro) — paleta.
4. Detecta **dónde está la cabecera** y cómo se añade un botón; y si hay **gate de auth**.
5. Detecta el framework (React/Vue/vanilla). Si el install falla por el workspace, usa `pnpm install --ignore-workspace`.
6. **Si ‹EXPONE API B2B› = sí**: localiza el Developer Console / panel de API Keys real
   (p. ej. `OrgApiKeysTab`, `DeveloperConsole`) y su backend (`plugin-bridge`, `apiKeyTenant`,
   `OrgContext`). Extrae de ahí — no inventes — qué scopes/sedes/planes existen de verdad.

El recorrido debe reflejar **estas pantallas reales**: una escena por función principal (6–10), en el orden en que un usuario las usa.

## Pasos de implementación

### 1. Añade el paquete y el script de build (package.json de la SubApp)

```jsonc
{
  "dependencies": { "@bezhas/guided-tour": "file:../packages/guided-tour" },
  "scripts": {
    "tour:build": "node \"../packages/guided-tour/bin/generate.mjs\" tour.config.mjs public/como-usar.html",
    "build": "pnpm tour:build && vite build"   // encadénalo al build existente
  }
}
```
Luego: `pnpm install --ignore-workspace`.

### 2. Escribe `tour.config.mjs` (raíz de la SubApp) — el trabajo real

Copia `tour.config.example.mjs` y créalo con las **escenas reales** de la SubApp:
- `appName`, `logo` (emoji), `theme` (solo overrides sobre el tema BeZhas), `durationMs`.
- `scenes[]`: por cada función, `{ label, kicker, title, body, tags, visual }`.
  - `title` engancha; `body` explica **cómo se usa** en 1–2 frases; `tags` = 2–3 chips (`'c'|'g'|'p'|''`).
  - `visual` = una **mini-maqueta** (`<div class="phone">…</div>`) que representa esa pantalla real.
  - Iconos con tokens `{{ico:NAME}}` (map finger box globe radio shield scale anchor wallet cpu
    pin code play scan zap coins users chart lock gift; añade propios en `icons`).
- Genera el HTML: `pnpm tour:build` → crea `public/como-usar.html` (autónomo, CSP-safe).

#### Si ‹EXPONE API B2B› = sí — escenas prioritarias de API (mínimo 2, al principio del bloque final)

Estas escenas van **antes** del cierre del recorrido y explican el modelo de negocio B2B, no solo la UI:

1. **Escena "Sectores donde opera la API"** — `visual` tipo grid/chips con los ‹SECTORES DE USO›
   reales (Logística, Aduanas, RWA, Fintech, Energía·VPP, Industria, Legal/Compliance, Holdings...).
   `body`: en 1–2 frases, qué resuelve la API en esos sectores (trazabilidad, pagos, certificación...).
2. **Escena "Gestión desde una empresa core / holding / consorcio"** — explica cómo una empresa
   matriz gestiona el acceso de sus filiales o red de socios: una API Key por sede/filial con scope
   propio, planes y permisos que la matriz asigna, uso agregado visible desde la consola central.
   Usa el ‹MODELO ORGANIZATIVO› real detectado en el Paso 0 (no inventes conceptos que no existan
   en `OrgContext`/`OrgApiKeysTab`/`plugin-bridge`). `visual`: maqueta con la jerarquía
   matriz → sede/filial → API Key, o el panel real de "API & Sedes" si existe.

Si la SubApp no tiene API B2B real, omite esta subsección por completo — no la inventes.

### 3. Cablea el reproductor

**React** — crea `src/components/GuidedTour.jsx` como wrapper fino (idéntico a CargoLink):

```jsx
import React from 'react'
import { GuidedTour as Base, TourButton as BaseBtn } from '@bezhas/guided-tour/react'
const EVENT = '‹slug›:start-tour'
const SEEN = '‹slug›_tour_seen_v1'
export default function GuidedTour() {
  return <Base appName="‹SUBAPP›" src="/como-usar.html" eventName={EVENT} seenKey={SEEN} />
}
export function TourButton({ compact = false }) {
  return <BaseBtn compact={compact} eventName={EVENT} label="CÓMO USAR" />
}
```
- Monta `<GuidedTour/>` una vez, **fuera del gate de auth** (junto al layout raíz).
- Pon `<TourButton compact />` en la cabecera.
- Si algún sitio ya dispara el tour, usa `window.dispatchEvent(new CustomEvent('‹slug›:start-tour'))`.

**Vue / vanilla** — usa el launcher directo:

```js
import { mountGuidedTour, openGuidedTour } from '@bezhas/guided-tour/launcher'
mountGuidedTour({ appName: '‹SUBAPP›', src: '/como-usar.html', eventName: '‹slug›:start-tour', seenKey: '‹slug›_tour_seen_v1' })
// botón propio: onClick = () => openGuidedTour('‹slug›:start-tour')
```

### (Opcional) Página de Configuración
Solo si la SubApp tiene ajustes de dominio propios: replica el patrón de
`BZ CargoLink/src/pages/Settings.jsx` (una sección específica + botón CONFIG en cabecera + banner que lanza el tour). Si no aplica, **omítelo** — no inventes ajustes inexistentes.

## Reglas de contenido (lo que marca la calidad)

- Una escena por función **que existe de verdad**; nada copiado literal de CargoLink salvo la mecánica.
- Textos en **español**, claros y comerciales; describe **cómo usar** cada pantalla.
- Usa el **tema real** de la SubApp (no los colores de CargoLink).
- El recorrido debe verse aunque el usuario **no** haya iniciado sesión (overlay fuera del gate).
- **Si ‹EXPONE API B2B› = sí**, las escenas de sectores + gestión core/holding→filiales son
  **prioritarias**: van antes que detalles menores de UI, con datos reales (no genéricos).

## Verificación (obligatoria antes de terminar)

1. `pnpm tour:build` genera `public/como-usar.html` sin errores.
2. `pnpm build` **verde** (el import de `@bezhas/guided-tour/react` resuelve; recuerda `--ignore-workspace`).
3. Arranca el dev server (‹PUERTO DEV›) y en el navegador:
   - Abre `/como-usar.html`: **avanza solo** por todas las escenas, sin errores de consola ni solapes en estado estable.
   - En la app, pulsa **CÓMO USAR** → abre el modal con el iframe.
   - Borra el flag `‹slug›_tour_seen_v1` y recarga → **auto-show** en la 1ª visita.
   - Recorre cada pantalla y comprueba que el recorrido las refleja fielmente.
4. Reporta con capturas.

## Restricciones

- **No** reimplementes el motor ni el modal: vienen del paquete. Solo `tour.config.mjs` + wrapper + cableado.
- **No** añadas dependencias nuevas (el paquete es cero-deps; React es peer opcional).
- `public/como-usar.html` es **generado** — no lo edites a mano; cambia `tour.config.mjs` y re-genera.
- Cambios aditivos: no toques la lógica de negocio existente.

## Criterios de aceptación

- [ ] `tour.config.mjs` con N escenas **reales** de la SubApp + tema propio.
- [ ] `public/como-usar.html` regenerado por `pnpm tour:build`.
- [ ] Wrapper `GuidedTour.jsx` (o `mountGuidedTour`) con evento/flag propios; `<GuidedTour/>` fuera del gate.
- [ ] Botón "CÓMO USAR" en la cabecera; auto-show en 1ª visita.
- [ ] `pnpm build` verde y recorrido verificado en navegador (sin errores de consola).
- [ ] (Si aplica) página Configuración con sección de dominio.
- [ ] (Si EXPONE API B2B = sí) escenas de "sectores de uso" y "gestión core/holding → filiales" presentes y con datos reales.

---

### Mantenimiento
Cuando cambien las funciones de la SubApp, edita `tour.config.mjs` y ejecuta `pnpm tour:build`.
La mecánica se actualiza para todas las SubApps a la vez desde `packages/guided-tour`.
