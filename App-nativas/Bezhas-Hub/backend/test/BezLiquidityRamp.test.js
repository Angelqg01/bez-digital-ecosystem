// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * BezLiquidityRamp Test Suite
 * 
 * Tests the complete Revenue Stream Native system:
 * - Smart contract functionality
 * - Fee collection
 * - Signature validation
 * - Anti-replay protection
 * - Role-based access control
 * - Edge cases and security
 */
describe("BezLiquidityRamp - Revenue Stream Native", function () {
    let liquidityRamp;
    let mockRouter;
    let bezToken;
    let usdc;
    let owner;
    let aiSigner;
    let treasury;
    let user;
    let attacker;

    const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
    const USDC_DECIMALS = 6;
    const BEZ_DECIMALS = 18;

    beforeEach(async function () {
        [owner, aiSigner, treasury, user, attacker] = await ethers.getSigners();

        // Deploy mock ERC20 tokens
        const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        bezToken = await ERC20Mock.deploy("BeZhas Token", "BEZ", INITIAL_SUPPLY);
        usdc = await ERC20Mock.deploy("USD Coin", "USDC", INITIAL_SUPPLY);

        // Deploy mock Uniswap router
        const UniswapV2RouterMock = await ethers.getContractFactory("UniswapV2RouterMock");
        mockRouter = await UniswapV2RouterMock.deploy(
            await bezToken.getAddress(),
            await usdc.getAddress()
        );

        // Deploy BezLiquidityRamp
        const BezLiquidityRamp = await ethers.getContractFactory("BezLiquidityRamp");
        liquidityRamp = await BezLiquidityRamp.deploy(
            await mockRouter.getAddress(),
            await bezToken.getAddress(),
            await usdc.getAddress(),
            owner.address,
            treasury.address
        );

        // Setup: Fund mock router with BEZ tokens (for swaps)
        await bezToken.transfer(await mockRouter.getAddress(), ethers.parseEther("100000"));

        // Setup: Grant SIGNER_ROLE to aiSigner
        const SIGNER_ROLE = await liquidityRamp.SIGNER_ROLE();
        await liquidityRamp.grantRole(SIGNER_ROLE, aiSigner.address);

        // Setup: Give user 10,000 USDC
        await usdc.transfer(user.address, ethers.parseUnits("10000", USDC_DECIMALS));

        // Setup: User approves liquidityRamp to spend USDC
        await usdc.connect(user).approve(
            await liquidityRamp.getAddress(),
            ethers.MaxUint256
        );
    });

    describe("Deployment", function () {
        it("Should set the correct initial values", async function () {
            expect(await liquidityRamp.platformFeeBps()).to.equal(50); // 0.5%
            expect(await liquidityRamp.treasuryWallet()).to.equal(treasury.address);
            expect(await liquidityRamp.uniswapRouter()).to.equal(await mockRouter.getAddress());
        });

        it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = await liquidityRamp.DEFAULT_ADMIN_ROLE();
            expect(await liquidityRamp.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });
    });

    describe("Signature Generation and Validation", function () {
        it("Should generate valid signature from AI signer", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

            // Generate signature (mimics backend AI Risk Engine)
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );

            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            // Verify signature is valid
            expect(signature).to.have.lengthOf(132); // 0x + 130 hex chars
        });

        it("Should validate correct signature on-chain", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const minBezAmount = 0;
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            // Generate signature
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            // Execute swap (should succeed)
            await expect(
                liquidityRamp.connect(user).swapFiatToBezWithSignature(
                    amountUSDC,
                    minBezAmount,
                    serviceId,
                    deadline,
                    signature
                )
            ).to.not.be.reverted;
        });

        it("Should reject signature from non-SIGNER_ROLE address", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            // Generate signature with attacker's key (not SIGNER_ROLE)
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await attacker.signMessage(ethers.getBytes(messageHash));

            // Should revert
            await expect(
                liquidityRamp.connect(user).swapFiatToBezWithSignature(
                    amountUSDC,
                    0,
                    serviceId,
                    deadline,
                    signature
                )
            ).to.be.revertedWith("Invalid signer");
        });
    });

    describe("Fee Collection", function () {
        it("Should collect 0.5% platform fee", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS); // 1000 USDC
            const expectedFee = ethers.parseUnits("5", USDC_DECIMALS); // 5 USDC (0.5%)
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            // Generate signature
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            // Check treasury balance before
            const treasuryBalanceBefore = await usdc.balanceOf(treasury.address);

            // Execute swap
            await liquidityRamp.connect(user).swapFiatToBezWithSignature(
                amountUSDC,
                0,
                serviceId,
                deadline,
                signature
            );

            // Check treasury balance after
            const treasuryBalanceAfter = await usdc.balanceOf(treasury.address);

            expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(expectedFee);
        });

        it("Should emit PlatformFeeCollected event", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const expectedFee = ethers.parseUnits("5", USDC_DECIMALS);
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            await expect(
                liquidityRamp.connect(user).swapFiatToBezWithSignature(
                    amountUSDC,
                    0,
                    serviceId,
                    deadline,
                    signature
                )
            )
                .to.emit(liquidityRamp, "PlatformFeeCollected")
                .withArgs(user.address, expectedFee, serviceId);
        });

        it("Should swap net amount (after fee) for BEZ tokens", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const expectedFee = ethers.parseUnits("5", USDC_DECIMALS);
            const netAmount = amountUSDC - expectedFee; // 995 USDC
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            // Check user BEZ balance before
            const userBezBalanceBefore = await bezToken.balanceOf(user.address);

            // Execute swap
            await liquidityRamp.connect(user).swapFiatToBezWithSignature(
                amountUSDC,
                0,
                serviceId,
                deadline,
                signature
            );

            // Check user BEZ balance after
            const userBezBalanceAfter = await bezToken.balanceOf(user.address);

            // User should receive BEZ tokens (mock router gives 1:1 ratio)
            expect(userBezBalanceAfter).to.be.gt(userBezBalanceBefore);
        });
    });

    describe("Anti-Replay Protection", function () {
        it("Should prevent signature reuse (same signature twice)", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            // First swap (should succeed)
            await liquidityRamp.connect(user).swapFiatToBezWithSignature(
                amountUSDC,
                0,
                serviceId,
                deadline,
                signature
            );

            // Approve more USDC for second attempt
            await usdc.transfer(user.address, ethers.parseUnits("1000", USDC_DECIMALS));

            // Second swap with same signature (should revert)
            await expect(
                liquidityRamp.connect(user).swapFiatToBezWithSignature(
                    amountUSDC,
                    0,
                    serviceId,
                    deadline,
                    signature
                )
            ).to.be.revertedWith("Signature already used");
        });

        it("Should reject expired signatures", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) - 100; // Already expired

            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            await expect(
                liquidityRamp.connect(user).swapFiatToBezWithSignature(
                    amountUSDC,
                    0,
                    serviceId,
                    deadline,
                    signature
                )
            ).to.be.revertedWith("Signature expired");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow admin to update platform fee", async function () {
            const newFeeBps = 100; // 1%

            await liquidityRamp.setPlatformFee(newFeeBps);

            expect(await liquidityRamp.platformFeeBps()).to.equal(newFeeBps);
        });

        it("Should prevent fee above 5%", async function () {
            const invalidFeeBps = 600; // 6% (too high)

            await expect(
                liquidityRamp.setPlatformFee(invalidFeeBps)
            ).to.be.revertedWith("Fee too high");
        });

        it("Should allow admin to update treasury wallet", async function () {
            const [, , , , newTreasury] = await ethers.getSigners();

            await liquidityRamp.setTreasury(newTreasury.address);

            expect(await liquidityRamp.treasuryWallet()).to.equal(newTreasury.address);
        });

        it("Should prevent non-admin from updating settings", async function () {
            await expect(
                liquidityRamp.connect(attacker).setPlatformFee(100)
            ).to.be.reverted; // AccessControl revert
        });
    });

    describe("Statistics Tracking", function () {
        it("Should track total volume processed", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            await liquidityRamp.connect(user).swapFiatToBezWithSignature(
                amountUSDC,
                0,
                serviceId,
                deadline,
                signature
            );

            const stats = await liquidityRamp.getStats();
            expect(stats[0]).to.equal(amountUSDC); // totalVolumeProcessed
        });

        it("Should track total fees collected", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const expectedFee = ethers.parseUnits("5", USDC_DECIMALS);
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            await liquidityRamp.connect(user).swapFiatToBezWithSignature(
                amountUSDC,
                0,
                serviceId,
                deadline,
                signature
            );

            const stats = await liquidityRamp.getStats();
            expect(stats[1]).to.equal(expectedFee); // totalFeesCollected
        });

        it("Should track total transactions", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const serviceId = "LIQUIDITY_RAMP";

            // Execute 3 swaps
            for (let i = 0; i < 3; i++) {
                const deadline = Math.floor(Date.now() / 1000) + 300 + i; // Unique deadline

                const messageHash = ethers.solidityPackedKeccak256(
                    ["address", "uint256", "string", "uint256", "address"],
                    [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
                );
                const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

                await liquidityRamp.connect(user).swapFiatToBezWithSignature(
                    amountUSDC,
                    0,
                    serviceId,
                    deadline,
                    signature
                );
            }

            const stats = await liquidityRamp.getStats();
            expect(stats[2]).to.equal(3); // totalTransactions
        });
    });

    describe("Edge Cases", function () {
        it("Should handle minimum swap amount (1 USDC)", async function () {
            const amountUSDC = ethers.parseUnits("1", USDC_DECIMALS);
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            await expect(
                liquidityRamp.connect(user).swapFiatToBezWithSignature(
                    amountUSDC,
                    0,
                    serviceId,
                    deadline,
                    signature
                )
            ).to.not.be.reverted;
        });

        it("Should revert if slippage protection triggered", async function () {
            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const minBezAmount = ethers.parseEther("1000000"); // Unrealistic amount
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

            await expect(
                liquidityRamp.connect(user).swapFiatToBezWithSignature(
                    amountUSDC,
                    minBezAmount,
                    serviceId,
                    deadline,
                    signature
                )
            ).to.be.revertedWith("Slippage too high");
        });

        it("Should handle concurrent swaps from different users", async function () {
            // Setup second user
            const [, , , , , user2] = await ethers.getSigners();
            await usdc.transfer(user2.address, ethers.parseUnits("1000", USDC_DECIMALS));
            await usdc.connect(user2).approve(await liquidityRamp.getAddress(), ethers.MaxUint256);

            const amountUSDC = ethers.parseUnits("1000", USDC_DECIMALS);
            const serviceId = "LIQUIDITY_RAMP";
            const deadline = Math.floor(Date.now() / 1000) + 300;

            // Generate signatures for both users
            const hash1 = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const sig1 = await aiSigner.signMessage(ethers.getBytes(hash1));

            const hash2 = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string", "uint256", "address"],
                [user2.address, amountUSDC, serviceId, deadline, await liquidityRamp.getAddress()]
            );
            const sig2 = await aiSigner.signMessage(ethers.getBytes(hash2));

            // Execute both swaps (should both succeed)
            await expect(
                liquidityRamp.connect(user).swapFiatToBezWithSignature(
                    amountUSDC, 0, serviceId, deadline, sig1
                )
            ).to.not.be.reverted;

            await expect(
                liquidityRamp.connect(user2).swapFiatToBezWithSignature(
                    amountUSDC, 0, serviceId, deadline, sig2
                )
            ).to.not.be.reverted;

            // Verify stats
            const stats = await liquidityRamp.getStats();
            expect(stats[2]).to.equal(2); // 2 transactions
        });
    });
});
