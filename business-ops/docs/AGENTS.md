# El ejército de agentes

Jerarquía de tres niveles + herramientas transversales.

| Nivel | Rol | Clase base | Modelo típico |
|---|---|---|---|
| 1 | Orquestador (Director General IA) | `Orchestrator` | frontier |
| 2 | Managers de departamento | `DepartmentManager` | frontier |
| 3 | Especialistas (ejecutores) | `BaseAgent` | fast / frontier según tarea |

## Anatomía de un agente (`BaseAgent`)

Tres métodos clave que hereda todo agente:

- **`think(prompt)`** — razona con el modelo de su `modelTier`, inyectando casos pasados
  relevantes desde la memoria (RAG).
- **`act(action)`** — intenta ejecutar una acción. Si cruza una línea roja, se pausa y se
  pide aprobación humana automáticamente.
- **`remember(interaction)`** — guarda el resultado para el bucle de aprendizaje.

## Crear un especialista nuevo

```js
const BaseAgent = require('../BaseAgent');

class TicketTriageAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.triage',
      name: 'Ticket Triage',
      department: 'support',
      modelTier: 'fast',                 // alto volumen → barato
      capabilities: ['support:triage'],
      systemPrompt: 'Clasificas tickets por urgencia y tema. Devuelves JSON.',
    });
  }

  async run(task) {
    const out = await this.think(`Clasifica este ticket: ${task.payload.text}`);
    return { triage: out, status: 'ok' };
  }
}
module.exports = TicketTriageAgent;
```

Luego se registra en el manager del departamento:

```js
// dentro de SupportManager
this.routing = { 'support:triage': 'support.triage' };
this.registerSpecialist(new TicketTriageAgent(childCtx));
```

## Reglas de oro

1. Un especialista hace **una sola cosa**. Si necesita hacer dos, son dos agentes.
2. El `systemPrompt` debe ser específico y corto.
3. Usa `modelTier: 'fast'` salvo que la tarea sea de razonamiento o escritura de cara al
   cliente → `'frontier'`.
4. Toda acción con efecto externo va por `this.act()`, nunca directa al connector.
