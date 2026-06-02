const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CrossChainBridge", function () {
    // Chain IDs
    const POLYGON_CHAIN_ID = 137n;
    const ARBITRUM_CHAIN_ID = 42161n;
    const ZKSYNC_CHAIN_ID = 324n;

    async function deployBridgeFixture() {
        const [owner, relayer, user1, user2] = await ethers.getSigners();

        // Deploy mock token
        const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        const token = await ERC20Mock.deploy("BeZhas Token", "BEZ", 18);
        await token.waitForDeployment();

        // Deploy bridge
        const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge");
        const bridge = await CrossChainBridge.deploy(await token.getAddress());
        await bridge.waitForDeployment();

        // Setup relayer role
        const RELAYER_ROLE = await bridge.RELAYER_ROLE();
        await bridge.grantRole(RELAYER_ROLE, relayer.address);

        // Mint tokens to users
        const mintAmount = ethers.parseEther("10000");
        await token.mint(user1.address, mintAmount);
        await token.mint(user2.address, mintAmount);

        // Approve bridge
        await token.connect(user1).approve(await bridge.getAddress(), ethers.MaxUint256);
        await token.connect(user2).approve(await bridge.getAddress(), ethers.MaxUint256);

        return { bridge, token, owner, relayer, user1, user2, RELAYER_ROLE };
    }

    describe("Deployment", function () {
        it("Should set the correct token address", async function () {
            const { bridge, token } = await loadFixture(deployBridgeFixture);
            expect(await bridge.token()).to.equal(await token.getAddress());
        });

        it("Should set the correct source chain ID", async function () {
            const { bridge } = await loadFixture(deployBridgeFixture);
            const chainId = await bridge.sourceChainId();
            expect(chainId).to.equal(31337n); // Hardhat's chain ID
        });

        it("Should grant admin role to deployer", async function () {
            const { bridge, owner } = await loadFixture(deployBridgeFixture);
            const DEFAULT_ADMIN_ROLE = await bridge.DEFAULT_ADMIN_ROLE();
            expect(await bridge.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });

        it("Should initialize with correct default values", async function () {
            const { bridge } = await loadFixture(deployBridgeFixture);
            expect(await bridge.bridgeFee()).to.equal(ethers.parseEther("0.001"));
            expect(await bridge.minBridgeAmount()).to.equal(ethers.parseEther("1"));
            expect(await bridge.maxBridgeAmount()).to.equal(ethers.parseEther("1000000"));
        });
    });

    describe("Chain Support", function () {
        it("Should have supported chains initialized", async function () {
            const { bridge } = await loadFixture(deployBridgeFixture);

            // Since we're on hardhat (31337), all other chains should be supported
            expect(await bridge.supportedChains(POLYGON_CHAIN_ID)).to.be.true;
            expect(await bridge.supportedChains(ARBITRUM_CHAIN_ID)).to.be.true;
            expect(await bridge.supportedChains(ZKSYNC_CHAIN_ID)).to.be.true;
        });

        it("Should return supported chains list", async function () {
            const { bridge } = await loadFixture(deployBridgeFixture);
            const chains = await bridge.getSupportedChains();
            expect(chains.length).to.equal(6);
        });

        it("Should allow operator to update chain support", async function () {
            const { bridge, owner } = await loadFixture(deployBridgeFixture);
            await bridge.connect(owner).setChainSupport(POLYGON_CHAIN_ID, false);
            expect(await bridge.supportedChains(POLYGON_CHAIN_ID)).to.be.false;
        });
    });

    describe("Bridge Tokens", function () {
        it("Should initiate a bridge transfer", async function () {
            const { bridge, token, user1 } = await loadFixture(deployBridgeFixture);

            const amount = ethers.parseEther("100");
            const bridgeFee = await bridge.bridgeFee();

            const tx = await bridge.connect(user1).bridgeTokens(
                user1.address,
                amount,
                POLYGON_CHAIN_ID,
                { value: bridgeFee }
            );

            await expect(tx).to.emit(bridge, "BridgeInitiated");

            // Check tokens were locked
            expect(await token.balanceOf(await bridge.getAddress())).to.equal(amount);
        });

        it("Should revert with invalid amount (below minimum)", async function () {
            const { bridge, user1 } = await loadFixture(deployBridgeFixture);

            const amount = ethers.parseEther("0.5"); // Below minimum
            const bridgeFee = await bridge.bridgeFee();

            await expect(
                bridge.connect(user1).bridgeTokens(
                    user1.address,
                    amount,
                    POLYGON_CHAIN_ID,
                    { value: bridgeFee }
                )
            ).to.be.revertedWithCustomError(bridge, "InvalidAmount");
        });

        it("Should revert with insufficient fee", async function () {
            const { bridge, user1 } = await loadFixture(deployBridgeFixture);

            const amount = ethers.parseEther("100");

            await expect(
                bridge.connect(user1).bridgeTokens(
                    user1.address,
                    amount,
                    POLYGON_CHAIN_ID,
                    { value: 0 }
                )
            ).to.be.revertedWithCustomError(bridge, "InsufficientFee");
        });

        it("Should revert for unsupported chain", async function () {
            const { bridge, user1, owner } = await loadFixture(deployBridgeFixture);

            // Disable the chain first
            await bridge.connect(owner).setChainSupport(POLYGON_CHAIN_ID, false);

            const amount = ethers.parseEther("100");
            const bridgeFee = await bridge.bridgeFee();

            await expect(
                bridge.connect(user1).bridgeTokens(
                    user1.address,
                    amount,
                    POLYGON_CHAIN_ID,
                    { value: bridgeFee }
                )
            ).to.be.revertedWithCustomError(bridge, "UnsupportedChain");
        });

        it("Should track pending bridge amounts", async function () {
            const { bridge, user1 } = await loadFixture(deployBridgeFixture);

            const amount = ethers.parseEther("100");
            const bridgeFee = await bridge.bridgeFee();

            await bridge.connect(user1).bridgeTokens(
                user1.address,
                amount,
                POLYGON_CHAIN_ID,
                { value: bridgeFee }
            );

            expect(await bridge.pendingBridgeAmounts(user1.address)).to.equal(amount);
        });
    });

    describe("Bridge Request Management", function () {
        it("Should store bridge request correctly", async function () {
            const { bridge, user1 } = await loadFixture(deployBridgeFixture);

            const amount = ethers.parseEther("100");
            const bridgeFee = await bridge.bridgeFee();

            const tx = await bridge.connect(user1).bridgeTokens(
                user1.address,
                amount,
                POLYGON_CHAIN_ID,
                { value: bridgeFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(
                log => log.fragment && log.fragment.name === "BridgeInitiated"
            );
            const messageId = event.args[0];

            const request = await bridge.getBridgeRequest(messageId);
            expect(request.sender).to.equal(user1.address);
            expect(request.recipient).to.equal(user1.address);
            expect(request.amount).to.equal(amount);
            expect(request.processed).to.be.false;
            expect(request.cancelled).to.be.false;
        });
    });

    describe("Daily Limits", function () {
        it("Should enforce daily limit", async function () {
            const { bridge, user1, owner, token } = await loadFixture(deployBridgeFixture);

            // Set a low daily limit for testing
            await bridge.connect(owner).updateDailyLimit(ethers.parseEther("200"));

            // Mint more tokens
            await token.mint(user1.address, ethers.parseEther("500"));

            const bridgeFee = await bridge.bridgeFee();

            // First bridge should succeed
            await bridge.connect(user1).bridgeTokens(
                user1.address,
                ethers.parseEther("100"),
                POLYGON_CHAIN_ID,
                { value: bridgeFee }
            );

            // Second bridge exceeding limit should fail
            await expect(
                bridge.connect(user1).bridgeTokens(
                    user1.address,
                    ethers.parseEther("150"),
                    POLYGON_CHAIN_ID,
                    { value: bridgeFee }
                )
            ).to.be.revertedWithCustomError(bridge, "DailyLimitExceeded");
        });

        it("Should return remaining daily limit", async function () {
            const { bridge, user1 } = await loadFixture(deployBridgeFixture);

            const amount = ethers.parseEther("100");
            const bridgeFee = await bridge.bridgeFee();
            const initialLimit = await bridge.dailyLimit();

            await bridge.connect(user1).bridgeTokens(
                user1.address,
                amount,
                POLYGON_CHAIN_ID,
                { value: bridgeFee }
            );

            const remainingLimit = await bridge.getRemainingDailyLimit();
            expect(remainingLimit).to.equal(initialLimit - amount);
        });
    });

    describe("Trusted Remotes", function () {
        it("Should set trusted remote", async function () {
            const { bridge, owner, user1 } = await loadFixture(deployBridgeFixture);

            await bridge.connect(owner).setTrustedRemote(POLYGON_CHAIN_ID, user1.address);
            expect(await bridge.trustedRemotes(POLYGON_CHAIN_ID)).to.equal(user1.address);
        });

        it("Should emit event on trusted remote set", async function () {
            const { bridge, owner, user1 } = await loadFixture(deployBridgeFixture);

            await expect(
                bridge.connect(owner).setTrustedRemote(POLYGON_CHAIN_ID, user1.address)
            ).to.emit(bridge, "TrustedRemoteSet")
                .withArgs(POLYGON_CHAIN_ID, user1.address);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow admin to update fees", async function () {
            const { bridge, owner } = await loadFixture(deployBridgeFixture);

            const newFee = ethers.parseEther("0.002");
            const newMin = ethers.parseEther("5");
            const newMax = ethers.parseEther("500000");

            await bridge.connect(owner).updateFees(newFee, newMin, newMax);

            expect(await bridge.bridgeFee()).to.equal(newFee);
            expect(await bridge.minBridgeAmount()).to.equal(newMin);
            expect(await bridge.maxBridgeAmount()).to.equal(newMax);
        });

        it("Should allow admin to add/remove relayer", async function () {
            const { bridge, owner, user1, RELAYER_ROLE } = await loadFixture(deployBridgeFixture);

            await bridge.connect(owner).addRelayer(user1.address);
            expect(await bridge.hasRole(RELAYER_ROLE, user1.address)).to.be.true;

            await bridge.connect(owner).removeRelayer(user1.address);
            expect(await bridge.hasRole(RELAYER_ROLE, user1.address)).to.be.false;
        });

        it("Should allow admin to pause/unpause", async function () {
            const { bridge, owner } = await loadFixture(deployBridgeFixture);

            await bridge.connect(owner).pause();
            expect(await bridge.paused()).to.be.true;

            await bridge.connect(owner).unpause();
            expect(await bridge.paused()).to.be.false;
        });

        it("Should prevent bridging when paused", async function () {
            const { bridge, owner, user1 } = await loadFixture(deployBridgeFixture);

            await bridge.connect(owner).pause();

            const amount = ethers.parseEther("100");
            const bridgeFee = await bridge.bridgeFee();

            await expect(
                bridge.connect(user1).bridgeTokens(
                    user1.address,
                    amount,
                    POLYGON_CHAIN_ID,
                    { value: bridgeFee }
                )
            ).to.be.revertedWithCustomError(bridge, "EnforcedPause");
        });

        it("Should allow admin to withdraw fees", async function () {
            const { bridge, owner, user1 } = await loadFixture(deployBridgeFixture);

            const amount = ethers.parseEther("100");
            const bridgeFee = await bridge.bridgeFee();

            await bridge.connect(user1).bridgeTokens(
                user1.address,
                amount,
                POLYGON_CHAIN_ID,
                { value: bridgeFee }
            );

            const initialBalance = await ethers.provider.getBalance(owner.address);
            await bridge.connect(owner).withdrawFees();
            const finalBalance = await ethers.provider.getBalance(owner.address);

            // Balance should have increased (minus gas)
            expect(finalBalance).to.be.gt(initialBalance - ethers.parseEther("0.01"));
        });
    });

    describe("Bridge Statistics", function () {
        it("Should return correct stats", async function () {
            const { bridge, user1 } = await loadFixture(deployBridgeFixture);

            const amount = ethers.parseEther("100");
            const bridgeFee = await bridge.bridgeFee();

            await bridge.connect(user1).bridgeTokens(
                user1.address,
                amount,
                POLYGON_CHAIN_ID,
                { value: bridgeFee }
            );

            const [totalLocked, todayBridged, remainingLimit, currentNonce] = await bridge.getBridgeStats();

            expect(totalLocked).to.equal(amount);
            expect(todayBridged).to.equal(amount);
            expect(currentNonce).to.equal(1n);
        });
    });

    describe("Chain Configuration", function () {
        it("Should allow setting chain config", async function () {
            const { bridge, owner, user1 } = await loadFixture(deployBridgeFixture);

            await bridge.connect(owner).setChainConfig(
                POLYGON_CHAIN_ID,
                true,
                user1.address,
                256, // confirmations
                500000 // gas limit
            );

            const config = await bridge.chainConfigs(POLYGON_CHAIN_ID);
            expect(config.isSupported).to.be.true;
            expect(config.bridgeAddress).to.equal(user1.address);
            expect(config.confirmations).to.equal(256);
            expect(config.gasLimit).to.equal(500000);
        });
    });

    describe("Cancel Bridge", function () {
        it("Should allow sender to cancel within timeout", async function () {
            const { bridge, token, user1 } = await loadFixture(deployBridgeFixture);

            const amount = ethers.parseEther("100");
            const bridgeFee = await bridge.bridgeFee();
            const initialBalance = await token.balanceOf(user1.address);

            const tx = await bridge.connect(user1).bridgeTokens(
                user1.address,
                amount,
                POLYGON_CHAIN_ID,
                { value: bridgeFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(
                log => log.fragment && log.fragment.name === "BridgeInitiated"
            );
            const messageId = event.args[0];

            // Cancel the bridge
            await expect(
                bridge.connect(user1).cancelBridge(messageId)
            ).to.emit(bridge, "BridgeCancelled");

            // Tokens should be returned
            expect(await token.balanceOf(user1.address)).to.equal(initialBalance);
        });

        it("Should prevent non-sender from cancelling", async function () {
            const { bridge, user1, user2 } = await loadFixture(deployBridgeFixture);

            const amount = ethers.parseEther("100");
            const bridgeFee = await bridge.bridgeFee();

            const tx = await bridge.connect(user1).bridgeTokens(
                user1.address,
                amount,
                POLYGON_CHAIN_ID,
                { value: bridgeFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(
                log => log.fragment && log.fragment.name === "BridgeInitiated"
            );
            const messageId = event.args[0];

            await expect(
                bridge.connect(user2).cancelBridge(messageId)
            ).to.be.revertedWithCustomError(bridge, "UnauthorizedCaller");
        });
    });
});
