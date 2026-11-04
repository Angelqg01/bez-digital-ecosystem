# Test de un trimestre: logística + cadena de frío + DeFi + 4 bancos

Simulación de 91 días de OPERANT con 4 navieras, 3 empresas de logística
terrestre, 1 de cadena de frío, un desk DeFi (BEZ, stablecoins, supply/yield,
farm/LP) y cuatro bancos: Dubái (AED), Miami (USD), Róterdam (EUR) y Algeciras (EUR).

- Código: [`evals/sim/quarter-sim.js`](../evals/sim/quarter-sim.js) · `node evals/sim/quarter-sim.js [semilla]`
- Resultado (semilla 2026): [`evals/sim/out/q1-seed2026.json`](../evals/sim/out/q1-seed2026.json)

## Qué es y qué no es
Es un **mundo sintético y reproducible** (semilla fija) pasado por los módulos
reales de OPERANT: `PolicyEngine` (líneas rojas), `screening` (KYC/AML),
`runwayMath` y `AuditLog` (cadena de hash). **No** usa clientes ni bancos reales
y **no** mueve dinero. **No** ejecuta los agentes con LLM: mide el contrato
determinista que los rodea. Las cifras de negocio (importes, tasas de excursión,
saldos) son supuestos; solo los de la tabla siguiente son públicos.

## Datos públicos usados (y su límite)
| Dato | Valor | Fuente / límite |
|---|---|---|
| Róterdam 2025 | 14,2 M TEU (13,8 M en 2024) | Informe anual de la autoridad portuaria vía prensa; sin dato reefer |
| Algeciras 2025 | ≈4,74 M TEU; ~100 Mt totales | Fuentes secundarias (LinkedIn/prensa); no verificado en Puertos del Estado |
| PortMiami FY2025 (oct–sep) | 1.115.058 TEU | Prensa; año fiscal, no natural |
| Jebel Ali 2025 | 15,55 M TEU | Lloyd's List / DP World |
| Reclamaciones reefer | ≈30 % de las reclamaciones de contenedores; 4,5 % de buques con alguna | Swedish Club 2017-21; mide reclamaciones, no % de carga perdida |
| APY stablecoins en Aave v3 | ~2 %–5 % (fuentes entre 1,8 % y 5,4 %), con saltos de 8,4 % a 3,1 % en 6 semanas | Fuentes dispares y sin fecha; contrastar en DeFiLlama |
| Flete Shanghái–Róterdam | 3.591 $/FEU | **Obsoleto** (oct 2024); no hallé dato de 2026 |
| Regulación | MiCA EMT/ART vigente desde 2024; VARA exige licencia por actividad | Fuentes secundarias; verificar en ESMA/VARA |

## Resultados (semilla 2026)
| Medida | Resultado |
|---|---|
| Acciones evaluadas | 1.769 (pagos 429, cripto 142, CRM 629, correo 440, firmas 121, tesorería 8) |
| Exigieron humano | 862 (**48,7 %**); pico 18/día, media 13,3 por día laborable |
| Capacidad humana supuesta | 40/día → 0 días desbordados |
| Pagos | 558 por 48,2 M$ (SEPA 158, SWIFT 271, BEZ 129); todos los de dinero y cripto pasaron por humano |
| Auditoría | 1.769 registros, cadena íntegra; al alterar uno, detectado en su posición exacta |
| DeFi | caída de APY (día 41) y depeg de USDC al 0,96 (día 62) detectado el mismo día |
| Tesorería | runway 17,9 → 11,6 meses, 0 semanas críticas (**depende de saldos supuestos**) |
| Cadena de frío | 780 contenedores, 4 excursiones, 2 reclamaciones (muestra pequeña) |

## Hallazgos (lo que el test enseña)
1. **El cribado AML no servía para B2B — corregido.** El umbral fijo de 5.000 $
   marcó 552 de 558 pagos como riesgo *medio*; el revisor se habría acostumbrado a
   ignorarlos. Ahora `screen({ segment: 'b2b' })` usa 100.000 $ (la compra de BEZ
   sigue en 5.000 $). Repetida la simulación: 374 bajos y 184 medios (los fletes
   grandes de naviera), en lugar de 6 y 552.
2. **Hueco en países de alto riesgo — corregido en lo básico.**
   [`screening.js`](../src/compliance/screening.js) solo detectaba Irán y Venezuela.
   Ahora incluye Rusia, Bielorrusia, Myanmar/Birmania y Afganistán, sin depender de
   tildes y por palabra completa ("Miranda" ya no salta como "Irán"). **Sigue siendo
   una lista mínima:** antes de operar con volumen real, y con bancos en Dubái,
   debe sustituirse por las listas oficiales vigentes (UE, OFAC, ONU, GAFI).
3. **El runway no ve divisas ni stablecoins.** `calcRunway` recibe un único número
   en USD: un depeg del 4 % o la exposición en AED/EUR no cambian el resultado.
4. **Detectar no es actuar.** Retirar una posición DeFi tras un depeg es
   `treasury_movement`, siempre con humano. El test detecta el día 0, pero no mide
   cuánto tarda el humano: con un depeg real, esa latencia es la pérdida.
5. **Lo que funciona:** las líneas rojas (ningún pago, cripto, staking ni firma
   salió sin humano) y la auditoría encadenada.

## Límites del test (honestidad)
- La carga humana (48,7 %) refleja mi mezcla de acciones, no la de un cliente real.
- Excursiones de frío: 4 casos no sacan conclusiones; la tasa del 0,8 % es supuesta.
- No cubre el trabajo de los agentes con LLM (calidad de redacción, enrutado real);
  para eso están las evals con `EVALS_LIVE=1`.
- No hay datos on-chain reales de BEZ ni de pools; el farm/LP es un modelo de APY decreciente.

## Siguiente paso propuesto
Cargar la lista de sanciones desde una fuente oficial; que `runwayMath` acepte
saldos por divisa y exposición a stablecoins; y medir la latencia de aprobación
en el escenario del depeg.
