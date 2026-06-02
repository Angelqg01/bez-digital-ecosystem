// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

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
 * @title DeploySectors
 * @notice Deploys all 60 sector-specific contracts for BeZhas ecosystem.
 *
 * Requires: BEZCoinV2 address (for supplychain contracts with dependencies)
 *
 * Usage:
 *   BEZ_TOKEN=0x... TREASURY=0x... forge script script/DeploySectors.s.sol --rpc-url http://localhost:8545 --broadcast
 */
contract DeploySectors is Script {
    function run() external {
        uint256 deployerKey = block.chainid == 31337
            ? vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80))
            : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address bezToken = vm.envAddress("BEZ_TOKEN");
        address treasury = vm.envOr("TREASURY", deployer);

        console.log("=== BeZhas Sectors Deployment ===");
        console.log("Deployer:", deployer);
        console.log("BEZ Token:", bezToken);
        console.log("Treasury:", treasury);

        vm.startBroadcast(deployerKey);

        // ═══════════════════════════════════════════
        //  HEALTH (4 contracts — no args)
        // ═══════════════════════════════════════════
        console.log("--- Health ---");
        console.log("HealthRecordSBT:", address(new HealthRecordSBT()));
        console.log("PharmaTracker:", address(new PharmaTracker()));
        console.log("HealthInsuranceEscrow:", address(new HealthInsuranceEscrow()));
        console.log("ClinicalDataMarketplace:", address(new ClinicalDataMarketplace()));

        // ═══════════════════════════════════════════
        //  ENERGY (4 contracts — admin arg)
        // ═══════════════════════════════════════════
        console.log("--- Energy ---");
        console.log("CarbonCreditToken:", address(new CarbonCreditToken(deployer)));
        console.log("P2PEnergyMarket:", address(new P2PEnergyMarket(deployer)));
        console.log("SolarFarmToken:", address(new SolarFarmToken(deployer)));
        console.log("ESGScoreOracle:", address(new ESGScoreOracle(deployer)));

        // ═══════════════════════════════════════════
        //  AUTOMOTIVE (4 contracts — admin arg)
        // ═══════════════════════════════════════════
        console.log("--- Automotive ---");
        console.log("VehicleIdentityNFT:", address(new VehicleIdentityNFT(deployer)));
        console.log("AutoPartsRegistry:", address(new AutoPartsRegistry(deployer)));
        console.log("FleetLeaseEscrow:", address(new FleetLeaseEscrow(deployer)));
        console.log("EVChargeToken:", address(new EVChargeToken(deployer)));

        // ═══════════════════════════════════════════
        //  MANUFACTURING (4 contracts — no args)
        // ═══════════════════════════════════════════
        console.log("--- Manufacturing ---");
        console.log("QualityCertificateNFT:", address(new QualityCertificateNFT()));
        console.log("DigitalTwinRegistry:", address(new DigitalTwinRegistry()));
        console.log("MaterialTokenMRP:", address(new MaterialTokenMRP()));
        console.log("PredictiveMaintenanceLog:", address(new PredictiveMaintenanceLog()));

        // ═══════════════════════════════════════════
        //  AGRICULTURE (4 contracts — no args)
        // ═══════════════════════════════════════════
        console.log("--- Agriculture ---");
        console.log("CropTokenFutures:", address(new CropTokenFutures()));
        console.log("AgriSupplyChain:", address(new AgriSupplyChain()));
        console.log("AquaFarmMonitor:", address(new AquaFarmMonitor()));
        console.log("LandTitleNFT:", address(new LandTitleNFT()));

        // ═══════════════════════════════════════════
        //  INSURANCE (4 contracts — no args)
        // ═══════════════════════════════════════════
        console.log("--- Insurance ---");
        console.log("PolicyNFT:", address(new PolicyNFT()));
        console.log("ParametricInsurance:", address(new ParametricInsurance()));
        console.log("ClaimAdjuster:", address(new ClaimAdjuster()));
        console.log("ReinsurancePool:", address(new ReinsurancePool()));

        // ═══════════════════════════════════════════
        //  EDUCATION (4 contracts — no args)
        // ═══════════════════════════════════════════
        console.log("--- Education ---");
        console.log("CourseTokenNFT:", address(new CourseTokenNFT()));
        console.log("SkillBadgeSBT:", address(new SkillBadgeSBT()));
        console.log("EduDAO:", address(new EduDAO()));
        console.log("ScholarshipPool:", address(new ScholarshipPool()));

        // ═══════════════════════════════════════════
        //  ENTERTAINMENT (4 contracts — no args)
        // ═══════════════════════════════════════════
        console.log("--- Entertainment ---");
        console.log("EventTicketNFT:", address(new EventTicketNFT()));
        console.log("FanTokenDAO:", address(new FanTokenDAO()));
        console.log("RoyaltyDistributor:", address(new RoyaltyDistributor()));
        console.log("StreamingRightsMarket:", address(new StreamingRightsMarket()));

        // ═══════════════════════════════════════════
        //  LEGAL (4 contracts — no args)
        // ═══════════════════════════════════════════
        console.log("--- Legal ---");
        console.log("SmartLegalContract:", address(new SmartLegalContract()));
        console.log("EvidenceVault:", address(new EvidenceVault()));
        console.log("ArbitrationDAO:", address(new ArbitrationDAO()));
        console.log("IPRegistryNFT:", address(new IPRegistryNFT()));

        // ═══════════════════════════════════════════
        //  SUPPLYCHAIN (8 contracts — mixed args)
        // ═══════════════════════════════════════════
        console.log("--- SupplyChain ---");
        console.log("SupplyTracker:", address(new SupplyTracker()));
        console.log("ProcurementNFT:", address(new ProcurementNFT()));
        console.log("WarehouseManager:", address(new WarehouseManager()));
        console.log("SupplierScoreOracle:", address(new SupplierScoreOracle()));
        console.log("ClearanceCertificateNFT:", address(new ClearanceCertificateNFT()));

        // Supplychain contracts with dependencies
        CustomsClearanceOracle customs = new CustomsClearanceOracle(bezToken, treasury);
        console.log("CustomsClearanceOracle:", address(customs));

        TrackingIntegrationGateway tracking = new TrackingIntegrationGateway(bezToken, treasury);
        console.log("TrackingIntegrationGateway:", address(tracking));

        TrackingToCustomsGateway gateway = new TrackingToCustomsGateway(address(tracking), address(customs));
        console.log("TrackingToCustomsGateway:", address(gateway));

        // ═══════════════════════════════════════════
        //  GOVERNMENT (4 contracts — no args)
        // ═══════════════════════════════════════════
        console.log("--- Government ---");
        console.log("CitizenIdentityNFT:", address(new CitizenIdentityNFT()));
        console.log("PublicBudgetDAO:", address(new PublicBudgetDAO()));
        console.log("LandCadastralRegistry:", address(new LandCadastralRegistry()));
        console.log("VotingSystem:", address(new VotingSystem()));

        // ═══════════════════════════════════════════
        //  FINANCE (4 contracts — TreasuryVault special)
        // ═══════════════════════════════════════════
        console.log("--- Finance ---");
        console.log("MicroLendingPool:", address(new MicroLendingPool(treasury)));
        console.log("InvoiceFactoring:", address(new InvoiceFactoring(treasury)));
        console.log("CreditScoreOracle:", address(new CreditScoreOracle()));
        console.log("TreasuryVault:", address(new TreasuryVault(3, 100 ether))); // 3 approvals, 100 BEZ daily

        // ═══════════════════════════════════════════
        //  SERVICES (4 contracts — no args)
        // ═══════════════════════════════════════════
        console.log("--- Services ---");
        console.log("FreelanceMarketplace:", address(new FreelanceMarketplace(treasury)));
        console.log("SubscriptionManager:", address(new SubscriptionManager()));
        console.log("SLAMonitor:", address(new SLAMonitor()));
        console.log("ServiceReputationNFT:", address(new ServiceReputationNFT()));

        // ═══════════════════════════════════════════
        //  OTROS (4 contracts — no args)
        // ═══════════════════════════════════════════
        console.log("--- Otros ---");
        console.log("LoyaltyRewards:", address(new LoyaltyRewards()));
        console.log("CrowdfundingPool:", address(new CrowdfundingPool()));
        console.log("P2PMarketplace:", address(new P2PMarketplace()));
        console.log("CharityVault:", address(new CharityVault()));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Sectors Deployment Complete (60 contracts) ===");
    }
}
