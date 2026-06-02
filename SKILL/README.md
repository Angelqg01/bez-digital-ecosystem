# BeZhas SKILL System
## AI Knowledge Base & Feedback Loop

Este directorio contiene el **sistema de entrenamiento incremental** para la IA interna de BeZhas.
Cada carpeta almacena conocimiento estructurado que el LLM/MCP/SDK usa para:

1. **Reducir tokens de IA** → La IA consulta SKILLs locales antes de generar respuestas genéricas
2. **Feedback loop** → Errores, soluciones y patrones se registran automáticamente
3. **Autonomía creciente** → Con cada iteración, la IA sabe más sobre la plataforma
4. **CLI + Herramientas** → Documentación interna de cada herramienta disponible

## Estructura

```
SKILL/
├── README.md                    ← Este archivo
├── MASTER_INDEX.md              ← Índice maestro de todo el conocimiento
├── config/                      ← Configuraciones del ecosistema
│   ├── blockchain.md            ← Parámetros L2, Chain ID, genesis
│   ├── contracts.md             ← Direcciones, ABIs, roles
│   ├── infrastructure.md        ← Docker, puertos, servicios
│   └── security.md              ← Políticas de seguridad, claves, permisos
├── runbooks/                    ← Procedimientos operacionales
│   ├── deploy.md                ← Cómo desplegar contratos
│   ├── monitor.md               ← Cómo monitorear el sistema
│   ├── incident-response.md     ← Qué hacer ante incidentes
│   └── wallet-operations.md     ← Operaciones de wallet (staking, farming, etc.)
├── solutions/                   ← Problemas resueltos (base de conocimiento)
│   ├── compilation-errors.md    ← Errores de compilación y soluciones
│   ├── test-failures.md         ← Tests fallidos y correcciones
│   ├── deployment-issues.md     ← Problemas de deploy
│   └── runtime-errors.md        ← Errores en runtime
├── patterns/                    ← Patrones de código validados
│   ├── solidity.md              ← Patrones Solidity para BeZhas
│   ├── api.md                   ← Patrones Express/Node.js
│   ├── frontend.md              ← Patrones Next.js/React
│   └── testing.md               ← Patrones de testing
├── cli/                         ← Documentación de herramientas CLI
│   ├── forge.md                 ← Comandos Foundry/Forge
│   ├── docker.md                ← Comandos Docker
│   ├── api-cli.md               ← Endpoints internos
│   └── sdk-cli.md               ← Uso del SDK
├── training/                    ← Datos de entrenamiento agrupados
│   ├── architecture.md          ← Arquitectura consolidada
│   ├── contracts-catalog.md     ← Catálogo completo de contratos
│   ├── api-catalog.md           ← Catálogo completo de API
│   └── security-playbook.md     ← Playbook de seguridad
└── feedback/                    ← Registro de feedback loop
    ├── log.md                   ← Log cronológico de acciones
    ├── metrics.md               ← Métricas de rendimiento IA
    └── improvements.md          ← Mejoras identificadas pendientes
```

## Cómo funciona el Feedback Loop

```
┌─────────────────────────────────────────────────────────┐
│                    FLUJO SKILL                          │
│                                                         │
│  1. IA recibe tarea                                     │
│  2. Consulta SKILL/MASTER_INDEX.md                      │
│  3. Lee SKILLs relevantes (config/, runbooks/, etc.)    │
│  4. Ejecuta la tarea con contexto local                 │
│  5. Si hay error → registra en solutions/               │
│  6. Si hay éxito → actualiza patterns/                  │
│  7. Escribe en feedback/log.md                          │
│  8. Próxima vez → menos tokens, más precisión           │
└─────────────────────────────────────────────────────────┘
```

## Reglas para actualizar SKILLs

- **Siempre verificar** antes de escribir: ¿ya existe este conocimiento?
- **Formato consistente**: Markdown con headers, bullets, y code blocks
- **Versionado**: Cada entrada lleva fecha y actor
- **No duplicar**: Un hecho = un lugar canónico
- **Feedback primero**: Antes de agregar patterns, registrar en feedback/log.md
