/**
 * Account Abstraction Service (ERC-4337)
 * Enables gasless transactions and Web2-like onboarding
 * Critical for Web2 → Web3 user transition
 * 
 * @module services/account-abstraction.service
 */

const { ethers } = require('ethers');
const pino = require('pino');
const cacheService = require('./cache.service');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ERC-4337 Entry Point ABI (simplified)
const ENTRY_POINT_ABI = [
    'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)',
    'function getNonce(address sender, uint192 key) view returns (uint256)',
    'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)'
];

// Simple Account Factory ABI
const ACCOUNT_FACTORY_ABI = [
    'function createAccount(address owner, uint256 salt) returns (address)',
    'function getAddress(address owner, uint256 salt) view returns (address)'
];

// Paymaster ABI (for sponsored transactions)
const PAYMASTER_ABI = [
    'function validatePaymasterUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 maxCost) external returns (bytes context, uint256 validationData)',
    'function deposit() payable',
    'function getDeposit() view returns (uint256)'
];

class AccountAbstractionService {
    constructor() {
        this.provider = null;
        this.entryPoint = null;
        this.accountFactory = null;
        this.paymaster = null;
        this.bundlerUrl = process.env.BUNDLER_URL;
        this.isInitialized = false;

        // Configuration
        this.config = {
            entryPointAddress: process.env.ENTRY_POINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // Default ERC-4337 EntryPoint
            accountFactoryAddress: process.env.ACCOUNT_FACTORY_ADDRESS,
            paymasterAddress: process.env.PAYMASTER_ADDRESS,
            chainId: parseInt(process.env.CHAIN_ID || '137'),
            sponsorGasLimit: ethers.parseEther(process.env.SPONSOR_GAS_LIMIT || '0.1'), // Max gas to sponsor per user/day
            defaultGasLimits: {
                callGasLimit: 100000n,
                verificationGasLimit: 100000n,
                preVerificationGas: 21000n
            }
        };
    }

    /**
     * Initialize the service
     */
    async initialize() {
        try {
            if (!process.env.RPC_URL) {
                logger.warn('RPC_URL not configured. Account abstraction disabled.');
                return false;
            }

            this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

            // Initialize EntryPoint contract
            this.entryPoint = new ethers.Contract(
                this.config.entryPointAddress,
                ENTRY_POINT_ABI,
                this.provider
            );

            // Initialize Account Factory if configured
            if (this.config.accountFactoryAddress) {
                this.accountFactory = new ethers.Contract(
                    this.config.accountFactoryAddress,
                    ACCOUNT_FACTORY_ABI,
                    this.provider
                );
            }

            // Initialize Paymaster if configured
            if (this.config.paymasterAddress) {
                this.paymaster = new ethers.Contract(
                    this.config.paymasterAddress,
                    PAYMASTER_ABI,
                    this.provider
                );
            }

            this.isInitialized = true;
            logger.info({
                entryPoint: this.config.entryPointAddress,
                hasFactory: !!this.accountFactory,
                hasPaymaster: !!this.paymaster,
                hasBundler: !!this.bundlerUrl
            }, '✅ Account Abstraction service initialized');

            return true;
        } catch (error) {
            logger.error({ error: error.message }, '❌ Failed to initialize Account Abstraction');
            return false;
        }
    }

    /**
     * Create or get Smart Account address for a user
     * Allows users to use the platform without a wallet
     */
    async getSmartAccountAddress(ownerAddress, salt = 0) {
        if (!this.accountFactory) {
            throw new Error('Account factory not configured');
        }

        const cacheKey = `smartAccount:${ownerAddress.toLowerCase()}:${salt}`;

        // Check cache first
        let address = await cacheService.get(cacheKey);
        if (address) return address;

        // Get counterfactual address (doesn't deploy yet)
        address = await this.accountFactory.getAddress(ownerAddress, salt);

        // Cache permanently (deterministic)
        await cacheService.set(cacheKey, address, 86400 * 365);

        return address;
    }

    /**
     * Check if a Smart Account is already deployed
     */
    async isAccountDeployed(accountAddress) {
        const code = await this.provider.getCode(accountAddress);
        return code !== '0x';
    }

    /**
     * Get nonce for a Smart Account
     */
    async getNonce(accountAddress, key = 0n) {
        try {
            return await this.entryPoint.getNonce(accountAddress, key);
        } catch {
            return 0n;
        }
    }

    /**
     * Create a UserOperation for gasless transaction
     * This is the core of ERC-4337
     */
    async createUserOperation(params) {
        const {
            sender,          // Smart Account address
            owner,           // EOA owner address
            callData,        // Encoded function call
            initCode = '0x', // Factory init code (for first-time deployment)
            gasEstimates = null,
            sponsorGas = true
        } = params;

        // Get nonce
        const nonce = await this.getNonce(sender);

        // Get gas estimates
        const feeData = await this.provider.getFeeData();

        const userOp = {
            sender,
            nonce,
            initCode,
            callData,
            callGasLimit: gasEstimates?.callGasLimit || this.config.defaultGasLimits.callGasLimit,
            verificationGasLimit: gasEstimates?.verificationGasLimit || this.config.defaultGasLimits.verificationGasLimit,
            preVerificationGas: gasEstimates?.preVerificationGas || this.config.defaultGasLimits.preVerificationGas,
            maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei'),
            paymasterAndData: '0x',
            signature: '0x' // Will be filled by user
        };

        // Add paymaster data if sponsoring gas
        if (sponsorGas && this.paymaster) {
            const paymasterData = await this.getPaymasterData(userOp, owner);
            if (paymasterData) {
                userOp.paymasterAndData = paymasterData;
            }
        }

        return userOp;
    }

    /**
     * Get Paymaster data for sponsored transactions
     */
    async getPaymasterData(userOp, ownerAddress) {
        if (!this.paymaster) {
            return null;
        }

        try {
            // Check user's daily sponsorship limit
            const dailyUsage = await this.getUserDailyGasUsage(ownerAddress);
            if (dailyUsage >= this.config.sponsorGasLimit) {
                logger.warn({ ownerAddress, dailyUsage }, 'User exceeded daily gas sponsorship limit');
                return null;
            }

            // Simple paymaster data: just the paymaster address
            // More complex paymasters might require signatures, timestamps, etc.
            return ethers.concat([
                this.config.paymasterAddress,
                '0x' // Additional data if needed
            ]);
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to get paymaster data');
            return null;
        }
    }

    /**
     * Track user's daily gas usage for sponsorship limits
     */
    async getUserDailyGasUsage(userAddress) {
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `gasUsage:${userAddress.toLowerCase()}:${today}`;

        const usage = await cacheService.get(cacheKey);
        return usage ? BigInt(usage) : 0n;
    }

    /**
     * Update user's daily gas usage
     */
    async updateUserDailyGasUsage(userAddress, gasUsed) {
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `gasUsage:${userAddress.toLowerCase()}:${today}`;

        const currentUsage = await this.getUserDailyGasUsage(userAddress);
        const newUsage = currentUsage + BigInt(gasUsed);

        // Cache expires at midnight (simplified: 24 hours from now)
        await cacheService.set(cacheKey, newUsage.toString(), 86400);
    }

    /**
     * Get UserOperation hash for signing
     */
    async getUserOpHash(userOp) {
        return await this.entryPoint.getUserOpHash(userOp);
    }

    /**
     * Submit UserOperation to bundler
     */
    async submitUserOperation(userOp) {
        if (!this.bundlerUrl) {
            throw new Error('Bundler URL not configured. Cannot submit UserOperation.');
        }

        try {
            const response = await fetch(this.bundlerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_sendUserOperation',
                    params: [this.serializeUserOp(userOp), this.config.entryPointAddress]
                })
            });

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error.message);
            }

            logger.info({ userOpHash: result.result }, 'UserOperation submitted to bundler');

            return {
                userOpHash: result.result,
                success: true
            };
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to submit UserOperation');
            throw error;
        }
    }

    /**
     * Serialize UserOp for JSON-RPC
     */
    serializeUserOp(userOp) {
        return {
            sender: userOp.sender,
            nonce: '0x' + userOp.nonce.toString(16),
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: '0x' + userOp.callGasLimit.toString(16),
            verificationGasLimit: '0x' + userOp.verificationGasLimit.toString(16),
            preVerificationGas: '0x' + userOp.preVerificationGas.toString(16),
            maxFeePerGas: '0x' + userOp.maxFeePerGas.toString(16),
            maxPriorityFeePerGas: '0x' + userOp.maxPriorityFeePerGas.toString(16),
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature
        };
    }

    /**
     * Wait for UserOperation receipt
     */
    async waitForUserOperation(userOpHash, timeout = 60000) {
        if (!this.bundlerUrl) {
            throw new Error('Bundler URL not configured');
        }

        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            try {
                const response = await fetch(this.bundlerUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'eth_getUserOperationReceipt',
                        params: [userOpHash]
                    })
                });

                const result = await response.json();

                if (result.result) {
                    return {
                        success: result.result.success,
                        transactionHash: result.result.receipt?.transactionHash,
                        blockNumber: result.result.receipt?.blockNumber,
                        gasUsed: result.result.actualGasUsed
                    };
                }
            } catch (error) {
                // Continue polling
            }

            await this.delay(2000); // Poll every 2 seconds
        }

        throw new Error('Timeout waiting for UserOperation');
    }

    /**
     * Execute a gasless transaction for a user
     * This is the main entry point for sponsored transactions
     */
    async executeGaslessTransaction(params) {
        const {
            ownerAddress,      // User's EOA (for signing)
            targetContract,    // Contract to call
            functionName,      // Function to call
            functionArgs,      // Function arguments
            contractAbi,       // Contract ABI
            signature          // User's signature of UserOpHash
        } = params;

        try {
            // Get or compute Smart Account address
            const smartAccountAddress = await this.getSmartAccountAddress(ownerAddress);

            // Check if account is deployed
            const isDeployed = await this.isAccountDeployed(smartAccountAddress);

            // Encode the call
            const iface = new ethers.Interface(contractAbi);
            const callData = iface.encodeFunctionData(functionName, functionArgs);

            // Create init code if account not deployed
            let initCode = '0x';
            if (!isDeployed && this.accountFactory) {
                const factoryInterface = new ethers.Interface(ACCOUNT_FACTORY_ABI);
                const initData = factoryInterface.encodeFunctionData('createAccount', [ownerAddress, 0]);
                initCode = ethers.concat([this.config.accountFactoryAddress, initData]);
            }

            // Create UserOperation
            const userOp = await this.createUserOperation({
                sender: smartAccountAddress,
                owner: ownerAddress,
                callData,
                initCode,
                sponsorGas: true
            });

            // Add signature
            userOp.signature = signature;

            // Submit to bundler
            const submitResult = await this.submitUserOperation(userOp);

            // Wait for confirmation
            const receipt = await this.waitForUserOperation(submitResult.userOpHash);

            // Update gas usage tracking
            if (receipt.gasUsed) {
                await this.updateUserDailyGasUsage(ownerAddress, receipt.gasUsed);
            }

            logger.info({
                owner: ownerAddress,
                smartAccount: smartAccountAddress,
                txHash: receipt.transactionHash
            }, 'Gasless transaction executed');

            return {
                success: true,
                smartAccountAddress,
                transactionHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed,
                sponsored: true
            };
        } catch (error) {
            logger.error({ error: error.message, ownerAddress }, 'Gasless transaction failed');
            throw error;
        }
    }

    /**
     * Prepare a transaction for user signing
     * Returns the UserOp hash that needs to be signed
     */
    async prepareGaslessTransaction(params) {
        const {
            ownerAddress,
            targetContract,
            functionName,
            functionArgs,
            contractAbi
        } = params;

        const smartAccountAddress = await this.getSmartAccountAddress(ownerAddress);
        const isDeployed = await this.isAccountDeployed(smartAccountAddress);

        // Encode the call
        const iface = new ethers.Interface(contractAbi);
        const callData = iface.encodeFunctionData(functionName, functionArgs);

        // Create init code if needed
        let initCode = '0x';
        if (!isDeployed && this.accountFactory) {
            const factoryInterface = new ethers.Interface(ACCOUNT_FACTORY_ABI);
            const initData = factoryInterface.encodeFunctionData('createAccount', [ownerAddress, 0]);
            initCode = ethers.concat([this.config.accountFactoryAddress, initData]);
        }

        // Create UserOperation
        const userOp = await this.createUserOperation({
            sender: smartAccountAddress,
            owner: ownerAddress,
            callData,
            initCode,
            sponsorGas: true
        });

        // Get hash for signing
        const userOpHash = await this.getUserOpHash(userOp);

        return {
            userOp: this.serializeUserOp(userOp),
            userOpHash,
            smartAccountAddress,
            isNewAccount: !isDeployed,
            estimatedGas: {
                callGasLimit: userOp.callGasLimit.toString(),
                verificationGasLimit: userOp.verificationGasLimit.toString()
            }
        };
    }

    /**
     * Check if user is eligible for gas sponsorship
     */
    async isEligibleForSponsorship(userAddress) {
        const dailyUsage = await this.getUserDailyGasUsage(userAddress);
        return dailyUsage < this.config.sponsorGasLimit;
    }

    /**
     * Get user's sponsorship status
     */
    async getSponsorshipStatus(userAddress) {
        const dailyUsage = await this.getUserDailyGasUsage(userAddress);
        const limit = this.config.sponsorGasLimit;

        return {
            dailyUsage: ethers.formatEther(dailyUsage),
            dailyLimit: ethers.formatEther(limit),
            remaining: ethers.formatEther(limit - dailyUsage),
            isEligible: dailyUsage < limit,
            percentUsed: Number((dailyUsage * 100n) / limit)
        };
    }

    /**
     * Utility: delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            entryPoint: this.config.entryPointAddress,
            hasFactory: !!this.accountFactory,
            hasPaymaster: !!this.paymaster,
            hasBundler: !!this.bundlerUrl,
            chainId: this.config.chainId
        };
    }
}

// Singleton instance
const accountAbstractionService = new AccountAbstractionService();

module.exports = accountAbstractionService;
