/**
 * BeZhas Enterprise SDK Entry Point
 * 
 * Exports the universal client for use in Node.js and modern bundlers.
 * For browser CDN usage, this file is bundled via Webpack.
 */

const BeZhasUniversal = require('./bezhas-universal');

// Smart Contracts Export
const contractsModule = require('./contracts');

// Export Main Class
// Allows: import { BeZhas } from '@bezhas/sdk'
class BeZhas extends BeZhasUniversal {
    constructor(config) {
        super(config);
    }

    // Proxy methods for contracts
    getContract(contractName, network) {
        return contractsModule.getContract(contractName, network || this.config.network || 'amoy');
    }

    getAddresses(network) {
        return contractsModule.getAddresses(network || this.config.network || 'amoy');
    }

    getABI(contractName) {
        return contractsModule.getABI(contractName);
    }

    listContracts() {
        return contractsModule.listContracts();
    }

    isDeployed(contractName, network) {
        return contractsModule.isDeployed(contractName, network || this.config.network || 'amoy');
    }
}

// Named exports for specific modules if needed
const RealEstateModule = require('./modules/RealEstateModule');
const HealthcareModule = require('./modules/HealthcareModule');
const AutomotiveModule = require('./modules/AutomotiveModule');
const ManufacturingModule = require('./modules/ManufacturingModule');
const EnergyModule = require('./modules/EnergyModule');
const AgricultureModule = require('./modules/AgricultureModule');
const ContactsModule = require('./modules/ContactsModule');

// Platform Service Modules
const VIPSubscriptionManager = require('./vip');
const StakingManager = require('./staking');
const PaymentsManager = require('./payments');
const RWAManager = require('./rwa');
const LogisticsManager = require('./logistics');
const MCPClient = require('./mcp-integration');

// AIOps Trojan Agent (Nivel 5)
const TrojanAgent = require('./modules/bezhas-trojan');

// Smart Contracts Export (redundant but kept for named exports below)
// const contractsModule = require('./contracts');

module.exports = {
    BeZhas,
    BeZhasUniversal, // alias

    // Platform Services
    VIPSubscriptionManager,
    StakingManager,
    PaymentsManager,
    RWAManager,
    LogisticsManager,
    MCPClient,
    TrojanAgent,

    // Industry-specific modules
    modules: {
        RealEstateModule,
        HealthcareModule,
        AutomotiveModule,
        ManufacturingModule,
        EnergyModule,
        AgricultureModule,
        ContactsModule
    },

    // Smart Contracts ABIs & Addresses
    // Usage: const { getContract } = require('@bezhas/sdk');
    //        const dao = getContract('GovernanceSystem', 'amoy');
    contracts: contractsModule.contracts,
    addresses: contractsModule.addresses,
    getContract: contractsModule.getContract,
    getAddresses: contractsModule.getAddresses,
    getABI: contractsModule.getABI,
    listContracts: contractsModule.listContracts,
    isDeployed: contractsModule.isDeployed,
};
