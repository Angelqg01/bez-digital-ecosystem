# Contracts Catalog — BeZhas Blockchain
> Catálogo completo de Smart Contracts

## Resumen
- **Total contratos fuente**: 72+
- **Total tests**: 72+ suites, 931+ tests individuales
- **Módulos**: 11 (core, defi, depin, farming, governance, marketplace, staking, supply-chain, wallet, extras, interfaces)

---

## Core Module
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| BEZCoinV2 | core/BEZCoinV2.sol | Token nativo ERC20, mint/burn, gasless |
| BeZhasBridge | core/BeZhasBridge.sol | Puente L1↔L2 |
| CorporateGasTank | core/CorporateGasTank.sol | Tanque de gas para empresas |

## DeFi Module
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| BeZhasLending | defi/BeZhasLending.sol | Préstamos colateralizados |
| DefiHub | defi/DefiHub.sol | Hub central DeFi |
| BeZhasDEX | defi/BeZhasDEX.sol | Exchange descentralizado |
| LiquidityPool | defi/LiquidityPool.sol | Pools de liquidez |
| YieldOptimizer | defi/YieldOptimizer.sol | Optimización de yield |

## DePIN Module
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| EdgeNodeRewards | depin/EdgeNodeRewards.sol | Recompensas para nodos |
| HardwareRegistry | depin/HardwareRegistry.sol | Registro de hardware |
| NodeOperator | depin/NodeOperator.sol | Gestión de operadores |
| QualityOracle | depin/QualityOracle.sol | Oráculo de calidad |

## Farming Module
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| YieldFarming | farming/YieldFarming.sol | Farming de rendimiento |
| FarmingRewards | farming/FarmingRewards.sol | Distribución de recompensas |
| LiquidityMining | farming/LiquidityMining.sol | Minería de liquidez |

## Governance Module
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| GovernanceSystem | governance/GovernanceSystem.sol | Sistema de gobernanza |
| ProposalManager | governance/ProposalManager.sol | Gestión de propuestas |
| VotingPower | governance/VotingPower.sol | Poder de voto |
| Treasury | governance/Treasury.sol | Tesorería DAO |

## Marketplace Module
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| ServiceMarketplace | marketplace/ServiceMarketplace.sol | Marketplace de servicios B2B |
| NFTMarketplace | marketplace/NFTMarketplace.sol | Marketplace de NFTs |
| DataMarketplace | marketplace/DataMarketplace.sol | Marketplace de datos |

## Staking Module
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| StakingPool | staking/StakingPool.sol | Pool de staking |
| StakingRewards | staking/StakingRewards.sol | Recompensas de staking |
| ValidatorRegistry | staking/ValidatorRegistry.sol | Registro de validadores |

## Supply Chain Module
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| TraceabilityEngine | supply-chain/TraceabilityEngine.sol | Motor de trazabilidad |
| CertificationManager | supply-chain/CertificationManager.sol | Gestión de certificaciones |
| IoTDataBridge | supply-chain/IoTDataBridge.sol | Puente de datos IoT |

## Wallet Module (NUEVO)
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| SmartWallet | wallet/SmartWallet.sol | AA wallet non-custodial |
| SmartWalletFactory | wallet/SmartWalletFactory.sol | Factory CREATE2 |
| MultiSigWallet | wallet/MultiSigWallet.sol | Multi-firma empresarial |
| Paymaster | wallet/Paymaster.sol | Gas sponsorship B2B |
| SecurityModule | wallet/SecurityModule.sol | Hub de seguridad central |
| WalletGuardian | wallet/WalletGuardian.sol | Registro de guardianes |

## Extras Module
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| (4 contratos) | extras/*.sol | Integraciones cross-module |

## Interfaces Module
| Contrato | Archivo | Descripción |
|----------|---------|-------------|
| (múltiples) | interfaces/*.sol | Interfaces compartidas |
