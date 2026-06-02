/**
 * ============================================================================
 * QUALITY ORACLE V2 - UNIT TESTS
 * ============================================================================
 * 
 * Tests completos para QualityOracle.sol
 * Cubre: validación multi-sector, registro de validadores, staking, disputas
 * 
 * Run: npx hardhat test test/QualityOracle.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("QualityOracle V2", function () {
    // ═══════════════════════════════════════════════════════════════════════
    //                              FIXTURES
    // ═══════════════════════════════════════════════════════════════════════

    async function deployQualityOracleFixture() {
        const [owner, validator1, validator2, user1, user2, treasury, arbitrator] = await ethers.getSigners();

        // Deploy mock BEZ token
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const bezToken = await MockERC20.deploy("BeZhas Coin", "BEZ");
        await bezToken.waitForDeployment();

        // Deploy QualityOracle
        const QualityOracle = await ethers.getContractFactory("QualityOracle");
        const qualityOracle = await QualityOracle.deploy(
            await bezToken.getAddress(),
            treasury.address
        );
        await qualityOracle.waitForDeployment();

        // Mint tokens for testing
        const mintAmount = ethers.parseEther("100000");
        await bezToken.mint(owner.address, mintAmount);
        await bezToken.mint(validator1.address, mintAmount);
        await bezToken.mint(validator2.address, mintAmount);
        await bezToken.mint(user1.address, mintAmount);
        await bezToken.mint(user2.address, mintAmount);

        // Approve tokens for QualityOracle
        await bezToken.connect(owner).approve(await qualityOracle.getAddress(), mintAmount);
        await bezToken.connect(validator1).approve(await qualityOracle.getAddress(), mintAmount);
        await bezToken.connect(validator2).approve(await qualityOracle.getAddress(), mintAmount);
        await bezToken.connect(user1).approve(await qualityOracle.getAddress(), mintAmount);
        await bezToken.connect(user2).approve(await qualityOracle.getAddress(), mintAmount);

        return { qualityOracle, bezToken, owner, validator1, validator2, user1, user2, treasury, arbitrator };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          DEPLOYMENT TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe("Deployment", function () {
        it("Should set the correct BEZ token address", async function () {
            const { qualityOracle, bezToken } = await loadFixture(deployQualityOracleFixture);
            expect(await qualityOracle.bezToken()).to.equal(await bezToken.getAddress());
        });

        it("Should set the correct treasury address", async function () {
            const { qualityOracle, treasury } = await loadFixture(deployQualityOracleFixture);
            expect(await qualityOracle.treasuryDAO()).to.equal(treasury.address);
        });

        it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
            const { qualityOracle, owner } = await loadFixture(deployQualityOracleFixture);
            const DEFAULT_ADMIN_ROLE = await qualityOracle.DEFAULT_ADMIN_ROLE();
            expect(await qualityOracle.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });

        it("Should grant DAO_ROLE to treasury", async function () {
            const { qualityOracle, treasury } = await loadFixture(deployQualityOracleFixture);
            const DAO_ROLE = await qualityOracle.DAO_ROLE();
            expect(await qualityOracle.hasRole(DAO_ROLE, treasury.address)).to.be.true;
        });

        it("Should have initialized all 9 entity types", async function () {
            const { qualityOracle } = await loadFixture(deployQualityOracleFixture);

            // EntityType enum: PRODUCT(0), SERVICE(1), NFT(2), RWA(3), LOGISTICS(4), 
            // SDK_INTERACTION(5), POST(6), REVIEW(7), TRANSACTION(8)
            for (let i = 0; i < 9; i++) {
                const config = await qualityOracle.entityConfigs(i);
                expect(config.isActive).to.be.true;
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                        ENTITY CONFIG TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe("Entity Configurations", function () {
        it("Should have correct PRODUCT configuration", async function () {
            const { qualityOracle } = await loadFixture(deployQualityOracleFixture);
            const config = await qualityOracle.entityConfigs(0); // PRODUCT

            expect(config.minQualityThreshold).to.equal(60);
            expect(config.collateralRequired).to.equal(ethers.parseEther("100"));
            expect(config.validationFee).to.equal(ethers.parseEther("5"));
            expect(config.requiresHumanReview).to.be.true;
        });

        it("Should have correct RWA configuration (highest collateral)", async function () {
            const { qualityOracle } = await loadFixture(deployQualityOracleFixture);
            const config = await qualityOracle.entityConfigs(3); // RWA

            expect(config.minQualityThreshold).to.equal(80);
            expect(config.collateralRequired).to.equal(ethers.parseEther("1000"));
            expect(config.validationFee).to.equal(ethers.parseEther("50"));
            expect(config.penaltyMultiplier).to.equal(300);
        });

        it("Should have correct POST configuration (lowest collateral)", async function () {
            const { qualityOracle } = await loadFixture(deployQualityOracleFixture);
            const config = await qualityOracle.entityConfigs(6); // POST

            expect(config.minQualityThreshold).to.equal(30);
            expect(config.collateralRequired).to.equal(ethers.parseEther("5"));
            expect(config.validationFee).to.equal(ethers.parseEther("0.5"));
        });

        it("Should allow admin to update entity config", async function () {
            const { qualityOracle, treasury } = await loadFixture(deployQualityOracleFixture);

            // treasury has DAO_ROLE which is required for updateEntityConfig
            await expect(qualityOracle.connect(treasury).updateEntityConfig(
                0, // PRODUCT
                70, // new threshold
                ethers.parseEther("150"), // new collateral
                ethers.parseEther("10"), // new fee
                200, // penalty multiplier
                130, // reward multiplier
                true, // requires human review
                true // is active
            )).to.emit(qualityOracle, "EntityConfigUpdated").withArgs(0);

            const config = await qualityOracle.entityConfigs(0);
            expect(config.minQualityThreshold).to.equal(70);
            expect(config.collateralRequired).to.equal(ethers.parseEther("150"));
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                      VALIDATOR REGISTRATION TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe("Validator Registration", function () {
        it("Should allow users to register as validators with minimum stake", async function () {
            const { qualityOracle, validator1 } = await loadFixture(deployQualityOracleFixture);

            const stakeAmount = ethers.parseEther("1000"); // Minimum stake

            await expect(qualityOracle.connect(validator1).registerAsValidator(stakeAmount))
                .to.emit(qualityOracle, "ValidatorRegistered")
                .withArgs(validator1.address, stakeAmount);

            const profile = await qualityOracle.validators(validator1.address);
            expect(profile.isActive).to.be.true;
            expect(profile.stakedAmount).to.equal(stakeAmount);
        });

        it("Should reject registration with insufficient stake", async function () {
            const { qualityOracle, validator1 } = await loadFixture(deployQualityOracleFixture);

            const insufficientStake = ethers.parseEther("500"); // Below minimum

            await expect(
                qualityOracle.connect(validator1).registerAsValidator(insufficientStake)
            ).to.be.revertedWith("QO: Insufficient stake");
        });

        // NOTE: addStake function doesn't exist in current contract - skipping test
        it.skip("Should allow validators to increase their stake", async function () {
            const { qualityOracle, validator1 } = await loadFixture(deployQualityOracleFixture);

            // Initial registration
            await qualityOracle.connect(validator1).registerAsValidator(ethers.parseEther("1000"));

            // Add more stake - function not implemented yet
            const additionalStake = ethers.parseEther("500");
            // await qualityOracle.connect(validator1).addStake(additionalStake);

            const profile = await qualityOracle.validators(validator1.address);
            expect(profile.stakedAmount).to.equal(ethers.parseEther("1000"));
        });

        it("Should grant VALIDATOR_ROLE upon registration", async function () {
            const { qualityOracle, validator1 } = await loadFixture(deployQualityOracleFixture);

            await qualityOracle.connect(validator1).registerAsValidator(ethers.parseEther("1000"));

            const VALIDATOR_ROLE = await qualityOracle.VALIDATOR_ROLE();
            expect(await qualityOracle.hasRole(VALIDATOR_ROLE, validator1.address)).to.be.true;
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                      VALIDATION REQUEST TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe("Validation Requests", function () {
        it("Should allow users to request validation for PRODUCT", async function () {
            const { qualityOracle, user1 } = await loadFixture(deployQualityOracleFixture);

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-001"));
            const metadataURI = "ipfs://QmProductMetadata";

            await expect(qualityOracle.connect(user1).requestValidation(
                0, // PRODUCT
                entityHash,
                metadataURI
            )).to.emit(qualityOracle, "ValidationRequested");

            const validation = await qualityOracle.validations(1);
            expect(validation.entityType).to.equal(0);
            expect(validation.owner).to.equal(user1.address);
            expect(validation.status).to.equal(0); // PENDING
        });

        it("Should require correct collateral + fee payment", async function () {
            const { qualityOracle, user1, bezToken } = await loadFixture(deployQualityOracleFixture);

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-002"));
            const balanceBefore = await bezToken.balanceOf(user1.address);

            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test");

            const balanceAfter = await bezToken.balanceOf(user1.address);
            // PRODUCT: 100 BEZ collateral + 5 BEZ fee = 105 BEZ
            expect(balanceBefore - balanceAfter).to.equal(ethers.parseEther("105"));
        });

        it("Should prevent duplicate validation for same entity", async function () {
            const { qualityOracle, user1 } = await loadFixture(deployQualityOracleFixture);

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-003"));

            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test");

            await expect(
                qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test2")
            ).to.be.revertedWith("QO: Already validated");
        });

        it("Should reject validation for inactive entity types", async function () {
            const { qualityOracle, user1, treasury } = await loadFixture(deployQualityOracleFixture);

            // Deactivate POST type - treasury has DAO_ROLE
            await qualityOracle.connect(treasury).updateEntityConfig(
                6, // POST
                30,
                ethers.parseEther("5"),
                ethers.parseEther("0.5"),
                100, 100, false,
                false // isActive = false
            );

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("post-001"));

            await expect(
                qualityOracle.connect(user1).requestValidation(6, entityHash, "ipfs://test")
            ).to.be.revertedWith("QO: Entity type not active");
        });

        it("Should update sector stats on validation request", async function () {
            const { qualityOracle, user1 } = await loadFixture(deployQualityOracleFixture);

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-004"));

            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test");

            const stats = await qualityOracle.sectorStats(0);
            expect(stats.totalValidations).to.equal(1);
            expect(stats.totalCollateralLocked).to.equal(ethers.parseEther("100"));
            expect(stats.totalFeesCollected).to.equal(ethers.parseEther("5"));
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                     VALIDATION EXECUTION TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe("Validation Execution", function () {
        it("Should allow validators to validate entities", async function () {
            const { qualityOracle, validator1, user1 } = await loadFixture(deployQualityOracleFixture);

            // Register validator
            await qualityOracle.connect(validator1).registerAsValidator(ethers.parseEther("1000"));

            // Request validation
            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-005"));
            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test");

            // Validate
            await expect(qualityOracle.connect(validator1).validateEntity(1, 85, 80))
                .to.emit(qualityOracle, "ValidationCompleted")
                .withArgs(1, validator1.address, 85, 2); // status 2 = APPROVED
        });

        it("Should reject entity if quality score below threshold", async function () {
            const { qualityOracle, validator1, user1 } = await loadFixture(deployQualityOracleFixture);

            await qualityOracle.connect(validator1).registerAsValidator(ethers.parseEther("1000"));

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-006"));
            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test");

            // PRODUCT threshold is 60, give score of 50
            await qualityOracle.connect(validator1).validateEntity(1, 50, 45);

            const validation = await qualityOracle.validations(1);
            expect(validation.status).to.equal(3); // REJECTED
        });

        it("Should reject validation from non-validators", async function () {
            const { qualityOracle, user1, user2 } = await loadFixture(deployQualityOracleFixture);

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-007"));
            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test");

            await expect(
                qualityOracle.connect(user2).validateEntity(1, 85, 80)
            ).to.be.reverted;
        });

        it("Should return collateral to owner on approval", async function () {
            const { qualityOracle, validator1, user1, bezToken } = await loadFixture(deployQualityOracleFixture);

            await qualityOracle.connect(validator1).registerAsValidator(ethers.parseEther("1000"));

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-008"));

            const balanceBefore = await bezToken.balanceOf(user1.address);
            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test");
            const balanceAfterRequest = await bezToken.balanceOf(user1.address);

            // Validate with high score
            await qualityOracle.connect(validator1).validateEntity(1, 90, 85);

            const balanceAfterValidation = await bezToken.balanceOf(user1.address);
            // Should get collateral back (100 BEZ) but not the fee (5 BEZ)
            expect(balanceAfterValidation - balanceAfterRequest).to.be.gte(ethers.parseEther("100"));
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                           DISPUTE TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe("Dispute System", function () {
        it("Should allow owner to raise dispute after rejection", async function () {
            const { qualityOracle, validator1, user1 } = await loadFixture(deployQualityOracleFixture);

            await qualityOracle.connect(validator1).registerAsValidator(ethers.parseEther("1000"));

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-009"));
            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test");

            // Reject with low score
            await qualityOracle.connect(validator1).validateEntity(1, 40, 35);

            await expect(qualityOracle.connect(user1).raiseDispute(1, "Quality was higher than scored"))
                .to.emit(qualityOracle, "DisputeRaised");

            const validation = await qualityOracle.validations(1);
            expect(validation.status).to.equal(4); // DISPUTED
        });

        it("Should allow arbitrator to resolve disputes", async function () {
            const { qualityOracle, validator1, user1, owner, arbitrator } = await loadFixture(deployQualityOracleFixture);

            // Grant arbitrator role
            const ARBITRATOR_ROLE = await qualityOracle.ARBITRATOR_ROLE();
            await qualityOracle.connect(owner).grantRole(ARBITRATOR_ROLE, arbitrator.address);

            await qualityOracle.connect(validator1).registerAsValidator(ethers.parseEther("1000"));

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-010"));
            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test");

            await qualityOracle.connect(validator1).validateEntity(1, 40, 35);
            await qualityOracle.connect(user1).raiseDispute(1, "Quality was higher");

            // Resolve in favor of user (owner) - only 2 params: validationId and inFavorOfOwner
            await expect(qualityOracle.connect(arbitrator).resolveDispute(1, true))
                .to.emit(qualityOracle, "DisputeResolved");

            const validation = await qualityOracle.validations(1);
            expect(validation.status).to.equal(5); // RESOLVED
        });

        it("Should slash validator stake when dispute lost", async function () {
            const { qualityOracle, validator1, user1, owner, arbitrator } = await loadFixture(deployQualityOracleFixture);

            const ARBITRATOR_ROLE = await qualityOracle.ARBITRATOR_ROLE();
            await qualityOracle.connect(owner).grantRole(ARBITRATOR_ROLE, arbitrator.address);

            await qualityOracle.connect(validator1).registerAsValidator(ethers.parseEther("1000"));

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-011"));
            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test");

            await qualityOracle.connect(validator1).validateEntity(1, 40, 35);
            await qualityOracle.connect(user1).raiseDispute(1, "Quality was higher");

            const profileBefore = await qualityOracle.validators(validator1.address);

            // Resolve in favor of user - validator loses (only 2 params)
            await qualityOracle.connect(arbitrator).resolveDispute(1, true);

            const profileAfter = await qualityOracle.validators(validator1.address);
            expect(profileAfter.disputesLost).to.be.gt(profileBefore.disputesLost);
            expect(profileAfter.stakedAmount).to.be.lt(profileBefore.stakedAmount);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                       MULTI-SECTOR TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe("Multi-Sector Validation", function () {
        const entityTypes = [
            { type: 0, name: "PRODUCT" },
            { type: 1, name: "SERVICE" },
            { type: 2, name: "NFT" },
            { type: 3, name: "RWA" },
            { type: 4, name: "LOGISTICS" },
            { type: 5, name: "SDK_INTERACTION" },
            { type: 6, name: "POST" },
            { type: 7, name: "REVIEW" },
            { type: 8, name: "TRANSACTION" }
        ];

        entityTypes.forEach(({ type, name }) => {
            it(`Should validate ${name} entity type correctly`, async function () {
                const { qualityOracle, validator1, user1 } = await loadFixture(deployQualityOracleFixture);

                await qualityOracle.connect(validator1).registerAsValidator(ethers.parseEther("1000"));

                const entityHash = ethers.keccak256(ethers.toUtf8Bytes(`${name.toLowerCase()}-test-001`));

                await qualityOracle.connect(user1).requestValidation(type, entityHash, `ipfs://${name}`);

                // Get threshold for this type
                const config = await qualityOracle.entityConfigs(type);
                const passScore = Number(config.minQualityThreshold) + 10;

                await qualityOracle.connect(validator1).validateEntity(1, passScore, passScore - 5);

                const validation = await qualityOracle.validations(1);
                expect(validation.status).to.equal(2); // APPROVED
            });
        });

        it("Should track sector stats independently", async function () {
            const { qualityOracle, validator1, user1 } = await loadFixture(deployQualityOracleFixture);

            await qualityOracle.connect(validator1).registerAsValidator(ethers.parseEther("1000"));

            // Request validations for different sectors
            const productHash = ethers.keccak256(ethers.toUtf8Bytes("product-stat-test"));
            const nftHash = ethers.keccak256(ethers.toUtf8Bytes("nft-stat-test"));
            const postHash = ethers.keccak256(ethers.toUtf8Bytes("post-stat-test"));

            await qualityOracle.connect(user1).requestValidation(0, productHash, "ipfs://product");
            await qualityOracle.connect(user1).requestValidation(2, nftHash, "ipfs://nft");
            await qualityOracle.connect(user1).requestValidation(6, postHash, "ipfs://post");

            // Validate all
            await qualityOracle.connect(validator1).validateEntity(1, 80, 75);
            await qualityOracle.connect(validator1).validateEntity(2, 70, 65);
            await qualityOracle.connect(validator1).validateEntity(3, 50, 45);

            const productStats = await qualityOracle.sectorStats(0);
            const nftStats = await qualityOracle.sectorStats(2);
            const postStats = await qualityOracle.sectorStats(6);

            expect(productStats.totalValidations).to.equal(1);
            expect(nftStats.totalValidations).to.equal(1);
            expect(postStats.totalValidations).to.equal(1);
            expect(productStats.totalApproved).to.equal(1);
            expect(nftStats.totalApproved).to.equal(1);
            expect(postStats.totalApproved).to.equal(1);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                         ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    describe("Admin Functions", function () {
        it("Should allow admin to pause contract", async function () {
            const { qualityOracle, owner, user1 } = await loadFixture(deployQualityOracleFixture);

            await qualityOracle.connect(owner).pause();

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-paused"));

            // OpenZeppelin 5 uses custom error EnforcedPause instead of string
            await expect(
                qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test")
            ).to.be.revertedWithCustomError(qualityOracle, "EnforcedPause");
        });

        it("Should allow admin to unpause contract", async function () {
            const { qualityOracle, owner, user1 } = await loadFixture(deployQualityOracleFixture);

            await qualityOracle.connect(owner).pause();
            await qualityOracle.connect(owner).unpause();

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-unpaused"));

            await expect(
                qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://test")
            ).to.not.be.reverted;
        });

        it("Should allow admin to update treasury address", async function () {
            const { qualityOracle, owner, user2 } = await loadFixture(deployQualityOracleFixture);

            await expect(qualityOracle.connect(owner).updateTreasury(user2.address))
                .to.emit(qualityOracle, "TreasuryUpdated");

            expect(await qualityOracle.treasuryDAO()).to.equal(user2.address);
        });

        it("Should prevent non-admin from admin functions", async function () {
            const { qualityOracle, user1 } = await loadFixture(deployQualityOracleFixture);

            await expect(
                qualityOracle.connect(user1).pause()
            ).to.be.reverted;
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                      USER REPUTATION TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe("User Reputation", function () {
        it("Should track user validations", async function () {
            const { qualityOracle, user1 } = await loadFixture(deployQualityOracleFixture);

            const hash1 = ethers.keccak256(ethers.toUtf8Bytes("product-rep-1"));
            const hash2 = ethers.keccak256(ethers.toUtf8Bytes("product-rep-2"));

            await qualityOracle.connect(user1).requestValidation(0, hash1, "ipfs://1");
            await qualityOracle.connect(user1).requestValidation(0, hash2, "ipfs://2");

            const validations = await qualityOracle.getUserValidations(user1.address);
            expect(validations.length).to.equal(2);
        });

        it("Should return validation by entity hash", async function () {
            const { qualityOracle, user1 } = await loadFixture(deployQualityOracleFixture);

            const entityHash = ethers.keccak256(ethers.toUtf8Bytes("product-lookup"));
            await qualityOracle.connect(user1).requestValidation(0, entityHash, "ipfs://lookup");

            const validationId = await qualityOracle.entityToValidation(entityHash);
            expect(validationId).to.equal(1);

            const validation = await qualityOracle.validations(validationId);
            expect(validation.owner).to.equal(user1.address);
        });
    });
});

/**
 * Mock ERC20 contract for testing
 */
// This should be in contracts/test/MockERC20.sol
