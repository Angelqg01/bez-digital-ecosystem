/**
 * ============================================================================
 * SECURITY TESTS: BezhasToken Smart Contract
 * ============================================================================
 * 
 * Validates security properties of the BezhasToken contract:
 * - Reentrancy protection
 * - Role-based access control (RBAC)
 * - Allowance handling and frontrunning prevention
 * - Treasury and deflation mechanism security
 * 
 * @version 1.0.0
 * @date 2026-02-09
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("BezhasToken Security Tests", function () {
    // ========================================================================
    // FIXTURES
    // ========================================================================

    async function deployBezhasTokenFixture() {
        const [owner, minter, burner, pauser, treasury, attacker, user1, user2] = await ethers.getSigners();

        // Deploy BezhasToken
        //
        // El constructor es `BezhasToken(uint256 initialSupply)`. Aquí se le
        // pasaba `owner.address`: ethers convierte esa cadena hexadecimal a
        // entero, así que no fallaba — acuñaba ~1,4·10^48 tokens al
        // desplegante. No reventaba, pero dejaba el fixture con un suministro
        // absurdo. Se despliega sin suministro inicial y los tokens de prueba
        // se acuñan abajo, explícitamente.
        const BezhasToken = await ethers.getContractFactory("BezhasToken");
        const bezToken = await BezhasToken.deploy(0);

        // Get role identifiers
        const MINTER_ROLE = await bezToken.MINTER_ROLE();
        const BURNER_ROLE = await bezToken.BURNER_ROLE();
        const PAUSER_ROLE = await bezToken.PAUSER_ROLE();
        const DEFAULT_ADMIN_ROLE = await bezToken.DEFAULT_ADMIN_ROLE();
        const TREASURY_ROLE = await bezToken.TREASURY_ROLE();

        // Grant roles
        await bezToken.grantRole(MINTER_ROLE, minter.address);
        await bezToken.grantRole(BURNER_ROLE, burner.address);
        await bezToken.grantRole(PAUSER_ROLE, pauser.address);

        // Mint initial tokens
        const initialSupply = ethers.parseUnits("1000000", 18);
        await bezToken.connect(minter).mint(user1.address, initialSupply);

        return {
            bezToken,
            owner,
            minter,
            burner,
            pauser,
            treasury,
            attacker,
            user1,
            user2,
            MINTER_ROLE,
            BURNER_ROLE,
            PAUSER_ROLE,
            DEFAULT_ADMIN_ROLE,
            TREASURY_ROLE,
            initialSupply
        };
    }

    // ========================================================================
    // ROLE-BASED ACCESS CONTROL (RBAC)
    // ========================================================================
    describe("Role-Based Access Control", function () {

        describe("MINTER_ROLE", function () {
            it("should allow MINTER_ROLE to mint tokens", async function () {
                const { bezToken, minter, user2 } = await loadFixture(deployBezhasTokenFixture);
                const amount = ethers.parseUnits("1000", 18);

                await expect(bezToken.connect(minter).mint(user2.address, amount))
                    .to.emit(bezToken, "Transfer")
                    .withArgs(ethers.ZeroAddress, user2.address, amount);

                expect(await bezToken.balanceOf(user2.address)).to.equal(amount);
            });

            it("should reject mint from non-MINTER_ROLE", async function () {
                const { bezToken, attacker, user2, MINTER_ROLE } = await loadFixture(deployBezhasTokenFixture);
                const amount = ethers.parseUnits("1000", 18);

                await expect(bezToken.connect(attacker).mint(user2.address, amount))
                    .to.be.revertedWithCustomError(bezToken, "AccessControlUnauthorizedAccount")
                    .withArgs(attacker.address, MINTER_ROLE);
            });

            it("should reject mint when paused", async function () {
                const { bezToken, minter, pauser, user2 } = await loadFixture(deployBezhasTokenFixture);

                await bezToken.connect(pauser).pause();

                const amount = ethers.parseUnits("1000", 18);
                await expect(bezToken.connect(minter).mint(user2.address, amount))
                    .to.be.revertedWithCustomError(bezToken, "EnforcedPause");
            });
        });

        describe("BURNER_ROLE", function () {
            it("should allow BURNER_ROLE to process deflation", async function () {
                const { bezToken, burner, user1 } = await loadFixture(deployBezhasTokenFixture);
                const burnAmount = ethers.parseUnits("1000", 18);

                // User1 transfers to burner for processing
                await bezToken.connect(user1).transfer(burner.address, burnAmount);

                // Burner processes deflation
                await expect(bezToken.connect(burner).processDeflation(burnAmount))
                    .to.emit(bezToken, "DeflationProcessed");
            });

            it("should reject processDeflation from non-BURNER_ROLE", async function () {
                const { bezToken, attacker, BURNER_ROLE } = await loadFixture(deployBezhasTokenFixture);
                const amount = ethers.parseUnits("1000", 18);

                await expect(bezToken.connect(attacker).processDeflation(amount))
                    .to.be.revertedWithCustomError(bezToken, "AccessControlUnauthorizedAccount")
                    .withArgs(attacker.address, BURNER_ROLE);
            });
        });

        describe("PAUSER_ROLE", function () {
            it("should allow PAUSER_ROLE to pause contract", async function () {
                const { bezToken, pauser } = await loadFixture(deployBezhasTokenFixture);

                await expect(bezToken.connect(pauser).pause())
                    .to.emit(bezToken, "Paused")
                    .withArgs(pauser.address);

                expect(await bezToken.paused()).to.be.true;
            });

            it("should reject pause from non-PAUSER_ROLE", async function () {
                const { bezToken, attacker, PAUSER_ROLE } = await loadFixture(deployBezhasTokenFixture);

                await expect(bezToken.connect(attacker).pause())
                    .to.be.revertedWithCustomError(bezToken, "AccessControlUnauthorizedAccount")
                    .withArgs(attacker.address, PAUSER_ROLE);
            });

            it("should block transfers when paused", async function () {
                const { bezToken, pauser, user1, user2 } = await loadFixture(deployBezhasTokenFixture);

                await bezToken.connect(pauser).pause();

                const amount = ethers.parseUnits("100", 18);
                await expect(bezToken.connect(user1).transfer(user2.address, amount))
                    .to.be.revertedWithCustomError(bezToken, "EnforcedPause");
            });
        });

        // La tesorería y el reparto de premios de LP no los gobierna
        // DEFAULT_ADMIN_ROLE sino un TREASURY_ROLE dedicado. La prueba esperaba
        // el rol de administración, que es una separación de poderes más floja
        // que la que el contrato implementa de verdad.
        describe("TREASURY_ROLE", function () {
            it("should allow admin to update treasury address", async function () {
                const { bezToken, owner, treasury } = await loadFixture(deployBezhasTokenFixture);

                await bezToken.connect(owner).setTreasuryDAO(treasury.address);

                expect(await bezToken.treasuryDAO()).to.equal(treasury.address);
            });

            it("should reject treasury update from an account without TREASURY_ROLE", async function () {
                const { bezToken, attacker, treasury, TREASURY_ROLE } = await loadFixture(deployBezhasTokenFixture);

                await expect(bezToken.connect(attacker).setTreasuryDAO(treasury.address))
                    .to.be.revertedWithCustomError(bezToken, "AccessControlUnauthorizedAccount")
                    .withArgs(attacker.address, TREASURY_ROLE);
            });

            it("should reject setting treasury to zero address", async function () {
                const { bezToken, owner } = await loadFixture(deployBezhasTokenFixture);

                await expect(bezToken.connect(owner).setTreasuryDAO(ethers.ZeroAddress))
                    .to.be.revertedWith("BEZ: Invalid address");
            });
        });
    });

    // ========================================================================
    // ALLOWANCE HANDLING
    // ========================================================================
    describe("Allowance Handling", function () {

        describe("Standard Approve/TransferFrom", function () {
            it("should require explicit approve before transferFrom", async function () {
                const { bezToken, user1, user2, attacker } = await loadFixture(deployBezhasTokenFixture);
                const amount = ethers.parseUnits("1000", 18);

                // Attacker tries transferFrom without approval
                await expect(bezToken.connect(attacker).transferFrom(user1.address, attacker.address, amount))
                    .to.be.revertedWithCustomError(bezToken, "ERC20InsufficientAllowance");
            });

            it("should allow transferFrom with proper approval", async function () {
                const { bezToken, user1, user2 } = await loadFixture(deployBezhasTokenFixture);
                const amount = ethers.parseUnits("1000", 18);

                await bezToken.connect(user1).approve(user2.address, amount);

                await expect(bezToken.connect(user2).transferFrom(user1.address, user2.address, amount))
                    .to.emit(bezToken, "Transfer")
                    .withArgs(user1.address, user2.address, amount);
            });

            it("should decrease allowance after transferFrom", async function () {
                const { bezToken, user1, user2 } = await loadFixture(deployBezhasTokenFixture);
                const approveAmount = ethers.parseUnits("1000", 18);
                const transferAmount = ethers.parseUnits("400", 18);

                await bezToken.connect(user1).approve(user2.address, approveAmount);
                await bezToken.connect(user2).transferFrom(user1.address, user2.address, transferAmount);

                const remainingAllowance = await bezToken.allowance(user1.address, user2.address);
                expect(remainingAllowance).to.equal(approveAmount - transferAmount);
            });
        });

        // ────────────────────────────────────────────────────────────────────
        // La carrera del `approve` (frontrunning de asignaciones)
        // ────────────────────────────────────────────────────────────────────
        //
        // `approve` sobrescribe la asignación anterior en vez de sumarla. Si el
        // titular tiene aprobados N y firma un `approve(M)`, el gastador puede
        // ver esa transacción en el mempool, gastar los N antes de que entre y
        // gastar los M después: N+M cuando solo se quiso autorizar M.
        //
        // OpenZeppelin ofrecía `increaseAllowance`/`decreaseAllowance` para
        // esquivarlo y las eliminó en la v5.0; al heredar de OZ 5.6.1, este
        // token se quedó sin mitigación en cadena. `src/BezhasToken.sol` las
        // recupera, y aquí se comprueba que cierran la carrera de verdad.
        //
        // OJO: esto protege a los despliegues futuros. El BEZ ya desplegado
        // (0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8) no es actualizable
        // —`BezhasToken is ERC20Pausable, AccessControl`, sin proxy—, así que
        // sigue sin tenerlas. Contra ese contrato la mitigación es de
        // convención: poner la asignación a cero antes de fijar la nueva, que
        // es lo que hace `safeApprove` en el código de la aplicación.
        describe("Allowance race (`approve` frontrunning)", function () {
            it("exposes increaseAllowance/decreaseAllowance again", async function () {
                const { bezToken } = await loadFixture(deployBezhasTokenFixture);

                // OpenZeppelin las quitó en la v5.0 y el token se quedó sin
                // mitigación en cadena. Se recuperan en BezhasToken.sol.
                expect(bezToken.increaseAllowance).to.be.a("function");
                expect(bezToken.decreaseAllowance).to.be.a("function");
            });

            it("increaseAllowance adds to the current allowance", async function () {
                const { bezToken, user1, user2 } = await loadFixture(deployBezhasTokenFixture);
                const inicial = ethers.parseUnits("100", 18);
                const incremento = ethers.parseUnits("50", 18);

                await bezToken.connect(user1).approve(user2.address, inicial);
                await bezToken.connect(user1).increaseAllowance(user2.address, incremento);

                expect(await bezToken.allowance(user1.address, user2.address))
                    .to.equal(inicial + incremento);
            });

            it("increaseAllowance works from zero and emits Approval", async function () {
                const { bezToken, user1, user2 } = await loadFixture(deployBezhasTokenFixture);
                const cantidad = ethers.parseUnits("25", 18);

                await expect(bezToken.connect(user1).increaseAllowance(user2.address, cantidad))
                    .to.emit(bezToken, "Approval")
                    .withArgs(user1.address, user2.address, cantidad);
            });

            it("decreaseAllowance subtracts from the current allowance", async function () {
                const { bezToken, user1, user2 } = await loadFixture(deployBezhasTokenFixture);
                const inicial = ethers.parseUnits("100", 18);
                const recorte = ethers.parseUnits("40", 18);

                await bezToken.connect(user1).approve(user2.address, inicial);
                await bezToken.connect(user1).decreaseAllowance(user2.address, recorte);

                expect(await bezToken.allowance(user1.address, user2.address))
                    .to.equal(inicial - recorte);
            });

            it("decreaseAllowance reverts instead of silently flooring at zero", async function () {
                const { bezToken, user1, user2 } = await loadFixture(deployBezhasTokenFixture);
                const inicial = ethers.parseUnits("100", 18);
                const exceso = ethers.parseUnits("150", 18);

                await bezToken.connect(user1).approve(user2.address, inicial);

                // Bajar de más casi siempre significa que quien llama tenía una
                // idea equivocada del estado; dejarlo en cero en silencio lo
                // escondería.
                await expect(bezToken.connect(user1).decreaseAllowance(user2.address, exceso))
                    .to.be.revertedWithCustomError(bezToken, "BezInsufficientAllowanceToDecrease")
                    .withArgs(user2.address, inicial, exceso);
            });

            it("closes the race: the spender cannot get old + new", async function () {
                const { bezToken, user1, user2 } = await loadFixture(deployBezhasTokenFixture);
                const viejaAsignacion = ethers.parseUnits("100", 18);
                const incremento = ethers.parseUnits("50", 18);

                // El titular aprueba 100 y el gastador se los lleva enteros
                // —ésa es la transacción que en la carrera real se adelanta—.
                await bezToken.connect(user1).approve(user2.address, viejaAsignacion);
                await bezToken.connect(user2).transferFrom(user1.address, user2.address, viejaAsignacion);
                expect(await bezToken.allowance(user1.address, user2.address)).to.equal(0);

                // Con `approve(50)` el gastador acabaría pudiendo gastar 150 en
                // total. Con `increaseAllowance(50)` parte de lo que queda de
                // verdad —cero—, así que solo quedan 50 autorizados.
                await bezToken.connect(user1).increaseAllowance(user2.address, incremento);
                expect(await bezToken.allowance(user1.address, user2.address)).to.equal(incremento);
            });

            it("approve overwrites the previous allowance instead of adding to it", async function () {
                const { bezToken, user1, user2 } = await loadFixture(deployBezhasTokenFixture);
                const primera = ethers.parseUnits("100", 18);
                const segunda = ethers.parseUnits("50", 18);

                await bezToken.connect(user1).approve(user2.address, primera);
                await bezToken.connect(user1).approve(user2.address, segunda);

                // Sobrescribe: 50, no 150. Ésta es justamente la semántica que
                // abre la carrera.
                expect(await bezToken.allowance(user1.address, user2.address)).to.equal(segunda);
            });

            it("still supports the zero-first pattern, for callers that rely on it", async function () {
                const { bezToken, user1, user2 } = await loadFixture(deployBezhasTokenFixture);
                const inicial = ethers.parseUnits("100", 18);
                const nueva = ethers.parseUnits("40", 18);

                await bezToken.connect(user1).approve(user2.address, inicial);

                await bezToken.connect(user1).approve(user2.address, 0);
                expect(await bezToken.allowance(user1.address, user2.address)).to.equal(0);

                await bezToken.connect(user1).approve(user2.address, nueva);
                expect(await bezToken.allowance(user1.address, user2.address)).to.equal(nueva);
            });

            it("rejects approving the zero address as spender", async function () {
                const { bezToken, user1 } = await loadFixture(deployBezhasTokenFixture);

                await expect(bezToken.connect(user1).approve(ethers.ZeroAddress, 1))
                    .to.be.revertedWithCustomError(bezToken, "ERC20InvalidSpender");
            });
        });
    });

    // ========================================================================
    // DEFLATION MECHANISM SECURITY
    // ========================================================================
    describe("Deflation Mechanism Security", function () {

        it("should split deflation correctly to treasury and LP pool", async function () {
            const { bezToken, burner, user1, owner } = await loadFixture(deployBezhasTokenFixture);

            // Set up treasury
            const [, , , , treasuryAccount] = await ethers.getSigners();
            await bezToken.connect(owner).setTreasuryDAO(treasuryAccount.address);

            const deflationAmount = ethers.parseUnits("10000", 18);

            // Transfer tokens to burner
            await bezToken.connect(user1).transfer(burner.address, deflationAmount);

            const treasuryBalanceBefore = await bezToken.balanceOf(treasuryAccount.address);
            const lpPoolBefore = await bezToken.lpRewardsPool();

            // Process deflation
            await bezToken.connect(burner).processDeflation(deflationAmount);

            const treasuryBalanceAfter = await bezToken.balanceOf(treasuryAccount.address);
            const lpPoolAfter = await bezToken.lpRewardsPool();

            // Verify treasury received its share
            expect(treasuryBalanceAfter).to.be.gt(treasuryBalanceBefore);

            // Verify LP pool received its share
            expect(lpPoolAfter).to.be.gt(lpPoolBefore);
        });

        it("should reject processDeflation with zero amount", async function () {
            const { bezToken, burner } = await loadFixture(deployBezhasTokenFixture);

            await expect(bezToken.connect(burner).processDeflation(0))
                .to.be.revertedWith("BEZ: Amount must be > 0");
        });

        it("should reject processDeflation with insufficient balance", async function () {
            const { bezToken, burner } = await loadFixture(deployBezhasTokenFixture);
            const excessiveAmount = ethers.parseUnits("999999999999", 18);

            await expect(bezToken.connect(burner).processDeflation(excessiveAmount))
                .to.be.revertedWith("BEZ: Insufficient balance");
        });
    });

    // ========================================================================
    // LP REWARDS DISTRIBUTION SECURITY
    // ========================================================================
    describe("LP Rewards Distribution Security", function () {

        it("should only allow TREASURY_ROLE to distribute LP rewards", async function () {
            const { bezToken, attacker, TREASURY_ROLE } = await loadFixture(deployBezhasTokenFixture);
            const lpAddress = ethers.Wallet.createRandom().address;

            await expect(bezToken.connect(attacker).distributeLPRewards(lpAddress, ethers.parseUnits("100", 18)))
                .to.be.revertedWithCustomError(bezToken, "AccessControlUnauthorizedAccount")
                .withArgs(attacker.address, TREASURY_ROLE);
        });

        it("should reject distribution exceeding LP pool balance", async function () {
            const { bezToken, owner } = await loadFixture(deployBezhasTokenFixture);
            const lpAddress = ethers.Wallet.createRandom().address;
            const excessiveAmount = ethers.parseUnits("999999999999", 18);

            await expect(bezToken.connect(owner).distributeLPRewards(lpAddress, excessiveAmount))
                .to.be.revertedWith("BEZ: Insufficient LP rewards pool");
        });
    });

    // ========================================================================
    // OVERFLOW/UNDERFLOW PROTECTION
    // ========================================================================
    describe("Overflow/Underflow Protection", function () {

        it("should handle large token amounts without overflow", async function () {
            const { bezToken, minter, user1 } = await loadFixture(deployBezhasTokenFixture);

            // Max reasonable supply (1 trillion tokens)
            const largeAmount = ethers.parseUnits("1000000000000", 18);

            await bezToken.connect(minter).mint(user1.address, largeAmount);

            const balance = await bezToken.balanceOf(user1.address);
            expect(balance).to.be.gte(largeAmount);
        });

        it("should revert on transfer exceeding balance", async function () {
            const { bezToken, user1, user2, initialSupply } = await loadFixture(deployBezhasTokenFixture);
            const excessAmount = initialSupply + ethers.parseUnits("1", 18);

            await expect(bezToken.connect(user1).transfer(user2.address, excessAmount))
                .to.be.revertedWithCustomError(bezToken, "ERC20InsufficientBalance");
        });
    });

    // ========================================================================
    // ZERO ADDRESS PROTECTION
    // ========================================================================
    describe("Zero Address Protection", function () {

        it("should reject transfer to zero address", async function () {
            const { bezToken, user1 } = await loadFixture(deployBezhasTokenFixture);
            const amount = ethers.parseUnits("100", 18);

            await expect(bezToken.connect(user1).transfer(ethers.ZeroAddress, amount))
                .to.be.revertedWithCustomError(bezToken, "ERC20InvalidReceiver");
        });

        it("should reject mint to zero address", async function () {
            const { bezToken, minter } = await loadFixture(deployBezhasTokenFixture);
            const amount = ethers.parseUnits("100", 18);

            await expect(bezToken.connect(minter).mint(ethers.ZeroAddress, amount))
                .to.be.revertedWithCustomError(bezToken, "ERC20InvalidReceiver");
        });

        it("should reject approve to zero address", async function () {
            const { bezToken, user1 } = await loadFixture(deployBezhasTokenFixture);
            const amount = ethers.parseUnits("100", 18);

            await expect(bezToken.connect(user1).approve(ethers.ZeroAddress, amount))
                .to.be.revertedWithCustomError(bezToken, "ERC20InvalidSpender");
        });
    });
});
