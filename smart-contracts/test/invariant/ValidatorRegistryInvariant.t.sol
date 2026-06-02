// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ValidatorRegistry} from "../../src/core/ValidatorRegistry.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";

// ─── Handler ─────────────────────────────────────────────────────
contract ValidatorRegistryHandler is Test {
    ValidatorRegistry public registry;
    BEZCoinV2 public bez;
    address public admin;
    address public oracle;

    // Ghost variables
    uint256 public ghost_totalRegistered;
    uint256 public ghost_totalStakeDeposited;
    uint256 public ghost_totalStakeWithdrawn;
    uint256 public ghost_totalSlashed;
    uint256 public ghost_heartbeatCount;
    uint256 public ghost_contributionPoints;

    address[] internal actors;
    address[] internal registeredActors;

    constructor(
        ValidatorRegistry _registry,
        BEZCoinV2 _bez,
        address _admin,
        address _oracle
    ) {
        registry = _registry;
        bez = _bez;
        admin = _admin;
        oracle = _oracle;

        // Create 8 actors with enough BEZ for Platinum tier
        for (uint256 i = 1; i <= 8; i++) {
            address actor = address(uint160(0x3000 + i));
            actors.push(actor);
            // Transfer BEZ from admin
            vm.prank(admin);
            bez.transfer(actor, 5_000_000 ether);
            // Approve registry
            vm.prank(actor);
            bez.approve(address(registry), type(uint256).max);
        }
    }

    function registerValidator(uint256 actorSeed, uint256 stakeAmount) external {
        address actor = actors[actorSeed % actors.length];
        if (registry.isRegistered(actor)) return;

        stakeAmount = bound(stakeAmount, 10_000 ether, 2_000_000 ether);

        vm.prank(actor);
        registry.registerValidator("Company", stakeAmount);

        ghost_totalRegistered++;
        ghost_totalStakeDeposited += stakeAmount;
        registeredActors.push(actor);
    }

    function addStake(uint256 actorSeed, uint256 amount) external {
        if (registeredActors.length == 0) return;
        address actor = registeredActors[actorSeed % registeredActors.length];
        
        (,,,,,,,,,,,, bool isActive,) = registry.validators(actor);
        if (!isActive) return;

        amount = bound(amount, 1 ether, 500_000 ether);

        vm.prank(actor);
        registry.addStake(amount);

        ghost_totalStakeDeposited += amount;
    }

    function heartbeat(uint256 actorSeed) external {
        if (registeredActors.length == 0) return;
        address actor = registeredActors[actorSeed % registeredActors.length];

        (,,,,,,,,,,,, bool isActive,) = registry.validators(actor);
        if (!isActive) return;

        vm.prank(actor);
        registry.heartbeat();
        ghost_heartbeatCount++;
    }

    function recordContribution(uint256 actorSeed, uint256 points) external {
        if (registeredActors.length == 0) return;
        address actor = registeredActors[actorSeed % registeredActors.length];

        (,,,,,,,,,,,, bool isActive,) = registry.validators(actor);
        if (!isActive) return;

        points = bound(points, 1, 1000);

        vm.prank(oracle);
        registry.recordContribution(actor, points, "data-validation");
        ghost_contributionPoints += points;
    }

    function initiateUnbonding(uint256 actorSeed, uint256 amount) external {
        if (registeredActors.length == 0) return;
        address actor = registeredActors[actorSeed % registeredActors.length];

        (,, uint256 stakedAmount,,,,,,,, uint256 unbondingAmount,,,) = registry.validators(actor);
        if (stakedAmount == 0) return;
        // Skip if already unbonding
        (,,,,,,,, uint256 unbondingStart,,,,,) = registry.validators(actor);
        if (unbondingStart > 0) return;

        amount = bound(amount, 1 ether, stakedAmount);

        vm.prank(actor);
        registry.initiateUnbonding(amount);
    }

    function completeWithdraw(uint256 actorSeed) external {
        if (registeredActors.length == 0) return;
        address actor = registeredActors[actorSeed % registeredActors.length];

        (,,,,,,,,, uint256 unbondingStart, uint256 unbondingAmount,,,) = registry.validators(actor);
        if (unbondingStart == 0) return;
        if (block.timestamp < unbondingStart + 7 days) {
            vm.warp(unbondingStart + 7 days + 1);
        }

        vm.prank(actor);
        registry.completeWithdraw();

        ghost_totalStakeWithdrawn += unbondingAmount;
    }

    function getRegisteredCount() external view returns (uint256) {
        return registeredActors.length;
    }
}

// ─── Invariant Test Suite ────────────────────────────────────────
contract ValidatorRegistryInvariantTest is Test {
    ValidatorRegistry public registry;
    BEZCoinV2 public bez;
    ValidatorRegistryHandler public handler;

    address admin = address(this);
    address oracle = address(0xABC);

    function setUp() public {
        bez = new BEZCoinV2(admin);
        registry = new ValidatorRegistry(address(bez), admin);
        registry.grantRole(registry.ORACLE_ROLE(), oracle);

        handler = new ValidatorRegistryHandler(registry, bez, admin, oracle);
        targetContract(address(handler));
    }

    /// @dev Registry totalStaked == sum of all validator stakedAmounts
    function invariant_totalStakedIsConsistent() public view {
        uint256 count = registry.getValidatorCount();
        uint256 sumStaked = 0;
        for (uint256 i = 0; i < count; i++) {
            address v = registry.validatorList(i);
            (,, uint256 stakedAmount,,,,,,,,,,,) = registry.validators(v);
            sumStaked += stakedAmount;
        }
        assertEq(registry.totalStaked(), sumStaked, "totalStaked mismatch with sum");
    }

    /// @dev Registry BEZ balance >= totalStaked (solvency)
    function invariant_registrySolvency() public view {
        assertGe(
            bez.balanceOf(address(registry)),
            registry.totalStaked(),
            "Registry is insolvent"
        );
    }

    /// @dev activeValidatorCount matches actual count of active validators
    function invariant_activeCountMatches() public view {
        uint256 count = registry.getValidatorCount();
        uint256 activeCount = 0;
        for (uint256 i = 0; i < count; i++) {
            address v = registry.validatorList(i);
            (,,,,,,,,,,,, bool isActive,) = registry.validators(v);
            if (isActive) activeCount++;
        }
        assertEq(registry.activeValidatorCount(), activeCount, "Active count mismatch");
    }

    /// @dev Tier always matches staked amount
    function invariant_tierMatchesStake() public view {
        uint256 count = registry.getValidatorCount();
        for (uint256 i = 0; i < count; i++) {
            address v = registry.validatorList(i);
            (,, uint256 stakedAmount,,,,,,,,, uint8 tier, bool isActive,) = registry.validators(v);
            if (!isActive && tier == 0) continue; // deactivated is OK at tier 0

            uint8 expectedTier;
            if (stakedAmount >= 1_000_000 ether) expectedTier = 4;
            else if (stakedAmount >= 250_000 ether) expectedTier = 3;
            else if (stakedAmount >= 50_000 ether) expectedTier = 2;
            else if (stakedAmount >= 10_000 ether) expectedTier = 1;
            else expectedTier = 0;

            assertEq(tier, expectedTier, "Tier mismatch for validator");
        }
    }

    /// @dev Sequencer eligibility: only tier >= 3 and active
    function invariant_sequencerEligibility() public view {
        uint256 count = registry.getValidatorCount();
        for (uint256 i = 0; i < count; i++) {
            address v = registry.validatorList(i);
            (,,,,,,,,,,, uint8 tier, bool isActive, bool isSequencerEligible) = registry.validators(v);
            if (isSequencerEligible) {
                assertTrue(tier >= 3, "Sequencer eligible below Gold");
            }
        }
    }

    /// @dev Total deposits - withdrawals - slashed >= totalStaked
    function invariant_accountingConsistency() public view {
        uint256 deposited = handler.ghost_totalStakeDeposited();
        uint256 withdrawn = handler.ghost_totalStakeWithdrawn();
        uint256 slashed = handler.ghost_totalSlashed();
        uint256 expected = deposited - withdrawn - slashed;

        assertEq(registry.totalStaked(), expected, "Accounting mismatch");
    }

    function invariant_callSummary() public view {
        console.log("Registered:    ", handler.ghost_totalRegistered());
        console.log("Deposited:     ", handler.ghost_totalStakeDeposited());
        console.log("Withdrawn:     ", handler.ghost_totalStakeWithdrawn());
        console.log("Heartbeats:    ", handler.ghost_heartbeatCount());
        console.log("Contributions: ", handler.ghost_contributionPoints());
    }
}

// ─── Fuzz Tests ──────────────────────────────────────────────────
contract ValidatorRegistryFuzzTest is Test {
    ValidatorRegistry public registry;
    BEZCoinV2 public bez;

    address admin = address(this);
    address oracle = address(0xABC);
    address user = address(0xBEEF);

    function setUp() public {
        bez = new BEZCoinV2(admin);
        registry = new ValidatorRegistry(address(bez), admin);
        registry.grantRole(registry.ORACLE_ROLE(), oracle);

        bez.transfer(user, 10_000_000 ether);
        vm.prank(user);
        bez.approve(address(registry), type(uint256).max);
    }

    /// @dev Registration with valid stake always succeeds and assigns correct tier
    function testFuzz_registerAssignsCorrectTier(uint256 stakeAmount) public {
        stakeAmount = bound(stakeAmount, 10_000 ether, 5_000_000 ether);

        vm.prank(user);
        registry.registerValidator("TestCo", stakeAmount);

        uint8 tier = registry.getValidatorTier(user);
        uint8 expectedTier;
        if (stakeAmount >= 1_000_000 ether) expectedTier = 4;
        else if (stakeAmount >= 250_000 ether) expectedTier = 3;
        else if (stakeAmount >= 50_000 ether) expectedTier = 2;
        else expectedTier = 1;

        assertEq(tier, expectedTier);
        assertTrue(registry.isActiveValidator(user));
        assertEq(registry.getStakedAmount(user), stakeAmount);
    }

    /// @dev Stake below Bronze minimum always reverts
    function testFuzz_belowBronzeReverts(uint256 stakeAmount) public {
        stakeAmount = bound(stakeAmount, 0, 10_000 ether - 1);

        vm.prank(user);
        vm.expectRevert(bytes("VR: stake below Bronze minimum"));
        registry.registerValidator("TestCo", stakeAmount);
    }

    /// @dev Adding stake upgrades tier correctly
    function testFuzz_addStakeUpgradesTier(uint256 initial, uint256 addAmount) public {
        initial = bound(initial, 10_000 ether, 200_000 ether);
        addAmount = bound(addAmount, 1 ether, 2_000_000 ether);

        vm.prank(user);
        registry.registerValidator("TestCo", initial);
        uint8 tierBefore = registry.getValidatorTier(user);

        vm.prank(user);
        registry.addStake(addAmount);

        uint8 tierAfter = registry.getValidatorTier(user);
        assertGe(tierAfter, tierBefore, "Tier should not decrease after adding stake");
        assertEq(registry.getStakedAmount(user), initial + addAmount);
    }

    /// @dev Double registration always reverts
    function testFuzz_doubleRegisterReverts(uint256 stake1, uint256 stake2) public {
        stake1 = bound(stake1, 10_000 ether, 100_000 ether);
        stake2 = bound(stake2, 10_000 ether, 100_000 ether);

        vm.prank(user);
        registry.registerValidator("TestCo", stake1);

        vm.prank(user);
        vm.expectRevert(bytes("VR: already registered"));
        registry.registerValidator("TestCo2", stake2);
    }

    /// @dev Heartbeat updates lastHeartbeat
    function testFuzz_heartbeatUpdatesTimestamp(uint256 warpAmount) public {
        warpAmount = bound(warpAmount, 1, 365 days);

        vm.prank(user);
        registry.registerValidator("TestCo", 50_000 ether);

        vm.warp(block.timestamp + warpAmount);

        vm.prank(user);
        registry.heartbeat();

        (,,,,, uint256 lastHeartbeat,,,,,,,,) = registry.validators(user);
        assertEq(lastHeartbeat, block.timestamp);
    }

    /// @dev Unbonding + withdraw returns exact amount
    function testFuzz_unbondingAndWithdraw(uint256 stakeAmount, uint256 unbondAmount) public {
        stakeAmount = bound(stakeAmount, 50_000 ether, 2_000_000 ether);
        unbondAmount = bound(unbondAmount, 1 ether, stakeAmount);

        vm.prank(user);
        registry.registerValidator("TestCo", stakeAmount);

        uint256 balBefore = bez.balanceOf(user);

        vm.prank(user);
        registry.initiateUnbonding(unbondAmount);

        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(user);
        registry.completeWithdraw();

        assertEq(bez.balanceOf(user), balBefore + unbondAmount);
        assertEq(registry.getStakedAmount(user), stakeAmount - unbondAmount);
    }

    /// @dev Only oracle can record contributions
    function testFuzz_onlyOracleRecordsContributions(address attacker) public {
        vm.assume(attacker != oracle);
        vm.assume(attacker != admin);

        vm.prank(user);
        registry.registerValidator("TestCo", 50_000 ether);

        vm.prank(attacker);
        vm.expectRevert();
        registry.recordContribution(user, 100, "test");
    }
}
