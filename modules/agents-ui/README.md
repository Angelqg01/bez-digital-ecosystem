# modules/agents-ui

Modulo centralizado de agentes JSX para el ecosistema BeZhas. Contiene **45 archivos** (41 agentes + 4 archivos base).

---

## Estructura por Sector

### Core / Logistica (13 archivos)
| Archivo | Descripcion |
|---------|-------------|
| `bezhas-agent-master.jsx` | Panel maestro - shell principal de agentes |
| `bezhas-agents-constants.js` | Constantes compartidas: GROUPS, MCP_TOOLS, CAT_COLOR, colores |
| `bezhas-agents-ui.jsx` | Componentes UI atomicos compartidos |
| `bezhas-ai-agents.jsx` | Definiciones de agentes IA por sector |
| `bezhas-budget-presupuesto.jsx` | Agente de presupuestos |
| `bezhas-rwa-roadmap.jsx` | Roadmap de activos RWA |
| `bezhas-tab-agents.jsx` | Tab de agentes |
| `bezhas-tab-bridge-merge.jsx` | Tab de bridge/merge |
| `bezhas-tab-mcp-bez.jsx` | Tab MCP |
| `customsclear-agent.jsx` | Agente de aduanas |
| `rwa-cargo-agent.jsx` | Agente de carga RWA |
| `shiptrack-agent.jsx` | Agente de rastreo maritimo |

### Bienes Raices (4 archivos — Fase 2)
| Archivo | Descripcion |
|---------|-------------|
| `real-estate-agents.jsx` | Agentes inmobiliarios (4 agentes en 1 archivo) |
| `cold-chain-agent.jsx` | Agente de cadena de frio |
| `maritime-insurance-agent.jsx` | Agente de seguros maritimos |
| `port-finance-agent.jsx` | Agente de financiamiento portuario |

### Salud (4 archivos — Fase 3)
| Archivo | Descripcion |
|---------|-------------|
| `medrecord-agent.jsx` | Registros medicos SBT |
| `pharmatrak-agent.jsx` | Trazabilidad farmaceutica |
| `claimbot-agent.jsx` | Escrow de seguros medicos |
| `biodata-agent.jsx` | Marketplace de datos clinicos |

### Energia Renovable (4 archivos — Fase 4)
| Archivo | Descripcion |
|---------|-------------|
| `greentoken-agent.jsx` | Creditos de carbono y RECs |
| `p2penergy-agent.jsx` | Mercado P2P de energia |
| `solardefi-agent.jsx` | Inversion fraccionada en renovables |
| `esgscore-agent.jsx` | Oraculo de scoring ESG on-chain |

### Automotriz (4 archivos — Fase 5)
| Archivo | Descripcion |
|---------|-------------|
| `vehiclenft-agent.jsx` | NFT de identidad vehicular |
| `autoparts-agent.jsx` | Registro anti-falsificacion de autopartes |
| `fleetdefi-agent.jsx` | Leasing descentralizado de flotas |
| `evcharge-agent.jsx` | Red tokenizada de carga EV |

### Manufactura (4 archivos — Fase 6)
| Archivo | Descripcion |
|---------|-------------|
| `qualitychain-agent.jsx` | Certificados de calidad NFT |
| `digitaltwin-agent.jsx` | Gemelos digitales con telemetria IoT |
| `supplymrp-agent.jsx` | Planificacion de materiales on-chain |
| `predmaint-agent.jsx` | Mantenimiento predictivo con IA |

### Agricultura (4 archivos — Fase 7)
| Archivo | Descripcion |
|---------|-------------|
| `croptoken-agent.jsx` | Futuros de cosecha tokenizados |
| `agrisupply-agent.jsx` | Trazabilidad farm-to-table |
| `aquafarm-agent.jsx` | Monitoreo IoT de acuacultura |
| `landregistry-agent.jsx` | Registro de titulos de tierra NFT |

### Seguros (4 archivos — Fase 8)
| Archivo | Descripcion |
|---------|-------------|
| `policynft-agent.jsx` | Polizas tokenizadas como NFTs |
| `claimadjuster-agent.jsx` | Ajuste de siniestros con IA |
| `reinsurance-agent.jsx` | Pools de reaseguro DeFi |
| `parametric-agent.jsx` | Seguros parametricos con oraculos |

### Educacion (4 archivos — Fase 9)
| Archivo | Descripcion |
|---------|-------------|
| `coursetoken-agent.jsx` | Cursos tokenizados con certificados NFT |
| `scholarpool-agent.jsx` | Pools de becas DeFi |
| `edudao-agent.jsx` | Gobernanza DAO institucional |
| `skillbadge-agent.jsx` | Micro-credenciales soulbound (SBT) |

---

## Patron de Cada Agente JSX

Cada agente sigue la misma estructura:
- ~250-300 lineas
- 5 tabs: Dashboard, Analytics, Contract ABI, Revenue Model, Live Activity
- Hook: `useState` + `useEffect` con `setInterval` (7-9s)
- Estilos inline con objeto local `S`
- Colores base: bg `#03060E`, card `#0C1628`, border `#0D2040`, text `#E8F4FF`
- 6 items de datos mock por agente
- Acento unico por agente

## Integracion con Frontend

```javascript
// next.config.mjs alias:
// @agents/* → ../../modules/agents-ui/*
import AgentComponent from '@agents/coursetoken-agent';
```
