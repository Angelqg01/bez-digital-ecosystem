# design-sync — notas del repo (bezhas-frontend)

- **Es una app Vite, no una librería**: no hay dist/ ni `node_modules/<pkg>`. El build usa el barrel deliberado `.design-sync/entry.jsx` pasado con `--entry` (el conversor hace walk-up hasta `frontend/package.json`).
- **CSS**: hay que compilar Tailwind ANTES de cada build del conversor:
  `./node_modules/.bin/tailwindcss -c tailwind.config.cjs -i src/index.css -o .design-sync/build/index.compiled.css --minify`
  (`cfg.cssEntry` apunta ahí; es artefacto regenerable, gitignored). `src/index.css` ya importa Google Fonts (Inter/Poppins, remotas → `[FONT_REMOTE]` esperado) y `styles/theme.css`.
- **npm del sistema está roto** (lru-cache ausente en el npm global de Windows): instalar deps de `.ds-sync/` con `pnpm install <pkgs> --ignore-workspace` (el repo es workspace pnpm 11).
- **Playwright**: chromium-1208 cacheado en `%LOCALAPPDATA%\ms-playwright` ↔ `playwright@1.58.0` (1.57 pina 1200 — no vale). Ejecutar validate/capture con `NODE_PATH=.ds-sync/node_modules`.
- **Subcomponentes de Card** (CardHeader/Title/Description/Content/Footer): quedan en floor card a propósito — la composición completa vive en la preview de `Card` (CardCompleta). No es un fallo del gate.
- **BezCoinLoader** importa `bez_token.png` → esbuild lo inline-a como data-URI (bundle ~2.4 MB, esperado).
- **Previews**: fondo oscuro `#080911` (la app es dark-first); `Card` es light por defecto (Card.css) — texto interior debe usar grises oscuros (gray-600), no gray-300 (fix aplicado en CardSimple).
- **Login**: la sesión CLI con `CLAUDE_CODE_OAUTH_TOKEN` no puede usar DesignSync — requiere `/login` interactivo del usuario antes del upload.

## Re-sync risks

- `index.compiled.css` NO está commiteado — un re-sync que olvide regenerarlo construye con CSS rancio o falla `[CSS_IMPORT_MISSING]`.
- El content-glob de Tailwind escanea todo `src/` — clases nuevas/quitadas en la app cambian el CSS aunque los 7 componentes no cambien (styleSha se moverá; es correcto, no un bug).
- El set es acotado (7 + 5 subcomponentes): los demás ~90 componentes de la app quedan fuera deliberadamente; ampliarlos = añadir exports al barrel `entry.jsx` + `componentSrcMap` + `dtsPropsFor` + preview.
- Toolchain asumida: node 24, pnpm 11, tailwind 3.4 del repo, esbuild 0.28 en `.ds-sync` (gitignored — se reinstala por clone).
