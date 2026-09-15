# Configurar el despliegue a Google Cloud

El workflow `.github/workflows/deploy-gcp.yml` construye las imágenes y las
despliega en Cloud Run. Hoy **no se ejecuta**: faltan tres secretos en el
repositorio, así que el job de comprobación lo salta con un aviso.

Este documento tiene lo que hace falta para activarlo. Son pasos que exigen
acceso a la consola de Google Cloud y permiso de administración sobre el
repositorio; no se pueden automatizar desde el propio repositorio.

---

## Lo que falta

| Secreto | Qué es | Ejemplo |
|---|---|---|
| `GCP_PROJECT_ID` | Identificador del proyecto | `bezhas-prod-123456` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Ruta completa del proveedor de identidad | `projects/123456789/locations/global/workloadIdentityPools/github/providers/mi-repo` |
| `GCP_SERVICE_ACCOUNT` | Correo de la cuenta de servicio que despliega | `github-deployer@bezhas-prod-123456.iam.gserviceaccount.com` |

Se definen en **Settings → Secrets and variables → Actions → New repository
secret**.

## Por qué no hay ninguna clave JSON

El workflow usa **Workload Identity Federation**: GitHub le demuestra a Google
quién es mediante un token de corta duración que Actions emite para cada
ejecución, y Google lo cambia por credenciales temporales.

Eso significa que **no hay que crear ni guardar una clave de cuenta de
servicio**. Es deliberado: una clave JSON en un secreto de GitHub es una
credencial de larga duración que no caduca, que cualquiera con acceso al
repositorio puede llegar a filtrar en un log, y que hay que rotar a mano. La
federación evita las tres cosas.

Si en algún momento alguien propone volver a `credentials_json`, conviene saber
que es un paso atrás en seguridad, no una simplificación.

## Cómo crearlo

Con `gcloud` autenticado contra el proyecto. Sustituye los valores de las tres
primeras líneas.

```bash
PROYECTO="bezhas-prod-123456"
REPO="Angelqg01/bez-digital-ecosystem"
SA="github-deployer"

NUM_PROYECTO=$(gcloud projects describe "$PROYECTO" --format='value(projectNumber)')

# 1. APIs necesarias.
gcloud services enable \
    iamcredentials.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    --project="$PROYECTO"

# 2. Cuenta de servicio que ejecutará el despliegue.
gcloud iam service-accounts create "$SA" \
    --project="$PROYECTO" \
    --display-name="Despliegue desde GitHub Actions"

SA_EMAIL="${SA}@${PROYECTO}.iam.gserviceaccount.com"

# 3. Permisos. Solo lo que el workflow necesita: publicar imágenes y
#    desplegar en Cloud Run. Nada de roles amplios como editor u owner.
for ROL in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
    gcloud projects add-iam-policy-binding "$PROYECTO" \
        --member="serviceAccount:${SA_EMAIL}" --role="$ROL"
done

# 4. Pool y proveedor de identidad para GitHub.
gcloud iam workload-identity-pools create github \
    --project="$PROYECTO" --location=global \
    --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc mi-repo \
    --project="$PROYECTO" --location=global \
    --workload-identity-pool=github \
    --display-name="bez-digital-ecosystem" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository == '${REPO}'"

# 5. Autorizar SOLO a este repositorio a suplantar esa cuenta.
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --project="$PROYECTO" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${NUM_PROYECTO}/locations/global/workloadIdentityPools/github/attributes.repository/${REPO}"

# 6. Los tres valores que hay que pegar en los secretos de GitHub.
echo
echo "GCP_PROJECT_ID=${PROYECTO}"
echo "GCP_SERVICE_ACCOUNT=${SA_EMAIL}"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${NUM_PROYECTO}/locations/global/workloadIdentityPools/github/providers/mi-repo"
```

Dos detalles del paso 4 y 5 que conviene no saltarse:

- **`--attribute-condition`** restringe el proveedor a este repositorio. Sin
  ella, cualquier repositorio de GitHub podría pedir un token para tu proyecto.
- **`principalSet://…/attributes.repository/${REPO}`** en el paso 5 vuelve a
  acotar quién puede suplantar la cuenta. Es la misma idea aplicada a la
  cuenta de servicio, y las dos capas se complementan.

## Comprobar que funciona

Al empujar a `main`, el job **«Comprobar configuración de despliegue»** deja de
avisar y los jobs `Build Docker Images` y `Deploy to Production` se ejecutan.
Si fallan a partir de ahí, el fallo es real y debe mirarse.

---

## Antes de activarlo, una cosa que conviene decidir

**El pipeline prueba una aplicación y despliega otra.**

| | Qué usa |
|---|---|
| Pruebas de la CI | `backend/` (437 ficheros, 779 pruebas) |
| `deploy-gcp.yml` | `api/` (1 fichero, `jest --passWithNoTests`) |
| `cloudbuild.yaml` | `backend/Dockerfile.optimized` |
| `docker-compose.yml` | `./backend/Dockerfile` |
| `docker-compose.gcp.yml` | `./backend/Dockerfile.optimized` |
| `package.json` → `build:backend:docker` | `backend/Dockerfile.optimized` |

Lo mismo en el frontend: la CI compila `frontend/` y el workflow despliega
`frontend-next/`.

No parece un descuido: el commit `f0fa33e` («realign CI/CD workflows and
dockerize Next.js and API backend») apuntó el workflow a `api/` y
`frontend-next/` a propósito, así que hay una migración en marcha. Pero
mientras dure, **el despliegue publicaría código que ninguna prueba ha
tocado**, y las 779 pruebas del backend no cubrirían lo que corre en
producción.

Hay que decidir cuál de las dos es la buena antes de activar el despliegue, y
apuntar las pruebas a esa. Es una decisión de arquitectura, no de
configuración, y por eso no se ha tomado aquí.
