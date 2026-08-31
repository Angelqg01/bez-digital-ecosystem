# Backlog ejecutable inmediato

## Sprint 0 (hoy)
- [x] Ejecutar `pnpm hub:migration:check`.
- [x] Corregir paths y puertos faltantes reportados por el check.
- [x] Confirmar owners por dominio (Hub vs subapps).
- [x] Marcar rutas Hub como `KEEP|MIGRATE|DELETE`.

## Sprint 1
- [x] Activar App Switcher en Hub con deep links estables.
- [x] Migrar accesos operativos de Wallet/Gas/Nodes/Vision/DeFi a enlaces de subapps.
- [x] Mantener en Hub solo vistas agregadas (estado global, no operativa).

## Sprint 2
- [x] Consolidar auth/roles/billing/developer console en Hub.
- [x] Alinear consumo API por `@bezhas/api-gateway` y SDK compartido.
- [x] Desactivar rutas backend duplicadas en Hub (feature flags o deprecacion).

## Sprint 3
- [x] Eliminar paginas y rutas legacy duplicadas.
- [x] Ejecutar smoke tests cross-app.
- [x] Validar release con rollback documentado.

