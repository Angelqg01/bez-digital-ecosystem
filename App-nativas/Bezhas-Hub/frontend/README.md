# BeZhas Frontend

## Setup

```bash
# Instala dependencias
npm install

# Inicia el servidor de desarrollo
npm run dev
```

## Estructura
- `src/components`: Componentes reutilizables
- `src/pages`: Vistas principales
- `src/layouts`: Layouts globales
- `src/context`: Estado global (ej. AuthContext)
- `src/services`: Lógica de API
- `src/hooks`: Hooks personalizados

## Tailwind
Ya está configurado en `tailwind.config.js` y `postcss.config.js`. Puedes usar clases utilitarias en cualquier componente.

## Variables de entorno
Crea un archivo `.env` con las variables necesarias. En desarrollo, es recomendable usar el proxy de Vite y dejar `VITE_API_URL` vacío para que `/api/*` se redirija al backend configurado en `vite.config.js`.

```
# VITE_API_URL=
VITE_USE_MOCK=0
```

Para trabajo local con backend en `http://localhost:3001`, también puedes establecer:

```
VITE_API_URL=http://localhost:3001
```

Si quieres visualizar el Panel Admin sin backend, usa:

```
VITE_USE_MOCK=1
```
