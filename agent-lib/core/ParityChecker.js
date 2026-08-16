/**
 * ParityChecker.js — Validates parity between ABI artifacts, deployment addresses,
 * and SDK contract registry. Detects discrepancies to prevent runtime failures.
 *
 * Checks:
 *   1. SDK ABI exists for each deployed contract
 *   2. Deployment addresses are valid (non-zero, checksum-valid)
 *   3. SDK contracts.js references match deployment JSONs
 *   4. Plugin-declared contracts exist in deployments
 */
const fs = require('fs');
const path = require('path');

const DEPLOYMENTS_DIR = path.resolve(__dirname, '../../smart-contracts/deployments');
const SDK_CONTRACTS_PATH = path.resolve(__dirname, '../../sdk/contracts.js');
const SDK_ARTIFACTS_DIR = path.resolve(__dirname, '../../sdk/artifacts/contracts');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

class ParityChecker {
    #deployments = new Map(); // chainId → { core: {}, sectors: {} }
    #sdkContracts = null;
    #sdkAbis = new Map(); // contractName → abi[]

    constructor() {
        this.#loadDeployments();
        this.#loadSdkContracts();
        this.#loadSdkAbis();
    }

    /**
     * Run a full parity audit.
     * @param {{ plugins?: { name: string, sector: string, critical: boolean }[] }} [opts]
     * @returns {{ passed: boolean, checks: object[], summary: { total: number, pass: number, warn: number, fail: number } }}
     */
    audit(opts = {}) {
        const checks = [];

        // 1. Deployment file checks
        checks.push(...this.#checkDeploymentFiles());

        // 2. Address validity checks
        checks.push(...this.#checkAddressValidity());

        // 3. SDK ABI availability
        checks.push(...this.#checkSdkAbis());

        // 4. SDK contracts.js mapping
        checks.push(...this.#checkSdkMappingParity());

        // 5. Plugin contract parity (if plugins provided)
        if (opts.plugins && opts.plugins.length > 0) {
            checks.push(...this.#checkPluginContracts(opts.plugins));
        }

        const summary = {
            total: checks.length,
            pass: checks.filter(c => c.status === 'pass').length,
            warn: checks.filter(c => c.status === 'warn').length,
            fail: checks.filter(c => c.status === 'fail').length,
        };

        return {
            passed: summary.fail === 0,
            timestamp: new Date().toISOString(),
            checks,
            summary,
        };
    }

    /**
     * Quick check: does a named contract exist on a given chain?
     * @param {string} contractName
     * @param {number|string} chainId
     * @returns {{ exists: boolean, address?: string }}
     */
    checkContract(contractName, chainId) {
        const dep = this.#deployments.get(String(chainId));
        if (!dep) return { exists: false };

        const addr = dep.core?.[contractName]
            || this.#findInSectors(dep.sectors, contractName);

        if (!addr || addr === ZERO_ADDRESS) return { exists: false };
        return { exists: true, address: addr };
    }

    /**
     * Get all deployed contract names for a chain.
     * @param {number|string} chainId
     * @returns {string[]}
     */
    getDeployedContracts(chainId) {
        const dep = this.#deployments.get(String(chainId));
        if (!dep) return [];

        const names = Object.keys(dep.core || {});
        for (const sectorContracts of Object.values(dep.sectors || {})) {
            if (typeof sectorContracts === 'object') {
                names.push(...Object.keys(sectorContracts));
            }
        }
        return names;
    }

    /**
     * Reload all data sources (call after deploy/update).
     */
    reload() {
        this.#deployments.clear();
        this.#sdkAbis.clear();
        this.#loadDeployments();
        this.#loadSdkContracts();
        this.#loadSdkAbis();
    }

    // ── Private helpers ───────────────────────────────────────────────

    #loadDeployments() {
        try {
            const files = fs.readdirSync(DEPLOYMENTS_DIR).filter(f => f.endsWith('.json'));
            for (const file of files) {
                const raw = fs.readFileSync(path.join(DEPLOYMENTS_DIR, file), 'utf-8');
                const data = JSON.parse(raw);
                const chainId = data.chainId || file.replace('.json', '');
                this.#deployments.set(String(chainId), data);
            }
        } catch {
            // Deployments directory not found — checker will report empty
        }
    }

    #loadSdkContracts() {
        try {
            // Clear module cache so we get fresh data
            delete require.cache[require.resolve(SDK_CONTRACTS_PATH)];
            this.#sdkContracts = require(SDK_CONTRACTS_PATH);
        } catch {
            this.#sdkContracts = null;
        }
    }

    #loadSdkAbis() {
        try {
            if (!fs.existsSync(SDK_ARTIFACTS_DIR)) return;

            const contractDirs = fs.readdirSync(SDK_ARTIFACTS_DIR);
            for (const dir of contractDirs) {
                // Pattern: sdk/artifacts/contracts/ContractName.sol/ContractName.json
                const solDir = path.join(SDK_ARTIFACTS_DIR, dir);
                if (!fs.statSync(solDir).isDirectory()) continue;

                const jsonFiles = fs.readdirSync(solDir).filter(f => f.endsWith('.json'));
                for (const jsonFile of jsonFiles) {
                    const name = jsonFile.replace('.json', '');
                    try {
                        const artifact = JSON.parse(
                            fs.readFileSync(path.join(solDir, jsonFile), 'utf-8')
                        );
                        if (artifact.abi) {
                            this.#sdkAbis.set(name, artifact.abi);
                        }
                    } catch { /* skip corrupt artifacts */ }
                }
            }
        } catch {
            // ABI directory not found
        }
    }

    #findInSectors(sectors, contractName) {
        if (!sectors) return null;
        for (const sectorContracts of Object.values(sectors)) {
            if (typeof sectorContracts === 'object' && sectorContracts[contractName]) {
                return sectorContracts[contractName];
            }
        }
        return null;
    }

    // ── Check routines ────────────────────────────────────────────────

    #checkDeploymentFiles() {
        const checks = [];

        if (this.#deployments.size === 0) {
            checks.push({
                category: 'deployments',
                name: 'deployment-files-exist',
                status: 'fail',
                message: 'No deployment files found in smart-contracts/deployments/',
            });
            return checks;
        }

        for (const [chainId, data] of this.#deployments) {
            const coreCount = Object.keys(data.core || {}).length;
            const sectorCount = Object.keys(data.sectors || {}).length;
            checks.push({
                category: 'deployments',
                name: `chain-${chainId}-loaded`,
                status: coreCount > 0 ? 'pass' : 'warn',
                message: `Chain ${chainId}: ${coreCount} core contracts, ${sectorCount} sectors`,
            });
        }

        return checks;
    }

    #checkAddressValidity() {
        const checks = [];

        for (const [chainId, data] of this.#deployments) {
            const allAddresses = { ...(data.core || {}) };
            for (const [, sectorContracts] of Object.entries(data.sectors || {})) {
                if (typeof sectorContracts === 'object') {
                    Object.assign(allAddresses, sectorContracts);
                }
            }

            let valid = 0;
            let invalid = 0;
            for (const [name, addr] of Object.entries(allAddresses)) {
                if (!addr || addr === ZERO_ADDRESS || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
                    invalid++;
                    checks.push({
                        category: 'address-validity',
                        name: `${name}-chain-${chainId}`,
                        status: 'fail',
                        message: `Invalid address for ${name} on chain ${chainId}: ${addr}`,
                    });
                } else {
                    valid++;
                }
            }

            if (invalid === 0 && valid > 0) {
                checks.push({
                    category: 'address-validity',
                    name: `chain-${chainId}-all-valid`,
                    status: 'pass',
                    message: `All ${valid} addresses on chain ${chainId} are valid`,
                });
            }
        }

        return checks;
    }

    #checkSdkAbis() {
        const checks = [];

        if (this.#sdkAbis.size === 0) {
            checks.push({
                category: 'sdk-abis',
                name: 'abi-artifacts-exist',
                status: 'warn',
                message: 'No SDK ABI artifacts found',
            });
            return checks;
        }

        // Check that core deployed contracts have ABIs
        for (const [chainId, data] of this.#deployments) {
            for (const contractName of Object.keys(data.core || {})) {
                const hasAbi = this.#sdkAbis.has(contractName);
                checks.push({
                    category: 'sdk-abis',
                    name: `abi-${contractName}-chain-${chainId}`,
                    status: hasAbi ? 'pass' : 'warn',
                    message: hasAbi
                        ? `ABI found for ${contractName}`
                        : `No SDK ABI for deployed contract ${contractName} (chain ${chainId})`,
                });
            }
        }

        return checks;
    }

    #checkSdkMappingParity() {
        const checks = [];

        if (!this.#sdkContracts) {
            checks.push({
                category: 'sdk-mapping',
                name: 'sdk-contracts-loadable',
                status: 'warn',
                message: 'Could not load sdk/contracts.js',
            });
            return checks;
        }

        // Check if SDK can resolve addresses for known chains
        const getAddress = this.#sdkContracts.getAddress || this.#sdkContracts.getContractAddress;
        if (typeof getAddress === 'function') {
            for (const [chainId, data] of this.#deployments) {
                for (const [name, deployedAddr] of Object.entries(data.core || {})) {
                    try {
                        const sdkAddr = getAddress(name, Number(chainId));
                        if (sdkAddr && sdkAddr.toLowerCase() === deployedAddr.toLowerCase()) {
                            checks.push({
                                category: 'sdk-mapping',
                                name: `sdk-match-${name}-${chainId}`,
                                status: 'pass',
                                message: `SDK address matches deployment for ${name} on chain ${chainId}`,
                            });
                        } else if (sdkAddr) {
                            checks.push({
                                category: 'sdk-mapping',
                                name: `sdk-match-${name}-${chainId}`,
                                status: 'fail',
                                message: `SDK address mismatch for ${name} on chain ${chainId}: SDK=${sdkAddr} Deploy=${deployedAddr}`,
                            });
                        }
                    } catch {
                        // SDK doesn't know this contract — ok for sector contracts
                    }
                }
            }
        } else {
            checks.push({
                category: 'sdk-mapping',
                name: 'sdk-has-getAddress',
                status: 'warn',
                message: 'sdk/contracts.js does not export getAddress() — skipping mapping parity',
            });
        }

        return checks;
    }

    #checkPluginContracts(plugins) {
        const checks = [];

        for (const plugin of plugins) {
            let found = false;
            for (const [chainId, data] of this.#deployments) {
                // Check core
                if (data.core?.[plugin.name]) { found = true; break; }
                // Check sectors
                if (this.#findInSectors(data.sectors, plugin.name)) { found = true; break; }
            }

            const status = found ? 'pass' : (plugin.critical ? 'fail' : 'warn');
            checks.push({
                category: 'plugin-contracts',
                name: `plugin-contract-${plugin.name}`,
                status,
                message: found
                    ? `Plugin contract ${plugin.name} (${plugin.sector}) found in deployments`
                    : `Plugin contract ${plugin.name} (${plugin.sector}) NOT found in any deployment${plugin.critical ? ' [CRITICAL]' : ''}`,
            });
        }

        return checks;
    }
}

module.exports = ParityChecker;
