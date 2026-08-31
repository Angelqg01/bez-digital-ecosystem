# Whitepaper (resumen técnico)

## Tesis

Las empresas operan como islas: cada una con su ERP, sus certificaciones y su verdad sobre el estado de una operación compartida. Cada vez que dos empresas necesitan coordinarse, reconstruyen la confianza desde cero — auditorías, conciliaciones, disputas.

BeZhas propone un puerto común: una capa donde el estado de un proceso compartido es **el mismo para todas las partes**, verificable y programable. El token BEZ no es un activo especulativo dentro de ese diseño: es el combustible que paga la infraestructura y el colateral que respalda a quien la opera.

## Arquitectura

### Blockchain L2 sobre OP Stack

- Ejecución EVM completa: cualquier herramienta Ethereum funciona
- Bloques de 2 segundos
- **BEZ como gas token personalizado** en lugar de ETH
- Anclaje a L1 para seguridad y disponibilidad de datos
- Secuenciación con rotación entre validadores elegibles

### Consenso corporativo

El validador no es anónimo: es una empresa registrada con nombre, stake y responsabilidad. `ValidatorRegistry` define cuatro tiers (Bronze a Platinum) con multiplicadores de 1× a 2×, un mínimo de uptime del 90% y un periodo de unbonding de 7 días. `SlashingManager` penaliza el incumplimiento contra el colateral.

Esto cambia el perfil de riesgo respecto a una red anónima: quien valida tiene identidad jurídica y algo que perder más allá del stake.

### DePIN B2B

`EdgeNodeRewards` paga por trabajo verificado, no por presencia: 0,0075 BEZ por punto de validación, con topes de 500 puntos por registro, 10.000 por nodo y día, y 100.000 BEZ de emisión diaria. El boost del tier multiplica el ingreso por el mismo trabajo.

### Capa sectorial

~88 contratos en 16 verticales, todos los que mueven valor heredando de `BEZSectorStandard` — misma tesorería, misma comisión acotada al 10%, mismo evento de trazabilidad.

### Capa de acceso

API Core, SDK `@bezhas/sdk`, RPC EVM y MCP para orquestación multi-agente. El objetivo de diseño es que una empresa pueda integrar sin escribir Solidity.

## Economía del token

| Concepto | Valor |
| --- | --- |
| Hard cap | 10.000.000.000 BEZ |
| Pre-mint | 3.000.000.000 BEZ (tesorería y liquidez) |
| Emisión posterior | Contra operación real, bajo cap, con `MINTER_ROLE` |
| Cap diario staking | 50.000 BEZ |
| Cap diario DePIN | 100.000 BEZ |

Los cuatro usos del token — gas, colateral de validación, voto y aprobaciones firmadas — están descritos en detalle en [BEZ-Coin](/docs/bez-coin).

**Nota de contabilidad:** las funciones de "quema" recolectan a tesorería en lugar de destruir supply. Cualquier modelo de supply circulante debe restar el saldo de tesorería explícitamente.

## Gobernanza

DAO sobre OpenZeppelin Governor con timelock: 1 día de retardo de voto, 1 semana de votación, umbral de propuesta de 10.000 BEZ y quórum del 4%. La ejecución pasa por un timelock que separa aprobar de aplicar. Ver [Gobernanza DAO](/docs/gobernanza-dao).

## Propuesta de valor para una empresa

| Beneficio | Mecanismo |
| --- | --- |
| Liquidación en tiempo real | Pago on-chain contra cumplimiento verificado |
| Due diligence más barata | Historial inmutable y auditable de la contraparte |
| Infraestructura que rinde | El nodo pasa de gasto a activo con recompensas |
| Voz en la red | Voto DAO sobre parámetros que afectan a su operación |
| Coste de gas presupuestable | Un único activo para toda la operativa |

## Marco regulatorio

El diseño contempla AEAT, MiCA (UE), SEPA y DAC8. Las decisiones de arquitectura relativas a datos personales — anclar hashes en lugar de contenido — responden directamente a la incompatibilidad entre inmutabilidad y derecho de supresión del RGPD.

## Hoja de ruta

- **Fases 1–16** — despliegue sectorial vertical por vertical
- **Fase 17+** — trazabilidad y monetización aduanera
- **Siguiente** — expansión sectorial, profundización de la capa de agentes IA y crecimiento de la red DePIN

---

*Este resumen cubre la arquitectura pública del protocolo. La documentación económica detallada, las auditorías y el material de due diligence se facilitan bajo acuerdo a través de los canales de contacto.*
