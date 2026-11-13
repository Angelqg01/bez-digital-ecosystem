# control-center/frontend/ — Web principal

Next.js 16 (App Router) + React 19 + Tailwind. Contexto general: [`../../CLAUDE.md`](../../CLAUDE.md).

## Comandos

```bash
pnpm dev        # next dev --webpack
pnpm build      # next build --webpack
pnpm test       # Jest (~230 tests)
```

`--webpack` es obligatorio: sin él Next 16 usa Turbopack y falla por la configuración de webpack de
`next.config.mjs`. `next dev` genera un `AGENTS.md` que no se versiona: bórralo.

## Estructura

`app/(landing)` web pública · `app/dashboard` panel · `app/admin` y `app/monitor` internas ·
`lib/api.ts` cliente HTTP (`API_BASE` ya termina en `/api`) · `lib/auth-context.tsx` sesión.
El token es `bezhas_token` (localStorage **y** cookie: `proxy.ts` lee la cookie).

## Trampas

- **`NEXT_PUBLIC_*` se incrusta al compilar**, no al arrancar. El `Dockerfile` apunta por defecto a
  `https://api.bezhas.com/api`; el compose local lo sustituye con `build.args`
  (`http://localhost:3001/api`). Una imagen construida sin ese argumento habla con producción.
- **Sellos de clasificación:** `lib/page-classification.ts` asigna un nivel de suscripción a cada
  página (borrador: sólo etiqueta). Un test falla si creas una página sin clasificarla, y otro si
  se separa de la clasificación del Hub (`App-nativas/Bezhas-Hub/frontend/src/config/pageClassification.js`).
- Para ver cambios en el contenedor hay que reconstruir la imagen (`docker compose build control-center`).
