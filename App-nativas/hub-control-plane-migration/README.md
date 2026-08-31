# Hub Control Plane Migration Workspace

Esta carpeta concentra la estructura de trabajo para ejecutar la migracion completa de `Bezhas-Hub` hacia un rol de **Control Plane**.

## Estructura

- `00-governance/` reglas, alcance y criterios de aceptacion.
- `01-inventory/` catalogos de rutas, paginas y ownership.
- `02-architecture/` limites funcionales y contratos entre apps.
- `03-integration/` configuracion de conexiones objetivo.
- `04-execution/` backlog ejecutable por fases.
- `05-validation/` checks de integracion y handover.
- `scripts/` validadores automaticos.

## Arranque rapido

Desde `App's secundarias`:

```powershell
pnpm hub:migration:check
pnpm hub:migration:summary
```

## Resultado esperado

1. `Bezhas-Hub` queda solo con funciones de Control Plane.
2. Las funcionalidades operativas verticales viven en su subapp dedicada.
3. Las conexiones pasan por una capa compartida (`@bezhas/platform-sdk` y/o `@bezhas/api-gateway`).
4. Se reduce deuda tecnica de rutas legacy, mocks y duplicados.

