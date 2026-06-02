# Deployment Issues & Solutions
> Problemas de despliegue y sus soluciones

## Foundry not in PATH on Windows
**Síntoma**: `forge: command not found`
**Solución**: Usar ruta completa
```powershell
& "$env:USERPROFILE\.foundry\bin\forge.exe" build
```

## npm broken with Node 24 + npm 11
**Síntoma**: npm commands fail with corruption errors
**Solución**: Download npm@10.9.2 manually and replace
**Fecha**: 2026-03-14

## Next.js config must be .mjs not .ts
**Síntoma**: Build fails with config parse error
**Regla**: Next.js 14.2.3 requires `next.config.mjs`, NOT `.ts`

## PostCSS config for Tailwind v3
**Regla**: Use `postcss.config.js` (not .mjs) for Tailwind v3
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

## PowerShell UTF-8 corruption
**Síntoma**: Files written by Set-Content have wrong encoding
**Solución**: Avoid `Set-Content` for files with special chars. Use Node.js fs instead.

## Docker compose validation
```powershell
docker compose config  # Validate before building
docker compose up --build  # Build and start
```
