# Desarrollo local (BeZhas Web3)

Este documento explica cómo levantar el entorno de desarrollo localmente con Docker Compose y los pasos mínimos para ejecutar backend, frontend y servicios auxiliares.

Requisitos:
- Docker & Docker Compose
- Node.js 18+
- npm

1) Preparar variables de entorno
- Copia los ejemplos de env:

  - `cp backend/.env.example backend/.env`
  - `cp frontend/.env.example frontend/.env`
  - `cp .env.example .env` (opcional, para scripts raíz)

- Rellena las variables necesarias en `backend/.env` (MONGODB_URI, REDIS_URL, JWT_SECRET, ADMIN_TOKEN, etc.)
 - Rellena las variables necesarias en `backend/.env` (las variables obligatorias están listadas abajo).

Variables obligatorias (ejemplo):

```
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
ADMIN_TOKEN=change_me_admin_token_please
MONGODB_URI=mongodb://mongo:27017/bezhas
REDIS_URL=redis://redis:6379
CONTACT_ENCRYPTION_KEY=this_is_a_32_character_long_key!
JWT_SECRET=this_is_a_very_long_jwt_secret_at_least_32_chars
```

Si se detecta que faltan o son inválidas, el backend no arrancará y mostrará errores claros indicando qué variable corregir.

2) Levantar servicios de infra

```powershell
# Desde la raíz del proyecto
docker compose up -d
```

Esto levantará:
- MongoDB en el puerto 27017
- Redis en el puerto 6379
- (Opcional) hardhat node en el puerto 8545
- Backend en el puerto 3001
- Frontend en el puerto 5173

3) Instalar dependencias y arrancar servicios (si prefieres ejecutar localmente sin Docker para backend/frontend)

```powershell
# Backend
cd backend
npm ci
npm run dev

# Frontend (en otra terminal)
cd frontend
npm ci
npm run dev
```

4) Tests

- Hardhat (contract tests)

```powershell
# En la raíz
npm test
```

- Backend tests

```powershell
cd backend
npm test
```

5) Parar y limpiar

```powershell
docker compose down
```

Notas:
- No incluyas credenciales reales en los archivos `.env` commitados.
- Para producción se recomienda usar gestores de secretos (HashiCorp Vault, AWS Secrets Manager) y un proceso de despliegue CI/CD seguro.

Si quieres, puedo agregar un script en `package.json` (raíz) para ejecutar `docker compose up` y `docker compose down` desde npm scripts. Dime si lo añado.
