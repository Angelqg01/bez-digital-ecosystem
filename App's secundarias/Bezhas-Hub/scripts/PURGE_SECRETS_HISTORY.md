# Runbook — Purga de secretos del historial de Git

> ⚠️ **OPERACIÓN DESTRUCTIVA.** Reescribe el historial (cambia todos los SHAs).
> Requiere `--force` al hacer push y **coordinación con todo el equipo** (todos deben
> re-clonar o resetear sus copias). Ejecutar de forma deliberada, NO en automático.
>
> **Pre-requisito imprescindible:** las credenciales ya deben estar **ROTADAS**.
> Purgar el historial NO invalida una clave; solo la borra del repo. Si la clave sigue
> activa y fue expuesta, sigue comprometida hasta rotarla en su servicio.

Ficheros a eliminar de **todo** el historial:

- `BEZHAS_API_KEYS_ABIS_WEBHOOKS.txt`
- `BEZHAS_CONEXION_TERCEROS_OPENCLAW_AEGIS.txt`
- `temp_secret.txt`

---

## 0. Antes de empezar

```bash
# Backup completo del repo (por si algo sale mal)
git clone --mirror <URL_DEL_REPO> bezhas-hub-backup.git

# Asegúrate de tener todo commiteado/stasheado y la rama limpia
git status
```

---

## Opción A — git filter-repo (recomendada)

Instalar: `pip install git-filter-repo`  (o `brew install git-filter-repo`)

```bash
# Desde la raíz del repo (NOTA: la app está en "App's secundarias/Bezhas-Hub";
# las rutas son relativas a la raíz del repo git, ajústalas si el repo
# tiene su raíz en otro nivel).

git filter-repo --invert-paths \
  --path "App's secundarias/Bezhas-Hub/BEZHAS_API_KEYS_ABIS_WEBHOOKS.txt" \
  --path "App's secundarias/Bezhas-Hub/BEZHAS_CONEXION_TERCEROS_OPENCLAW_AEGIS.txt" \
  --path "App's secundarias/Bezhas-Hub/temp_secret.txt"
```

`git filter-repo` elimina el remoto `origin` por seguridad. Vuelve a añadirlo y push forzado:

```bash
git remote add origin <URL_DEL_REPO>
git push origin --force --all
git push origin --force --tags
```

---

## Opción B — BFG Repo-Cleaner (más simple, por nombre de fichero)

Descargar `bfg.jar` de https://rtyley.github.io/bfg-repo-cleaner/

```bash
# BFG opera sobre un clon --mirror
git clone --mirror <URL_DEL_REPO> bezhas-hub.git

java -jar bfg.jar --delete-files BEZHAS_API_KEYS_ABIS_WEBHOOKS.txt bezhas-hub.git
java -jar bfg.jar --delete-files BEZHAS_CONEXION_TERCEROS_OPENCLAW_AEGIS.txt bezhas-hub.git
java -jar bfg.jar --delete-files temp_secret.txt bezhas-hub.git

cd bezhas-hub.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

> BFG borra por **nombre de fichero** en cualquier ruta, así que no necesitas
> la ruta completa. Útil si el fichero estuvo en varias ubicaciones.

---

## Después de la purga

1. **Todo el equipo** debe re-clonar o ejecutar:
   ```bash
   git fetch origin && git reset --hard origin/<rama>
   ```
   (sus ramas viejas apuntan a SHAs que ya no existen).
2. Verificar que los ficheros ya no están en el historial:
   ```bash
   git log --all --oneline -- "**/BEZHAS_API_KEYS_ABIS_WEBHOOKS.txt"
   # (sin salida = purgado)
   ```
3. Si el repo está en GitHub: los commits viejos pueden seguir cacheados un tiempo.
   Abre un ticket de soporte de GitHub para purgar referencias colgantes si fueron
   credenciales muy sensibles.
4. Confirmar que `.gitignore` ya bloquea estos ficheros (hecho en Fase 0) para que
   no vuelvan a entrar.

---

## Checklist

- [ ] Credenciales **rotadas** en sus servicios (OpenClaw, AEGIS, Subscription GW, OAuth, Vinted/Shopify/Amazon…)
- [ ] Backup `--mirror` del repo creado
- [ ] Purga ejecutada (Opción A o B)
- [ ] `git push --force` realizado
- [ ] Equipo notificado para re-clonar
- [ ] Verificado: `git log --all -- <fichero>` sin resultados
