# Multi-tenencia

La diferencia central entre "un runtime para mi empresa" y "un producto SaaS" es el
**aislamiento de datos entre clientes**. Es lo más caro de añadir después, así que se
diseña correcto desde el día 1.

## Tres niveles de aislamiento

1. **Aislamiento lógico de ejecución** (`TenantManager`)
   Cada empresa cliente recibe su propio "espacio": EventBus, memoria, política, auditoría
   y orquestador con su ejército. Nada se comparte en memoria entre tenants.

2. **Aislamiento de datos en Postgres** (Row-Level Security)
   Toda tabla del plano de datos lleva `tenant_id`. Cada transacción fija `app.tenant_id`
   (`PostgresStore._withTenant`) y las políticas RLS garantizan que una consulta solo ve
   filas de ese tenant. Ver `src/db/migrations/001_init.sql`.

   ```sql
   SELECT set_config('app.tenant_id', 'acme', true);   -- dentro de la transacción
   ```

   **Con qué rol te conectes decide si esto sirve de algo.** Postgres no aplica RLS a los
   superusuarios ni a los roles con `BYPASSRLS`, y exime al dueño de la tabla salvo que se
   declare `FORCE ROW LEVEL SECURITY`. La imagen de Docker crea `POSTGRES_USER` como
   superusuario y dueño del esquema: conectando la aplicación con ese rol —lo que hacía la
   configuración por defecto— las políticas no filtraban nada y un `SELECT` sin `WHERE`
   dentro del contexto de un tenant devolvía también las filas de los demás. Comprobado, no
   supuesto (`test/store-contract.test.js`).

   Por eso hay dos roles y un guardián:

   | Rol | Para qué | Privilegios |
   |---|---|---|
   | `POSTGRES_USER` (dueño) | migraciones (`npm run db:migrate`) | DDL, superusuario |
   | `operant_app` | la aplicación (`DATABASE_URL`) | solo DML, sin superusuario, sin BYPASSRLS |

   `PostgresStore.connect()` **se niega a arrancar** si detecta que está conectado con un rol
   que se salta la RLS. Es la única forma de que una fuga entre clientes no pase inadvertida:
   mal configurado, todo *funciona*, simplemente se ve de más.

   El plano de control (`tenants`, `api_keys`) va sin RLS a propósito: el proceso necesita el
   inventario completo al arrancar, antes de saber a qué tenant sirve, y ahí no hay contenido
   de cliente — plan, departamentos y hashes de clave.

3. **Aislamiento en el vector DB** (namespaces)
   La memoria episódica se indexa con el `tenant_id` como namespace/filtro obligatorio. Una
   búsqueda de similitud nunca cruza tenants.

## Aprovisionar una empresa

```js
await tenants.provision({
  tenantId: 'acme',
  plan: 'pro',
  departments: ['sales', 'support', 'marketing'],
  tools: { email: new EmailConnector({ tenantId: 'acme' }) },
  notify: (req) => { /* avisar al humano de una aprobación HITL */ },
});
```

El plan determina qué departamentos se instancian y los límites (concurrencia, llamadas/mes).
Ver `config/plans.json`.

## Puesta en marcha con Postgres

```bash
npm run db:up                                                  # Postgres + pgvector
PG_APP_PASSWORD='<contraseña>' \
  DATABASE_URL=postgres://user:pass@localhost:5432/operant \
  npm run db:migrate                                           # como DUEÑO: crea esquema y rol

DATABASE_URL=postgres://operant_app:<contraseña>@localhost:5432/operant npm run server
```

Para comprobar que el aislamiento es real antes de confiar en él, la batería de contrato
corre contra la base viva (35 pruebas, incluidas las de RLS):

```bash
DATABASE_URL=postgres://operant_app:<contraseña>@localhost:5432/operant npm test
```

## Checklist de seguridad multi-tenant

- [ ] Toda tabla del plano de datos tiene `tenant_id` y RLS **forzada**.
- [ ] La aplicación se conecta con `operant_app`, nunca con el dueño ni con un superusuario.
- [ ] Toda búsqueda vectorial filtra por `tenant_id`.
- [ ] El `tenantId` viaja en cada llamada al `ModelGateway` (telemetría/coste por cliente).
- [ ] Cifrado de secretos por tenant (claves de sus connectors).
- [ ] El `AuditLog` separa por `tenant_id`.
- [ ] Ningún endpoint permite pasar `tenantId` sin verificar que el usuario pertenece a él.
