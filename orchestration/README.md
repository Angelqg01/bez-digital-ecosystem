# BeZhas Orchestration Layer

This folder contains the canonical orchestration contract for the BeZhas autonomous agent platform.

## Files

- `orchestration-manifest.json`: departments, MCPs, task routes, event streams, approval policy, KPIs, and SKILL feedback-loop metadata.

## Runtime Integration

`agent-runtime` now loads this manifest through:

- `agent-runtime/core/OrchestrationManifest.js`
- `agent-runtime/core/OrchestrationEventPublisher.js`

`AgentManager` uses the manifest route table before its legacy local route map. Every dispatched task is enriched with:

- `orchestration.departmentId`
- `orchestration.routeAgentId`
- `orchestration.eventStream`
- `orchestration.kpis`

Lifecycle events are published to Redis Streams when Redis is connected:

- `bezhas:events:all`
- `bezhas:events:tokenomics`
- `bezhas:events:growth`
- `bezhas:events:blockchain`
- `bezhas:events:sdk`
- `bezhas:events:skills`
- `bezhas:events:risk`
- `bezhas:events:approvals`

## CLI

From `agent-runtime`:

```bash
npm run orchestration -- status
npm run orchestration -- departments
npm run orchestration -- route growth:qualify
npm run orchestration -- dry-run growth:qualify "{\"account\":\"TransLogistica SA\"}"
```

## API

When `AgentServer` is running:

```http
GET /api/orchestration
GET /api/orchestration/route/:taskType
POST /api/tasks
```

Example dispatch:

```json
{
  "type": "growth:qualify",
  "priority": "normal",
  "source": "control-center",
  "payload": {
    "account": "TransLogistica SA",
    "sector": "logistics"
  }
}
```

## Approval Policy

Read-only analysis and drafting are allowed by default. External, financial, legal, on-chain, treasury, outreach, and SKILL-publishing actions require human approval according to `approvalPolicy.requireHumanApproval`.

## Next Implementation Steps

1. Add Redis Stream consumers for dashboards and feedback-loop workers.
2. Add specialized agents for growth, solutions, finance, blockchain, devops, and skill optimization.
3. Connect `lead-generation`, `blockchain`, and `compliance` MCP servers as real services instead of planned entries.
4. Persist KPI rollups in Postgres for the executive dashboard.
5. Promote approved SKILL improvements through versioned change proposals.
