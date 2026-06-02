---
type: map
hierarchy: Admin
status: active
summary: Vista Markdown del mapa de autonomia, memoria y ejecucion blockchain BeZhas.
token: $BEZ
---

# BeZhas Blockchain Map

Mapa operativo para abrir junto al Canvas [[BeZhas-Autonomy-Loop.canvas]]. La vista del panel admin lo renderiza como un flujo organico: Director al centro, runtime como motor, blockchain/AEGIS como sentidos y Obsidian como memoria consolidada.

```mermaid
flowchart LR
  Director((Director Agent)) --> Critic{Critic / Self Evaluation}
  Critic --> Runtime[Agent Runtime]
  Runtime --> Blockchain[Blockchain Core]
  Runtime --> Aegis[AEGIS Monitoring]
  Runtime --> Sectors[Sector Agents]
  Runtime --> Telegram[Telegram HITL]
  Critic --> Obsidian[(Obsidian MCP)]
  Obsidian --> Memory[(Redis + Postgres + Vault)]
  Memory --> Director
  Blockchain --> Feedback[Closed Feedback Loop]
  Aegis --> Feedback
  Sectors --> Feedback
  Telegram --> Director
  Feedback --> Obsidian
```

## Criterio de uso

Obsidian consolida conocimiento, no ejecuta transacciones. La ejecucion queda en MCP tools con permisos y confirmacion humana por umbral.
