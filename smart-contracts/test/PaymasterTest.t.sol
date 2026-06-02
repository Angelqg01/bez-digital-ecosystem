// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Paymaster} from "../src/wallet/Paymaster.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockBEZ is ERC20 {
    constructor() ERC20("BeZhas Coin", "BEZ") {
        _mint(msg.sender, 1_000_000 ether);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PaymasterTest is Test {
    Paymaster public paymaster;
    MockBEZ public bez;
    
    address public admin;
    address public enterprise;
    address public user1;
    address public user2;
    address public relayer;
    address public attacker;
    address public targetContract;

    function setUp() public {
        admin = makeAddr("admin");
        enterprise = makeAddr("enterprise");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        relayer = makeAddr("relayer");
        attacker = makeAddr("attacker");
        targetContract = makeAddr("targetContract");

        bez = new MockBEZ();
        paymaster = new Paymaster(address(bez), admin);

        // Give enterprise BEZ tokens
        bez.mint(enterprise, 10_000 ether);

        // Setup relayer
        vm.prank(admin);
        paymaster.addRelayer(relayer);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Registration
    // ═══════════════════════════════════════════════════════════════════

    function test_RegisterEnterprise() public {
        vm.prank(enterprise);
        paymaster.registerEnterprise(1000 ether, 10 ether);
        
        (,,,,, bool active) = paymaster.enterprises(enterprise);
        assertTrue(active);
        assertTrue(paymaster.isEnterpriseRegistered(enterprise));
    }

    function test_CannotRegisterTwice() public {
        vm.startPrank(enterprise);
        paymaster.registerEnterprise(1000 ether, 10 ether);
        vm.expectRevert("PM: already registered");
        paymaster.registerEnterprise(1000 ether, 10 ether);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Deposit / Withdraw
    // ═══════════════════════════════════════════════════════════════════

    function test_Deposit() public {
        _registerAndSetup();
        
        vm.startPrank(enterprise);
        bez.approve(address(paymaster), 500 ether);
        paymaster.deposit(500 ether);
        vm.stopPrank();
        
        assertEq(paymaster.getEnterpriseBalance(enterprise), 500 ether);
    }

    function test_Withdraw() public {
        _registerAndSetup();
        
        vm.startPrank(enterprise);
        bez.approve(address(paymaster), 500 ether);
        paymaster.deposit(500 ether);
        paymaster.withdraw(200 ether);
        vm.stopPrank();
        
        assertEq(paymaster.getEnterpriseBalance(enterprise), 300 ether);
    }

    function test_WithdrawInsufficientReverts() public {
        _registerAndSetup();
        
        vm.prank(enterprise);
        vm.expectRevert("PM: insufficient balance");
        paymaster.withdraw(1 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Gas Sponsorship
    // ═══════════════════════════════════════════════════════════════════

    function test_SponsorGas() public {
        _registerFundAndSetup();
        
        vm.prank(relayer);
        paymaster.sponsorGas(enterprise, user1, targetContract, 5 ether);
        
        assertEq(paymaster.getEnterpriseBalance(enterprise), 4995 ether);
    }

    function test_NonRelayerCannotSponsor() public {
        _registerFundAndSetup();
        
        vm.prank(attacker);
        vm.expectRevert("PM: not relayer");
        paymaster.sponsorGas(enterprise, user1, targetContract, 5 ether);
    }

    function test_UnauthorizedUserCannotBeSponsor() public {
        _registerFundAndSetup();
        
        vm.prank(relayer);
        vm.expectRevert("PM: user not authorized");
        paymaster.sponsorGas(enterprise, attacker, targetContract, 5 ether);
    }

    function test_NonWhitelistedContractReverts() public {
        _registerFundAndSetup();
        address otherContract = makeAddr("other");
        
        vm.prank(relayer);
        vm.expectRevert("PM: contract not whitelisted");
        paymaster.sponsorGas(enterprise, user1, otherContract, 5 ether);
    }

    function test_ExceedsMaxGasPerTxReverts() public {
        _registerFundAndSetup();
        
        vm.prank(relayer);
        vm.expectRevert("PM: exceeds max gas per tx");
        paymaster.sponsorGas(enterprise, user1, targetContract, 15 ether); // max is 10
    }

    function test_DailyLimitEnforced() public {
        _registerFundAndSetup();
        
        vm.startPrank(relayer);
        // Spend 1000 ether (daily limit) in 10 ether chunks
        for (uint256 i = 0; i < 100; i++) {
            paymaster.sponsorGas(enterprise, user1, targetContract, 10 ether);
        }
        
        vm.expectRevert("PM: daily limit exceeded");
        paymaster.sponsorGas(enterprise, user1, targetContract, 1 ether);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  User & Contract Management
    // ═══════════════════════════════════════════════════════════════════

    function test_AddAndRemoveUser() public {
        _registerAndSetup();
        
        vm.startPrank(enterprise);
        paymaster.addUser(user1);
        assertTrue(paymaster.isEnterpriseUser(enterprise, user1));
        
        paymaster.removeUser(user1);
        assertFalse(paymaster.isEnterpriseUser(enterprise, user1));
        vm.stopPrank();
    }

    function test_WhitelistAndRemoveContract() public {
        _registerAndSetup();
        
        vm.startPrank(enterprise);
        paymaster.whitelistContract(targetContract);
        assertTrue(paymaster.whitelistedContracts(enterprise, targetContract));
        
        paymaster.removeContract(targetContract);
        assertFalse(paymaster.whitelistedContracts(enterprise, targetContract));
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Emergency
    // ═══════════════════════════════════════════════════════════════════

    function test_EmergencyPause() public {
        _registerFundAndSetup();
        
        vm.prank(admin);
        paymaster.emergencyPause();
        
        vm.prank(relayer);
        vm.expectRevert("PM: paused");
        paymaster.sponsorGas(enterprise, user1, targetContract, 5 ether);
    }

    function test_EmergencyUnpause() public {
        vm.startPrank(admin);
        paymaster.emergencyPause();
        paymaster.emergencyUnpause();
        vm.stopPrank();
        assertFalse(paymaster.paused());
    }

    function test_DeactivateEnterprise() public {
        _registerAndSetup();
        
        vm.prank(admin);
        paymaster.deactivateEnterprise(enterprise);
        
        vm.prank(enterprise);
        vm.expectRevert("PM: not active enterprise");
        paymaster.deposit(1 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Views
    // ═══════════════════════════════════════════════════════════════════

    function test_GetEnterpriseCount() public {
        vm.prank(enterprise);
        paymaster.registerEnterprise(1000 ether, 10 ether);
        assertEq(paymaster.getEnterpriseCount(), 1);
    }

    function test_GetEnterpriseRemainingDaily() public {
        _registerFundAndSetup();
        
        vm.prank(relayer);
        paymaster.sponsorGas(enterprise, user1, targetContract, 5 ether);
        
        assertEq(paymaster.getEnterpriseRemainingDaily(enterprise), 995 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════════════

    function _registerAndSetup() internal {
        vm.prank(enterprise);
        paymaster.registerEnterprise(1000 ether, 10 ether);
    }

    function _registerFundAndSetup() internal {
        vm.prank(enterprise);
        paymaster.registerEnterprise(1000 ether, 10 ether);
        
        vm.startPrank(enterprise);
        bez.approve(address(paymaster), 5000 ether);
        paymaster.deposit(5000 ether);
        paymaster.addUser(user1);
        paymaster.addUser(user2);
        paymaster.whitelistContract(targetContract);
        vm.stopPrank();
    }
}
