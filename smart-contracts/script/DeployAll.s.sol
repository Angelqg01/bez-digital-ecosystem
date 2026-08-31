// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

// ── Core ──
import {BEZCoinV2} from "../src/tokens/BEZCoinV2.sol";
import {BeZhasLogisticsNFT} from "../src/tokens/BeZhasLogisticsNFT.sol";
import {QualityEscrow} from "../src/core/QualityEscrow.sol";
import {DeliveryEscrow} from "../src/core/DeliveryEscrow.sol";
import {BeZhasBridgeL2} from "../src/core/BeZhasBridgeL2.sol";
import {StakingPool} from "../src/core/StakingPool.sol";
import {LiquidityFarming} from "../src/core/LiquidityFarming.sol";
import {ValidatorRegistry} from "../src/core/ValidatorRegistry.sol";
import {EdgeNodeRewards} from "../src/core/EdgeNodeRewards.sol";
import {SequencerRotation} from "../src/core/SequencerRotation.sol";
import {SlashingManager} from "../src/core/SlashingManager.sol";

// ── Health ──
import {HealthRecordSBT} from "../src/health/HealthRecordSBT.sol";
import {PharmaTracker} from "../src/health/PharmaTracker.sol";
import {HealthInsuranceEscrow} from "../src/health/HealthInsuranceEscrow.sol";
import {ClinicalDataMarketplace} from "../src/health/ClinicalDataMarketplace.sol";

// ── Energy ──
import {CarbonCreditToken} from "../src/energy/CarbonCreditToken.sol";
import {P2PEnergyMarket} from "../src/energy/P2PEnergyMarket.sol";
import {SolarFarmToken} from "../src/energy/SolarFarmToken.sol";
import {ESGScoreOracle} from "../src/energy/ESGScoreOracle.sol";

// ── Automotive ──
import {VehicleIdentityNFT} from "../src/automotive/VehicleIdentityNFT.sol";
import {AutoPartsRegistry} from "../src/automotive/AutoPartsRegistry.sol";
import {FleetLeaseEscrow} from "../src/automotive/FleetLeaseEscrow.sol";
import {EVChargeToken} from "../src/automotive/EVChargeToken.sol";

// ── Manufacturing ──
import {QualityCertificateNFT} from "../src/manufacturing/QualityCertificateNFT.sol";
import {DigitalTwinRegistry} from "../src/manufacturing/DigitalTwinRegistry.sol";
import {MaterialTokenMRP} from "../src/manufacturing/MaterialTokenMRP.sol";
import {PredictiveMaintenanceLog} from "../src/manufacturing/PredictiveMaintenanceLog.sol";

// ── Agriculture ──
import {CropTokenFutures} from "../src/agriculture/CropTokenFutures.sol";
import {AgriSupplyChain} from "../src/agriculture/AgriSupplyChain.sol";
import {AquaFarmMonitor} from "../src/agriculture/AquaFarmMonitor.sol";
import {LandTitleNFT} from "../src/agriculture/LandTitleNFT.sol";

// ── Insurance ──
import {PolicyNFT} from "../src/insurance/PolicyNFT.sol";
import {ParametricInsurance} from "../src/insurance/ParametricInsurance.sol";
import {ClaimAdjuster} from "../src/insurance/ClaimAdjuster.sol";
import {ReinsurancePool} from "../src/insurance/ReinsurancePool.sol";

// ── Education ──
import {CourseTokenNFT} from "../src/education/CourseTokenNFT.sol";
import {SkillBadgeSBT} from "../src/education/SkillBadgeSBT.sol";
import {EduDAO} from "../src/education/EduDAO.sol";
import {ScholarshipPool} from "../src/education/ScholarshipPool.sol";

// ── Entertainment ──
import {EventTicketNFT} from "../src/entertainment/EventTicketNFT.sol";
import {FanTokenDAO} from "../src/entertainment/FanTokenDAO.sol";
import {RoyaltyDistributor} from "../src/entertainment/RoyaltyDistributor.sol";
import {StreamingRightsMarket} from "../src/entertainment/StreamingRightsMarket.sol";

// ── Legal ──
import {SmartLegalContract} from "../src/legal/SmartLegalContract.sol";
import {EvidenceVault} from "../src/legal/EvidenceVault.sol";
import {ArbitrationDAO} from "../src/legal/ArbitrationDAO.sol";
import {IPRegistryNFT} from "../src/legal/IPRegistryNFT.sol";

// ── SupplyChain ──
import {SupplyTracker} from "../src/supplychain/SupplyTracker.sol";
import {ProcurementNFT} from "../src/supplychain/ProcurementNFT.sol";
import {WarehouseManager} from "../src/supplychain/WarehouseManager.sol";
import {SupplierScoreOracle} from "../src/supplychain/SupplierScoreOracle.sol";
import {ClearanceCertificateNFT} from "../src/supplychain/ClearanceCertificateNFT.sol";
import {CustomsClearanceOracle} from "../src/supplychain/CustomsClearanceOracle.sol";
import {TrackingIntegrationGateway} from "../src/supplychain/TrackingIntegrationGateway.sol";
import {TrackingToCustomsGateway} from "../src/supplychain/TrackingToCustomsGateway.sol";
import {TelemetryAnchor} from "../src/supplychain/TelemetryAnchor.sol";
import {AegisSecurityProvider} from "../src/core/AegisSecurityProvider.sol";

// ── Government ──
import {CitizenIdentityNFT} from "../src/government/CitizenIdentityNFT.sol";
import {PublicBudgetDAO} from "../src/government/PublicBudgetDAO.sol";
import {LandCadastralRegistry} from "../src/government/LandCadastralRegistry.sol";
import {VotingSystem} from "../src/government/VotingSystem.sol";

// ── Finance ──
import {MicroLendingPool} from "../src/finance/MicroLendingPool.sol";
import {InvoiceFactoring} from "../src/finance/InvoiceFactoring.sol";
import {CreditScoreOracle} from "../src/finance/CreditScoreOracle.sol";
import {TreasuryVault} from "../src/finance/TreasuryVault.sol";

// ── Services ──
import {FreelanceMarketplace} from "../src/services/FreelanceMarketplace.sol";
import {SubscriptionManager} from "../src/services/SubscriptionManager.sol";
import {SLAMonitor} from "../src/services/SLAMonitor.sol";
import {ServiceReputationNFT} from "../src/services/ServiceReputationNFT.sol";

// ── Otros ──
import {LoyaltyRewards} from "../src/otros/LoyaltyRewards.sol";
import {CrowdfundingPool} from "../src/otros/CrowdfundingPool.sol";
import {P2PMarketplace} from "../src/otros/P2PMarketplace.sol";
import {CharityVault} from "../src/otros/CharityVault.sol";

/**
 * @title DeployAll
 * @notice Full ecosystem deployment: 6 core + 60 sector = 66 contracts.
 *         Writes addresses to deployments/<chainId>.json via console log.
 *
 * Usage (Anvil local):
 *   forge script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast
 *
 * Usage (Testnet):
 *   forge script script/DeployAll.s.sol --rpc-url $RPC_URL --private-key $KEY --broadcast --verify
 */
contract DeployAll is Script {

    function run() external {
        uint256 deployerKey = block.chainid == 31337
            ? vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80))
            : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address edgeNode = vm.envOr("EDGE_NODE_ADDRESS", address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8));
        address multisig = vm.envOr("MULTISIG_ADDRESS", deployer); // NUEVO: multisig configurable

        console.log("========================================");
        console.log("  BeZhas Full Ecosystem Deployment");
        console.log("  Chain ID:", block.chainid);
        console.log("  Deployer:", deployer);
        console.log("  Multisig:", multisig);
        console.log("========================================");

        vm.startBroadcast(deployerKey);

        // ═══════════════════════════════════════════════
        //  CORE CONTRACTS (6)
        // ═══════════════════════════════════════════════

        BEZCoinV2 bez = new BEZCoinV2(multisig);
        BeZhasLogisticsNFT nft = new BeZhasLogisticsNFT(multisig);
        QualityEscrow escrow = new QualityEscrow();
        DeliveryEscrow deliveryEscrow = new DeliveryEscrow(address(bez), multisig, 250, multisig);
        BeZhasBridgeL2 bridge = new BeZhasBridgeL2(address(bez), multisig);
        ValidatorRegistry validatorReg = new ValidatorRegistry(address(bez), multisig);
        StakingPool staking = new StakingPool(address(bez), address(validatorReg), multisig);
        LiquidityFarming farming = new LiquidityFarming(
            IERC20(address(bez)), 5e17, block.number, multisig
        );
        EdgeNodeRewards edgeRewards = new EdgeNodeRewards(address(bez), address(validatorReg), multisig);
        SequencerRotation seqRotation = new SequencerRotation(address(validatorReg), multisig);
        SlashingManager slashMgr = new SlashingManager(address(validatorReg), multisig);

        // Core roles
        bez.grantRole(bez.BRIDGE_ROLE(), address(bridge));
        bez.grantRole(bez.MINTER_ROLE(), address(staking));
        bez.grantRole(bez.MINTER_ROLE(), address(farming));
        nft.grantRole(nft.MINTER_ROLE(), address(escrow));
        escrow.grantRole(escrow.EDGE_NODE_ROLE(), edgeNode);
        deliveryEscrow.grantRole(deliveryEscrow.EDGE_NODE_ROLE(), edgeNode);
        validatorReg.grantRole(validatorReg.ORACLE_ROLE(), address(edgeRewards));
        validatorReg.grantRole(validatorReg.SLASHER_ROLE(), address(slashMgr));
        edgeRewards.grantRole(edgeRewards.ORACLE_ROLE(), edgeNode);
        slashMgr.grantRole(slashMgr.SLASHER_ROLE(), multisig);
        bez.transfer(edgeNode, 10_000 ether);
        bez.transfer(address(edgeRewards), 5_000_000 ether);
        bez.transfer(address(staking), 10_000_000 ether);

        // L1Bridge: ejemplo de despliegue y roles (debería estar en otro script específico de L1)
        // L1Bridge l1bridge = new L1Bridge(multisig);
        // l1bridge.grantRole(l1bridge.PAUSER_ROLE(), multisig);
        // l1bridge.grantRole(l1bridge.TOKEN_MANAGER_ROLE(), multisig);
        // l1bridge.grantRole(l1bridge.MULTISIG_ROLE(), multisig);

        _logCore(bez, nft, escrow, deliveryEscrow, bridge, staking, farming);

        console.log("--- validation system ---");
        console.log("  ValidatorRegistry:", address(validatorReg));
        console.log("  EdgeNodeRewards:", address(edgeRewards));
        console.log("  SequencerRotation:", address(seqRotation));
        console.log("  SlashingManager:", address(slashMgr));

        // ═══════════════════════════════════════════════
        //  SECTOR CONTRACTS (60)
        // ═══════════════════════════════════════════════

        // Health
        address[4] memory health = [
            address(new HealthRecordSBT()),
            address(new PharmaTracker()),
            address(new HealthInsuranceEscrow()),
            address(new ClinicalDataMarketplace())
        ];
        _logSector("health", health,
            "HealthRecordSBT", "PharmaTracker", "HealthInsuranceEscrow", "ClinicalDataMarketplace");

        // Energy (admin arg)
        address[4] memory energy = [
            address(new CarbonCreditToken(deployer)),
            address(new P2PEnergyMarket(deployer)),
            address(new SolarFarmToken(deployer)),
            address(new ESGScoreOracle(deployer))
        ];
        _logSector("energy", energy,
            "CarbonCreditToken", "P2PEnergyMarket", "SolarFarmToken", "ESGScoreOracle");

        // Automotive (admin arg)
        address[4] memory auto_ = [
            address(new VehicleIdentityNFT(deployer)),
            address(new AutoPartsRegistry(deployer)),
            address(new FleetLeaseEscrow(deployer)),
            address(new EVChargeToken(deployer))
        ];
        _logSector("automotive", auto_,
            "VehicleIdentityNFT", "AutoPartsRegistry", "FleetLeaseEscrow", "EVChargeToken");

        // Manufacturing
        address[4] memory manuf = [
            address(new QualityCertificateNFT()),
            address(new DigitalTwinRegistry()),
            address(new MaterialTokenMRP()),
            address(new PredictiveMaintenanceLog())
        ];
        _logSector("manufacturing", manuf,
            "QualityCertificateNFT", "DigitalTwinRegistry", "MaterialTokenMRP", "PredictiveMaintenanceLog");

        // Agriculture
        address[4] memory agri = [
            address(new CropTokenFutures()),
            address(new AgriSupplyChain()),
            address(new AquaFarmMonitor()),
            address(new LandTitleNFT())
        ];
        _logSector("agriculture", agri,
            "CropTokenFutures", "AgriSupplyChain", "AquaFarmMonitor", "LandTitleNFT");

        // Insurance
        address[4] memory insur = [
            address(new PolicyNFT()),
            address(new ParametricInsurance()),
            address(new ClaimAdjuster()),
            address(new ReinsurancePool())
        ];
        _logSector("insurance", insur,
            "PolicyNFT", "ParametricInsurance", "ClaimAdjuster", "ReinsurancePool");

        // Education
        address[4] memory edu = [
            address(new CourseTokenNFT()),
            address(new SkillBadgeSBT()),
            address(new EduDAO()),
            address(new ScholarshipPool())
        ];
        _logSector("education", edu,
            "CourseTokenNFT", "SkillBadgeSBT", "EduDAO", "ScholarshipPool");

        // Entertainment
        address[4] memory ent = [
            address(new EventTicketNFT()),
            address(new FanTokenDAO()),
            address(new RoyaltyDistributor()),
            address(new StreamingRightsMarket())
        ];
        _logSector("entertainment", ent,
            "EventTicketNFT", "FanTokenDAO", "RoyaltyDistributor", "StreamingRightsMarket");

        // Legal
        address[4] memory legal = [
            address(new SmartLegalContract()),
            address(new EvidenceVault()),
            address(new ArbitrationDAO()),
            address(new IPRegistryNFT())
        ];
        _logSector("legal", legal,
            "SmartLegalContract", "EvidenceVault", "ArbitrationDAO", "IPRegistryNFT");

        // SupplyChain (9 contracts)
        address scSupplyTracker = address(new SupplyTracker());
        address scTelemetryAnchor = address(new TelemetryAnchor());
        address scProcurement = address(new ProcurementNFT());
        address scWarehouse = address(new WarehouseManager());
        address scSupplierScore = address(new SupplierScoreOracle());
        address scClearanceNFT = address(new ClearanceCertificateNFT());
        CustomsClearanceOracle scCustoms = new CustomsClearanceOracle(address(bez), deployer);
        TrackingIntegrationGateway scTracking = new TrackingIntegrationGateway(address(bez), deployer);
        TrackingToCustomsGateway scGateway = new TrackingToCustomsGateway(address(scTracking), address(scCustoms));

        console.log("--- supplychain ---");
        console.log("  SupplyTracker:", scSupplyTracker);
        console.log("  TelemetryAnchor:", scTelemetryAnchor);
        console.log("  ProcurementNFT:", scProcurement);
        console.log("  WarehouseManager:", scWarehouse);
        console.log("  SupplierScoreOracle:", scSupplierScore);
        console.log("  ClearanceCertificateNFT:", scClearanceNFT);
        console.log("  CustomsClearanceOracle:", address(scCustoms));
        console.log("  TrackingIntegrationGateway:", address(scTracking));
        console.log("  TrackingToCustomsGateway:", address(scGateway));

        // ── Aprovisionamiento del tránsito aduanero ─────────────────────────
        //
        // Sin esto el gateway queda desplegado pero MUERTO: cada uno de sus
        // requisitos vive en otro contrato, así que desplegarlo no basta para
        // que funcione. Faltaba por completo, y como sus pruebas se aprovisionan
        // a sí mismas en setUp(), pasaban en verde mientras el despliegue real
        // no habría podido ejecutar ni una llamada.
        //
        // Cada línea cubre un require concreto:
        scTracking.grantRole(scTracking.OPERATOR_ROLE(), address(scGateway));
        scCustoms.grantRole(scCustoms.CUSTOMS_OFFICER_ROLE(), address(scGateway));
        scGateway.grantRole(scGateway.OPERATOR_ROLE(), deployer);

        // mintCargoWithTracking exige un proveedor ACTIVO con presupuesto: el
        // propio BeZhas actúa de proveedor por defecto para la carga propia.
        scTracking.registerProvider(
            keccak256("BEZHAS"), "BeZhas Native Tracking", deployer, 1_000_000 ether
        );

        // requestClearance exige plataforma activa y partida arancelaria activa.
        // AEAT es la del piloto de Algeciras; el arancel se registra genérico y
        // gobernanza lo afina — sin al menos uno, cualquier despacho revierte.
        scCustoms.registerCustomsPlatform("AEAT", "https://sede.agenciatributaria.gob.es", deployer);
        scCustoms.updateTariff(keccak256("GENERIC"), "Generic tariff placeholder", 0, false, "");

        // Las tasas las cobran los dos contratos con transferFrom, y cada uno a
        // un pagador distinto. Hay que dejar las dos allowances puestas:
        //
        //   tokenización (0,5%)  -> la paga el PROVEEDOR (prov.webhookAddress)
        //   integración  (0,15%) -> la paga EL GATEWAY (msg.sender de la llamada)
        //
        // Faltando cualquiera de las dos, createIntegratedShipment revierte con
        // ERC20InsufficientAllowance y no hay forma de deducir cuál falta desde
        // el mensaje de error.
        bez.approve(address(scTracking), 10_000_000 ether);
        bez.transfer(address(scGateway), 1_000_000 ether);
        scGateway.approveCustomsFees(1_000_000 ether);
        console.log("  [provision] transito multipais listo (AEAT + proveedor BEZHAS + tasas)");

        // ── Aegis: registro on-chain de los rechazos de seguridad ───────────
        //
        // No estaba en ningún script de despliegue pese a figurar en el fichero
        // de direcciones, así que sus direcciones venían de un origen que no
        // consta en ningún broadcast. Aquí se despliega de verdad.
        //
        // Sólo se cablea el REGISTRO de señales. La vía de pausa automática
        // (OpenClawAgent -> L2Sequencer) se deja fuera a propósito: ver el
        // encabezado de api/services/aegisOnChain.js.
        AegisSecurityProvider aegis = new AegisSecurityProvider(deployer);
        console.log("  AegisSecurityProvider:", address(aegis));

        // Government
        address[4] memory gov = [
            address(new CitizenIdentityNFT()),
            address(new PublicBudgetDAO()),
            address(new LandCadastralRegistry()),
            address(new VotingSystem())
        ];
        _logSector("government", gov,
            "CitizenIdentityNFT", "PublicBudgetDAO", "LandCadastralRegistry", "VotingSystem");

        // Finance (TreasuryVault special)
        address[4] memory fin = [
            address(new MicroLendingPool(multisig)),
            address(new InvoiceFactoring(multisig)),
            address(new CreditScoreOracle()),
            address(new TreasuryVault(3, 100 ether))
        ];
        _logSector("finance", fin,
            "MicroLendingPool", "InvoiceFactoring", "CreditScoreOracle", "TreasuryVault");

        // Services
        address[4] memory serv = [
            address(new FreelanceMarketplace(multisig)),
            address(new SubscriptionManager()),
            address(new SLAMonitor()),
            address(new ServiceReputationNFT())
        ];
        _logSector("services", serv,
            "FreelanceMarketplace", "SubscriptionManager", "SLAMonitor", "ServiceReputationNFT");

        // Otros
        address[4] memory otros = [
            address(new LoyaltyRewards()),
            address(new CrowdfundingPool()),
            address(new P2PMarketplace()),
            address(new CharityVault())
        ];
        _logSector("otros", otros,
            "LoyaltyRewards", "CrowdfundingPool", "P2PMarketplace", "CharityVault");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  Deployment Complete: 71 contracts");
        console.log("========================================");
    }

    function _logCore(
        BEZCoinV2 bez, BeZhasLogisticsNFT nft, QualityEscrow escrow, DeliveryEscrow deliveryEscrow,
        BeZhasBridgeL2 bridge, StakingPool staking, LiquidityFarming farming
    ) internal pure {
        console.log("--- core ---");
        console.log("  BEZCoinV2:", address(bez));
        console.log("  BeZhasLogisticsNFT:", address(nft));
        console.log("  QualityEscrow:", address(escrow));
        console.log("  DeliveryEscrow:", address(deliveryEscrow));
        console.log("  BeZhasBridgeL2:", address(bridge));
        console.log("  StakingPool:", address(staking));
        console.log("  LiquidityFarming:", address(farming));
    }

    function _logSector(
        string memory name, address[4] memory addrs,
        string memory n0, string memory n1, string memory n2, string memory n3
    ) internal pure {
        console.log(string.concat("--- ", name, " ---"));
        console.log(string.concat("  ", n0, ":"), addrs[0]);
        console.log(string.concat("  ", n1, ":"), addrs[1]);
        console.log(string.concat("  ", n2, ":"), addrs[2]);
        console.log(string.concat("  ", n3, ":"), addrs[3]);
    }
}
