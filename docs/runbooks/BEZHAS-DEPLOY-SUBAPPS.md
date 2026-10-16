# Despliegue conjunto: API + SubApps (rama `feat/rag-endurecimiento`, PR 103)

Orden obligatorio: **primero la API, después las SubApps**. Las SubApps nuevas llaman a rutas que la API anterior no tiene
(`/api/purescan/*`, `/api/energy/nodes`, `/api/energy/telemetry/ingest`) y el desbloqueo de planes (GPS/cámara) depende de
`/api/ai-billing/subscription` corregido.

## 0. Antes de empezar
- Copia de seguridad de Cloud SQL: `gcloud sql backups create --instance bezhas-pg`.
- Nunca pases `--reset` a `db/migrate.js`.
- Revisa las migraciones pendientes **049–066** (`api/db/migrations/`): la 051 revoca claves de desarrollo; la 065 añade columnas e
  índice de búsqueda; la **066 crea `vpp_nodes`** (conectar plantas). Todas son aditivas salvo lo que diga cada una.
- Comprobado en local con Docker (energy, cargolink, purescan, prestige, wallet y gas construyen; ver «Qué se verificó»): el filtro de subida (`deploy/gcp/subapps/.gcloudignore`) deja fuera
  `Billetera Yoroi frases de recuperación.txt` y los `.env`, e incluye el PDF de Energy. **Aun así, saca ese archivo del repositorio.**

## 1. API
1. `./deploy/gcp/deploy.sh` (el job `bezhas-db-migrate` aplica 049–066).
2. Reindexa el conocimiento (el tokenizador cambió): `gcloud run jobs execute bezhas-db-migrate --region us-central1 --args "scripts/knowledge-reindex.js" --wait`
3. Después `KNOWLEDGE_RETRIEVAL=fts` con `--update-env-vars`; `PINATA_JWT`, `ANTHROPIC_API_KEY`/`AI_MODEL_ANTHROPIC`, `REDIS_URL`; `JWT_STRICT_CLAIMS` el último.
4. Energía: no hace falta clave (OMIE y REE son públicos). `ESIOS_API_KEY` es opcional (precio spot de ESIOS).

### Smoke tests de la API (con un token de prueba)
```bash
API=https://api.bezhas.com/api
curl -s -o /dev/null -w '%{http_code}\n' $API/purescan/inventory                         # 401 (antes 404)
curl -s $API/ai-billing/subscription -H "Authorization: Bearer $TOKEN"                    # {"tier":…}, nunca 500
curl -s $API/energy/market/omie -H "Authorization: Bearer $TOKEN" | grep -o '"simulated":[a-z]*'   # false
curl -s -X POST $API/energy/telemetry/ingest -H 'Authorization: Bearer bzn_00' -d '{}' -w '%{http_code}\n'   # 401 INVALID_NODE_KEY
curl -s $API/energy/nodes -H "Authorization: Bearer $TOKEN" | grep -o '"simulated":[a-z]*'            # true hasta conectar una planta
```

## 2. SubApps
```bash
./deploy/gcp/deploy-subapps.sh energy purescan cargolink wallet gas prestige
```
(`pay` y `sphere` no cambian; Sphere no está en la lista de despliegue.) Cada app se construye con su Dockerfile y se publica como
`bezhas-<app>`; el script termina comprobando el HTTP de cada subdominio.

### Smoke tests de las SubApps
- `energy.bezhas.com`: SCADA → «Conectar planta»; `/BeZhas_Autonomous_Infrastructure_Energy.pdf` responde 200.
- `cargolink.bezhas.com`: el mapa carga teselas (OpenStreetMap); con una clave de operador se crea un B-UID y su corredor.
- `purescan.bezhas.com`: con plan Creator Pro o superior se pide la cámara; sin agente de análisis, «No hay un agente disponible…» (503 honesto).
- Cabeceras de CargoLink, Prestige, Wallet: botón de configuración con Entrar/Salir dentro.

## 3. Marcha atrás
- SubApp: `gcloud run services update-traffic bezhas-<app> --to-revisions <revisión-anterior>=100 --region us-central1`.
- API: ver `BEZHAS-AI-ROLLBACK.md`. Las migraciones 065/066 sólo añaden; no hace falta deshacerlas.

## Qué se verificó antes de escribir esto
`vite build` de cada SubApp, tests de la API (energía, PureScan, planes, conocimiento), build de Docker local de cada imagen con el
mismo conjunto de archivos que sube Cloud Build, y pruebas en navegador contra la API del repositorio.
## Lo que NO se ha hecho
Nada se ha desplegado en GCP. El balanceador/DNS de las SubApps nuevas (wallet, gas, edge, vision, pay, prestige, sphere, genesis) no se
han tocado. No se probó con Claude (sin clave válida) ni en Cloud SQL real.
