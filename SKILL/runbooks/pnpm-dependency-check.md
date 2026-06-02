# BeZhas SKILL — Comprobación Diaria de Dependencias PNPM
## AI Knowledge Base Runbook

Este SKILL documenta y automatiza la tarea crítica de verificar que todas las dependencias del monorepo y sus aplicaciones secundarias estén actualizadas, garantizando la seguridad, estabilidad y rendimiento de la plataforma.

---

## 1. Automatización y Cron Activo

El agente de IA tiene configurado un recordatorio cron diario en el sistema para ejecutar esta comprobación de forma automática:
*   **Expresión Cron**: `0 9 * * *` (Todos los días a las 9:00 AM)
*   **Acción del Agente**: Despertar, ejecutar el comando de verificación e informar al desarrollador sobre paquetes obsoletos o vulnerabilidades críticas.

---

## 2. Comandos Operacionales de Verificación

Dado que este proyecto utiliza **PNPM v11+** como estándar obligatorio del monorepo, los comandos deben ejecutarse exclusivamente con `pnpm`:

### 2.1 Verificación en la Raíz del Proyecto
Comprueba las dependencias globales y del backend principal:
```bash
cd D:\BeZhas-Blockchain
pnpm outdated
```

### 2.2 Verificación en Aplicaciones Secundarias (Monorepo de Aplicaciones)
Comprueba recursivamente todas las aplicaciones en el monorepo de aplicaciones secundarias (Hub, Wallet, Capital, etc.):
```bash
cd "D:\BeZhas-Blockchain\App's secundarias"
pnpm outdated -r
```

---

## 3. Guía de Actualización Segura

Si la comprobación reporta paquetes desactualizados, sigue estas directrices para realizar la actualización sin romper la compatibilidad:

### 3.1 Actualización Interactiva (Recomendada)
Para actualizar selectivamente a través de una interfaz interactiva de consola:
```bash
# Para el backend principal
pnpm update -i

# Para las aplicaciones secundarias de forma recursiva
pnpm update -i -r
```

### 3.2 Forzar Actualización de Parches y Minor Versions
Para actualizar de forma segura minor y patch versions respetando el rango semántico fijado en `package.json`:
```bash
pnpm update
```

### 3.3 Resolución de Conflictos y Auditoría de Seguridad
Si se sospecha de dependencias vulnerables, ejecuta la auditoría:
```bash
pnpm audit
```
Si hay advertencias de dependencias *peer*, evita el uso de `--force` y en su lugar declara las resoluciones explícitas en el `package.json` de la raíz en la sección `"pnpm": { "overrides": { ... } }`.

---

## 4. Registro de Historial de Actualizaciones
*   **Fecha de Creación**: 2026-05-23
*   **Autor**: Antigravity (AI Developer Agent)
*   **Estatus**: Recordatorio automatizado programado con éxito.
