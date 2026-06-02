# Estandar BEZ-Coin para contratos sectoriales

## Objetivo

Todos los contratos sectoriales nuevos o migrados deben usar BEZCoinV2 como moneda operativa principal cuando cobren fees, creen escrow, paguen recompensas, financien pools o repartan ingresos.

El contrato base esta en:

`src/core/BEZSectorStandard.sol`

## Regla comun

Un modulo sectorial compatible con BeZhas tokenomics debe exponer o heredar:

- `bezToken`: direccion de BEZCoinV2.
- `treasury`: tesoreria que recibe fees.
- `feeBps`: fee expresado en basis points.
- `quoteBEZFee(uint256 amount)`: calcula fee y neto.
- eventos `BEZFeeCollected`, `TreasuryUpdated`, `FeeBpsUpdated`.

## Patron de pago

1. El usuario aprueba BEZ al contrato sectorial.
2. El contrato llama `safeTransferFrom`.
3. El fee se envia a treasury.
4. El neto queda en escrow, va al vendedor o se reparte segun el sector.
5. El evento queda indexable para Core Gateway, agentes y tokenomics.

## Contratos ya conectados con BEZ

- BEZCoinV2
- StakingPool
- LiquidityFarming
- BeZhasPayment
- DeliveryEscrow
- EdgeNodeRewards
- ValidatorRegistry
- BeZhasDEX
- BeZhasBridgeL2 / BEZPolygonBridge
- CustomsClearanceOracle

## Contratos sectoriales a migrar desde ETH nativo

Prioridad alta:

- P2PEnergyMarket
- SolarFarmToken
- FleetLeaseEscrow
- EVChargeToken
- ProcurementNFT
- InvoiceFactoring
- MicroLendingPool
- TreasuryVault
- PolicyNFT
- ReinsurancePool
- ParametricInsurance
- EventTicketNFT
- RoyaltyDistributor
- StreamingRightsMarket
- CourseTokenNFT
- ScholarshipPool
- EduDAO
- ArbitrationDAO
- IPRegistryNFT
- P2PMarketplace
- FreelanceMarketplace
- SLAMonitor
- SubscriptionManager
- CrowdfundingPool
- CharityVault

## Criterio de finalizacion

Un contrato sectorial se considera estandarizado cuando:

1. No depende de `msg.value` para la operacion economica principal.
2. Usa `IERC20/SafeERC20` con BEZCoinV2.
3. Tiene fee configurable y tesoreria.
4. Emite eventos BEZ indexables.
5. Tiene prueba Foundry con `approve -> accion -> fee treasury -> neto`.
6. Esta mapeado en Core API y visible desde `modules/agents-ui`.
