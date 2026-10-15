# Chat de la plataforma (BeZhas AI) para las SubApps Vite

El **mismo chat de www.bezhas.com** (`control-center/frontend/components/AIWorkspaceBar.tsx`), empaquetado para las SubApps
que usan Vite + React. Sustituye al widget antiguo `https://bezhas.com/bz-chat.js` (burbuja 💬, `/api/public-chat`, sin
sesión, sin planes, sin streaming).

| | `bz-chat.js` (antiguo) | `_shared/ai-chat` (este) |
|---|---|---|
| Servidor | `/api/public-chat` (palabras clave) | `/api/ai-workspace` (RAG, plan, escudo, cifras comprobadas) |
| Sesión | ninguna | la de la SubApp (`BezhasAuthProvider`): **no hay un segundo login** |
| Respuesta | de golpe | en streaming, con citas, consumo del plan e historial |
| Acciones | no | catálogo, tarjetas de apps, planes (el destino lo decide el servidor) |
| Aspecto | burbuja verde | barra inferior idéntica a la de la web |

## Uso

Dentro de `<BezhasAuthProvider>` (ya lo montan Energy, Genesis, PureScan, Sphere y Pay):

```jsx
import AIWorkspaceBar from '../../_shared/ai-chat/AIWorkspaceBar.jsx'

<AIWorkspaceBar
  hideAppId="app_energy"   // la tarjeta de la app en la que ya estás no se muestra
  bottomOffset={92}        // px sobre el borde inferior (para no tapar una barra de navegación fija)
  suggestions={['…', '…']} // opcional; por defecto, las genéricas de la plataforma
/>
```

Y quitar `<script src="https://bezhas.com/bz-chat.js">` del `index.html` (si no, aparecen dos chats).

Requisitos de la SubApp: `lucide-react` en sus dependencias y en `vite.config.js` → `resolve.dedupe: ['react', 'react-dom', 'lucide-react']`
(`_shared/` no tiene `node_modules`). La API debe admitir el origen de la SubApp por CORS (ya lo hace para las del despliegue).

Variables: `VITE_API_URL` (la misma que ya usa la SubApp; con o sin `/api`) y, opcionalmente, `VITE_SITE_URL` (por defecto
`https://www.bezhas.com`; a ese origen se abren las rutas internas del catálogo, como «Suscribirme a un plan»).

## Mantener sincronizado con control-center

`ai-workspace.js` es un port de `control-center/frontend/lib/ai-workspace.ts`. El Markdown seguro se comprueba con los
mismos casos en las dos copias (`__tests__/fixtures/chat-markdown.json`):

```bash
node --test App-nativas/_shared/__tests__/*.test.mjs                       # esta copia
cd control-center/frontend && pnpm exec jest __tests__/lib/ai-workspace-parity.test.ts   # la de la web
```
Si cambias el renderizado, cambia las dos y regenera el JSON de casos. El componente y el CSS (`ai-chat.css`, acotado a
`.bzai`, sin Tailwind) siguen el diseño de `AIWorkspaceBar.tsx`: si cambia allí (p. ej. una pestaña nueva), hay que reflejarlo aquí.

## Lo que NO hace
- No hay caja para adjuntar documentos (la política es que los archivos sólo sirven para NFT y no se leen).
- Los enlaces del modelo sólo se abren si son rutas internas o `bezhas.com`; nada de HTML (todo se escapa).
