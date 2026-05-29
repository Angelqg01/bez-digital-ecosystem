# Landing publica: decision Next.js/Astro

## Estado actual

La landing principal sigue en React + Vite porque comparte autenticacion, wallet, rutas internas, widgets del token y componentes del Hub. Es la opcion de menor riesgo para continuar desarrollando animaciones y producto.

## Cuando mantener Vite

- La landing funciona principalmente como entrada a la app.
- Hay mucha interactividad de cliente: wallet, modales, sonido, canvas, widgets y rutas internas.
- El equipo prioriza velocidad de desarrollo sobre SEO avanzado.

## Cuando mover solo la landing publica

Mover la capa publica a Next.js o Astro cuando el objetivo principal sea captacion organica, metadata social, paginas indexables por vertical, whitepaper publico y performance SEO medible.

## Recomendacion

- Next.js si la landing publica debe convivir con auth, dashboards ligeros, API routes o pages dinamicas.
- Astro si la landing sera principalmente estatica y solo necesita islas React para wallet, token widget y animaciones.

## Plan futuro

1. Terminar de modularizar `LandingPage`.
2. Migrar componentes criticos a `.tsx`.
3. Medir bundle, LCP y rutas publicas.
4. Si SEO es prioridad, crear `frontend-public` en Astro o Next.js y consumir los mismos datos de `src/data/landing.ts`.
