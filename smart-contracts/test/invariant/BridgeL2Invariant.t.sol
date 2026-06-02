// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BeZhasBridgeL2} from "../../src/core/BeZhasBridgeL2.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";

// ─── Handler ─────────────────────────────────────────────────────
contract BridgeL2Handler is Test {
    BeZhasBridgeL2 public bridge;
    BEZCoinV2 public bez;
    address public admin;
    address public relayer;

    // Ghost variables
    uint256 public ghost_totalMinted;
    uint256 public ghost_totalBurned;
    uint256 public ghost_depositCount;
    uint256 public ghost_withdrawCount;

    address[] internal users;

    constructor(
        BeZhasBridgeL2 _bridge,
        BEZCoinV2 _bez,
        address _admin,
        address _relayer
    ) {
        bridge = _bridge;
        bez = _bez;
        admin = _admin;
        relayer = _relayer;

        for (uint256 i = 1; i <= 10; i++) {
            users.push(address(uint160(0x2000 + i)));
        }
    }

    function finalizeDeposit(uint256 userSeed, uint256 amount) external {
        address user = users[userSeed % users.length];
        amount = bound(amount, 1, 10_000_000 ether);

        vm.prank(relayer);
        bridge.finalizeDeposit(user, amount, keccak256(abi.encodePacked("tx", ghost_depositCount)));

        ghost_totalMinted += amount;
        ghost_depositCount++;
    }

    function initiateWithdrawal(uint256 userSeed, uint256 amount) external {
        address user = users[userSeed % users.length];
        uint256 balance = bez.balanceOf(user);
        if (balance == 0) return;

        amount = bound(amount, 1, balance);

        vm.prank(user);
        bez.approve(address(bridge), amount);
        vm.prank(user);
        bridge.initiateWithdrawal(address(0xDEAD), amount);

        ghost_totalBurned += amount;
        ghost_withdrawCount++;
    }
}

// ─── Invariant Test Suite ────────────────────────────────────────
contract BridgeL2InvariantTest is Test {
    BeZhasBridgeL2 public bridge;
    BEZCoinV2 public bez;
    BridgeL2Handler public handler;

    address admin = address(this);
    address relayer = address(0xCAFE);

    function setUp() public {
        bez = new BEZCoinV2(admin);
        bridge = new BeZhasBridgeL2(address(bez), admin);

        // Grant roles
        bez.grantRole(bez.MINTER_ROLE(), address(bridge));
        bez.grantRole(bez.BRIDGE_ROLE(), address(bridge));
        bridge.grantRole(bridge.BRIDGE_RELAYER_ROLE(), relayer);

        handler = new BridgeL2Handler(bridge, bez, admin, relayer);
        targetContract(address(handler));
    }

    /// @dev totalSupply == premint + bridge mints. NOTE: BEZCoinV2.bridgeBurn does NOT
    ///      reduce totalSupply (it transfers "burned" tokens to the treasury wallet), so
    ///      withdrawals do not subtract from supply — only deposits (mints) grow it.
    function invariant_mintBurnConsistency() public view {
        uint256 initialSupply = 3_000_000_000 * 1e18; // BEZCoinV2 constructor premint
        uint256 expected = initialSupply + handler.ghost_totalMinted();
        assertEq(bez.totalSupply(), expected, "Supply mismatch after bridge ops");
    }

    /// @dev Burns never exceed the supply available to the bridge (solvency upper bound)
    function invariant_burnsNeverExceedMints() public view {
        assertLe(
            handler.ghost_totalBurned(),
            handler.ghost_totalMinted() + 3_000_000_000 * 1e18, // premint included
            "Burns exceed available supply"
        );
    }

    function invariant_callSummary() public view {
        console.log("Deposits:   ", handler.ghost_depositCount());
        console.log("Withdrawals:", handler.ghost_withdrawCount());
        console.log("Minted:     ", handler.ghost_totalMinted());
        console.log("Burned:     ", handler.ghost_totalBurned());
    }
}

// ─── Fuzz Tests ──────────────────────────────────────────────────
contract BridgeL2FuzzTest is Test {
    BeZhasBridgeL2 public bridge;
    BEZCoinV2 public bez;

    address admin = address(this);
    address relayer = address(0xCAFE);
    address user = address(0xBEEF);

    function setUp() public {
        bez = new BEZCoinV2(admin);
        bridge = new BeZhasBridgeL2(address(bez), admin);

        bez.grantRole(bez.MINTER_ROLE(), address(bridge));
        bez.grantRole(bez.BRIDGE_ROLE(), address(bridge));
        bridge.grantRole(bridge.BRIDGE_RELAYER_ROLE(), relayer);
    }

    /// @dev Deposit mints exact amount to recipient
    function testFuzz_depositMintsExact(uint256 amount) public {
        amount = bound(amount, 1, 10_000_000 ether);
        uint256 balBefore = bez.balanceOf(user);

        vm.prank(relayer);
        bridge.finalizeDeposit(user, amount, keccak256(abi.encodePacked(amount)));

        assertEq(bez.balanceOf(user), balBefore + amount);
    }

    /// @dev Withdrawal moves exactly `withdrawAmt` out of the sender. With BEZCoinV2 the
    ///      "burn" is a transfer to the treasury wallet, so totalSupply is UNCHANGED and the
    ///      treasury balance grows by `withdrawAmt` (it is not destroyed).
    function testFuzz_withdrawalBurnsExact(uint256 depositAmt, uint256 withdrawAmt) public {
        depositAmt = bound(depositAmt, 1, 10_000_000 ether);
        withdrawAmt = bound(withdrawAmt, 1, depositAmt);

        // Setup: deposit first
        vm.prank(relayer);
        bridge.finalizeDeposit(user, depositAmt, bytes32("dep1"));

        vm.prank(user);
        bez.approve(address(bridge), withdrawAmt);

        uint256 supplyBefore = bez.totalSupply();
        address treasury = bez.treasuryWallet();
        uint256 treasuryBefore = bez.balanceOf(treasury);

        vm.prank(user);
        bridge.initiateWithdrawal(address(0xDEAD), withdrawAmt);

        assertEq(bez.balanceOf(user), depositAmt - withdrawAmt);
        // Supply unchanged; "burned" tokens are collected by the treasury.
        assertEq(bez.totalSupply(), supplyBefore);
        assertEq(bez.balanceOf(treasury), treasuryBefore + withdrawAmt);
    }

    /// @dev Zero deposit always reverts
    function testFuzz_zeroDepositReverts(address recipient) public {
        vm.assume(recipient != address(0));
        vm.prank(relayer);
        vm.expectRevert(bytes("Amount must be greater than 0"));
        bridge.finalizeDeposit(recipient, 0, bytes32("tx"));
    }

    /// @dev Zero withdrawal always reverts
    function testFuzz_zeroWithdrawalReverts(address target) public {
        vm.assume(target != address(0));
        vm.prank(user);
        vm.expectRevert(bytes("Amount must be greater than 0"));
        bridge.initiateWithdrawal(target, 0);
    }

    /// @dev Non-relayer cannot finalize deposits
    function testFuzz_onlyRelayerDeposits(address attacker) public {
        vm.assume(attacker != relayer);
        vm.assume(attacker != admin);

        vm.prank(attacker);
        vm.expectRevert();
        bridge.finalizeDeposit(user, 1 ether, bytes32("hack"));
    }

    /// @dev Deposit to zero address reverts
    function testFuzz_depositToZeroReverts(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000 ether);

        vm.prank(relayer);
        vm.expectRevert(bytes("Invalid Recipient Address"));
        bridge.finalizeDeposit(address(0), amount, bytes32("tx"));
    }

    /// @dev Round-trip: deposit + full withdrawal leaves user with 0
    function testFuzz_roundTrip(uint256 amount) public {
        amount = bound(amount, 1, 5_000_000 ether);

        vm.prank(relayer);
        bridge.finalizeDeposit(user, amount, bytes32("dep"));

        vm.prank(user);
        bez.approve(address(bridge), amount);
        vm.prank(user);
        bridge.initiateWithdrawal(address(0xDEAD), amount);

        assertEq(bez.balanceOf(user), 0);
    }
}
