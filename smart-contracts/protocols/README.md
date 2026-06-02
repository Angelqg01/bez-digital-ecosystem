# BeZhas Vertical Protocols

This folder converts the sector vision into deployable protocol definitions.

`vertical-protocols.json` is the source of truth for each vertical:

- Contracts bound to the protocol.
- Operational flows.
- Permission actors and approval boundaries.
- Oracle dependencies.
- Test files that must pass before release.
- Deployment script and required environment.
- CTO/CISO documentation path.

Run:

```powershell
node script\validate-vertical-protocols.js
node script\deploy-protocol.js logistics-global-kinetics
```

The deploy helper is intentionally conservative: it validates and prints the Foundry command, but does not broadcast transactions by itself.
