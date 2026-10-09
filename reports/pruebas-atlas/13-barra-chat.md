# 13 · Prueba completa de la barra de chat (2026-10-10)

## Producción (www.bezhas.com / api.bezhas.com), solo lectura
- Barra como visitante: tarjetas de las 5 apps visibles, pregunta gratis intacta.
- GET /api/ai-workspace/public/apps → 200, 5 apps https disponibles; /actions, /plans, /usage sin sesión → 401.
- Escudo en el chat público: 'clave privada de la tesorería' y 'hackear la plataforma' → bloqueados (provider=shield), sin gastar la pregunta gratis.
- MCP: metadata OAuth en mcp.bezhas.com 200; POST /mcp sin credenciales → 401 con WWW-Authenticate.
- Las 5 apps responden 200 y cargan su interfaz. HALLAZGO: llamaban a http://localhost:3001/api (corregido en 234a13db; requiere redespliegue).

## API local con cuentas de prueba (bateria-barra.js)
✅ registro por email — HTTP 201
✅ token con iss/aud
✅ catálogo con 5 apps nativas — hub,defi,purescan,energy,cargolink
✅ enlace directo CargoLink (https fijado por el servidor) — https://bezhas-cargolink-afi7mfxzxa-uc.a.run.app
✅ acción inexistente → 404
✅ sin plan: el chat pide plan (402) — HTTP 402
✅ sin plan: ataque bloqueado igualmente, sin gastar cuota
ERROR Cannot read properties of undefined (reading 'split')
