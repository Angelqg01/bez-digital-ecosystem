# Smart contracts y ABIs

El protocolo consta de ~88 contratos organizados en un núcleo común y 16 verticales sectoriales. Todos son EVM (Solidity `^0.8.24`) y se construyen con **Foundry**.

## Cómo obtener direcciones y ABIs

Nunca copies una dirección a mano. Usa una de estas dos vías:

```js
// Vía SDK
const { getContract, getABI } = require('@bezhas/sdk');
const bez = getContract('BEZCoinV2', 'bezhas-l2');
const abi = getABI('BEZCoinV2');
```

```bash
# Vía API
curl https://api.bez.digital/api/gateway/v1/contracts/addresses
curl https://api.bez.digital/api/contracts-abi/BEZCoinV2
```

Se publican los ABI de las **interfaces públicas**. El código de despliegue, los scripts de operación y los contratos internos no se exponen.

## Núcleo del protocolo

| Contrato | Función |
| --- | --- |
| `BEZCoinV2` | Token nativo ERC-20 con Permit y Votes |
| `BEZSectorStandard` | Base común de cobro en BEZ para contratos sectoriales |
| `BeZhasPayment` | Procesador de pagos con comisión, lotes y reembolso |
| `BeZhasDEX` | Intercambio on-chain |
| `BeZhasLPToken` · `LiquidityFarming` | Liquidez y farming |
| `StakingPool` | Staking de BEZ con boost por tier |
| `ValidatorRegistry` | Registro de validadores, tiers y unbonding |
| `EdgeNodeRewards` | Recompensas DePIN por trabajo verificado |
| `SlashingManager` | Penalizaciones |
| `L2Sequencer` · `SequencerRotation` | Secuenciación y rotación |
| `GovernanceSystem` | DAO (OpenZeppelin Governor + Timelock) |
| `QualityEscrow` · `DeliveryEscrow` | Escrow por calidad y por entrega |
| `BeZhasBridgeL2` · `BEZPolygonBridge` · `WrappedBEZ` | Puentes cross-chain |
| `AegisSecurityProvider` | Capa de seguridad del protocolo |
| `OpenClawAgent` | Integración con la capa de agentes IA |
| `BeZhasWorkflowRegistry` | Registro de flujos de trabajo |
| `BeZhasCommissionSplitter` | Reparto de comisiones |

## Wallet e identidad

| Contrato | Función |
| --- | --- |
| `SmartWallet` · `SmartWalletFactory` | Cuentas inteligentes (account abstraction) |
| `Paymaster` | Transacciones sin gas para el usuario final |
| `MultiSigWallet` | Operaciones institucionales multi-firma |
| `SecurityModule` · `WalletGuardian` | Límites, guardianes y recuperación |
| `IdentityRegistry` | Identidad on-chain |

## Tokens y NFT

| Contrato | Función |
| --- | --- |
| `BeZhasLogisticsNFT` | Manifiestos logísticos (ERC-721) |
| `BeZhasPartnerSBT` | Credencial de partner, no transferible |

## Contratos por sector

| Sector | Contratos |
| --- | --- |
| **Supply chain** | `SupplyTracker`, `ProcurementNFT`, `WarehouseManager`, `SupplierScoreOracle`, `ClearanceCertificateNFT`, `CustomsClearanceOracle`, `TrackingIntegrationGateway`, `TrackingToCustomsGateway` |
| **Salud** | `HealthRecordSBT`, `PharmaTracker`, `HealthInsuranceEscrow`, `ClinicalDataMarketplace` |
| **Energía** | `CarbonCreditToken`, `P2PEnergyMarket`, `SolarFarmToken`, `ESGScoreOracle` |
| **Automoción** | `VehicleIdentityNFT`, `AutoPartsRegistry`, `FleetLeaseEscrow`, `EVChargeToken` |
| **Industria** | `QualityCertificateNFT`, `DigitalTwinRegistry`, `MaterialTokenMRP`, `PredictiveMaintenanceLog` |
| **Agricultura** | `CropTokenFutures`, `AgriSupplyChain`, `AquaFarmMonitor`, `LandTitleNFT` |
| **Seguros** | `PolicyNFT`, `ParametricInsurance`, `ClaimAdjuster`, `ReinsurancePool` |
| **Educación** | `CourseTokenNFT`, `SkillBadgeSBT`, `EduDAO`, `ScholarshipPool` |
| **Entretenimiento** | `EventTicketNFT`, `FanTokenDAO`, `RoyaltyDistributor`, `StreamingRightsMarket` |
| **Legal** | `SmartLegalContract`, `EvidenceVault`, `ArbitrationDAO`, `IPRegistryNFT` |
| **Gobierno** | `CitizenIdentityNFT`, `PublicBudgetDAO`, `LandCadastralRegistry`, `VotingSystem` |
| **Finanzas** | `MicroLendingPool`, `InvoiceFactoring`, `CreditScoreOracle`, `TreasuryVault` |
| **Servicios** | `FreelanceMarketplace`, `SubscriptionManager`, `SLAMonitor`, `ServiceReputationNFT` |
| **Otros** | `LoyaltyRewards`, `CrowdfundingPool`, `P2PMarketplace`, `CharityVault` |

## Interactuar con un contrato

```js
import { ethers } from 'ethers';
import { getContract, getABI } from '@bezhas/sdk';

const provider = new ethers.JsonRpcProvider(process.env.BEZHAS_L2_RPC_URL);
const info = getContract('BEZCoinV2', 'bezhas-l2');
const bez = new ethers.Contract(info.address, getABI('BEZCoinV2'), provider);

console.log(await bez.symbol(), ethers.formatUnits(await bez.totalSupply(), 18));
```

## Desarrollar tus propios contratos

Con Foundry:

```bash
forge build --sizes
forge test -vvv
```

Si tu contrato cobra en BEZ, **hereda de `BEZSectorStandard`**: obtienes tesorería, comisión acotada y el evento `BEZFeeCollected` de forma coherente con el resto del ecosistema.

En la red local puedes desplegar libremente. Para desplegar en la red principal se requiere revisión previa.

## Convenciones del ecosistema

- **AccessControl por rol**, nunca `onlyOwner` para operaciones sensibles multi-actor.
- **`ReentrancyGuard`** en toda función que mueva valor.
- **`SafeERC20`** para transferencias de token.
- **Eventos con `indexed`** en los campos por los que vas a filtrar.
- **Errores personalizados** (`revert ZeroAmount()`) en lugar de strings largos.
- Comisiones **acotadas por contrato**, no por confianza en el operador.

## Ver también

- [Tokenización de activos](/docs/tokenizacion-activos)
- [NFT y SBT](/docs/nft-y-sbt)
- [Gobernanza DAO](/docs/gobernanza-dao)
