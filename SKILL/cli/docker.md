# Docker CLI Reference — BeZhas Blockchain
> Comandos Docker para la infraestructura

## Servicios Definidos (docker-compose.yml)
| Servicio | Imagen | Puerto |
|----------|--------|--------|
| postgres | postgres:16 | 5432 |
| redis | redis:7-alpine | 6379 |
| api | ./api (Dockerfile) | 3001 |
| aegis | ./aegis (Dockerfile) | 8001 |
| ai-engine | ./ai-engine (Dockerfile) | 3003 |
| op-geth | custom | 8545 |
| blockscout | blockscout | 4000 |

## Comandos Frecuentes
```powershell
# Validar config
docker compose config

# Levantar todo
docker compose up -d

# Levantar con rebuild
docker compose up --build -d

# Solo DB + Cache
docker compose up postgres redis -d

# Ver logs
docker compose logs -f api
docker compose logs --tail=50 aegis

# Reiniciar servicio
docker compose restart api

# Detener todo
docker compose down

# Detener + eliminar volúmenes (DESTRUCTIVO)
docker compose down -v
```

## Desarrollo Local (sin Docker)
```powershell
# API
cd api; node index.js

# Aegis
cd aegis; python main.py

# Frontend
cd control-center/frontend; npx next dev -p 3000
```

## Volúmenes Persistentes
- `pg-data/` → PostgreSQL data
- `geth-data/` → op-geth chain data

## Health Checks
```powershell
# Secure local checks (sin Invoke-RestMethod)
node scripts/secure-health-check.js

# PostgreSQL
docker compose exec postgres pg_isready

# Redis
docker compose exec redis redis-cli ping
```
