// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/legal/IPRegistryNFT.sol";

contract IPRegistryNFTTest is Test {
    IPRegistryNFT public registry;
    address public admin     = address(this);
    address public registrar = address(0xA1);
    address public owner1    = address(0xB1);
    address public licensee  = address(0xB2);
    address public anyone    = address(0xC1);

    function setUp() public {
        registry = new IPRegistryNFT();
        registry.grantRole(registry.REGISTRAR_ROLE(), registrar);
        vm.deal(owner1, 50 ether);
        vm.deal(licensee, 50 ether);
        vm.deal(anyone, 50 ether);
    }

    // ── helpers ──────────────────
    function _registerIP() internal returns (uint256) {
        vm.prank(owner1);
        return registry.registerIP{value: 0.01 ether}(
            IPRegistryNFT.IPType.PATENT,
            "Super Algorithm",
            keccak256("proof1"),
            365 days,
            IPRegistryNFT.Permissions({
                visibility: IPRegistryNFT.Visibility.PUBLIC,
                listable: true,
                saleEnabled: true,
                rentEnabled: true,
                price: 0
            })
        );
    }

    function _registerAndApprove() internal returns (uint256) {
        uint256 ipId = _registerIP();
        vm.prank(registrar);
        registry.approveRegistration(ipId);
        return ipId;
    }

    // ── registerIP ──────────────────
    function testRegisterIP() public {
        uint256 ipId = _registerIP();
        (, address o, IPRegistryNFT.IPType t, , , , , IPRegistryNFT.IPStatus status, , , ) = registry.ipAssets(ipId);
        assertEq(o, owner1);
        assertEq(uint8(t), uint8(IPRegistryNFT.IPType.PATENT));
        assertEq(uint8(status), uint8(IPRegistryNFT.IPStatus.PENDING));
    }

    function testRegisterRevertLowFee() public {
        vm.prank(owner1);
        vm.expectRevert("Insufficient fee");
        registry.registerIP{value: 0.001 ether}(
            IPRegistryNFT.IPType.TRADEMARK,
            "Brand",
            keccak256("p"),
            365 days,
            IPRegistryNFT.Permissions({
                visibility: IPRegistryNFT.Visibility.PUBLIC,
                listable: true,
                saleEnabled: true,
                rentEnabled: true,
                price: 0
            })
        );
    }

    function testRegisterRevertDuplicateProof() public {
        _registerIP();
        vm.prank(owner1);
        vm.expectRevert("Proof already registered");
        registry.registerIP{value: 0.01 ether}(
            IPRegistryNFT.IPType.COPYRIGHT,
            "Copy",
            keccak256("proof1"),
            365 days,
            IPRegistryNFT.Permissions({
                visibility: IPRegistryNFT.Visibility.PUBLIC,
                listable: true,
                saleEnabled: true,
                rentEnabled: true,
                price: 0
            })
        );
    }

    // ── approveRegistration ──────────────────
    function testApproveRegistration() public {
        uint256 ipId = _registerAndApprove();
        (, , , , , , , IPRegistryNFT.IPStatus status, , , ) = registry.ipAssets(ipId);
        assertEq(uint8(status), uint8(IPRegistryNFT.IPStatus.REGISTERED));
    }

    function testApproveRevertNotRegistrar() public {
        uint256 ipId = _registerIP();
        vm.prank(anyone);
        vm.expectRevert();
        registry.approveRegistration(ipId);
    }

    // ── grantLicense ──────────────────
    function testGrantLicense() public {
        uint256 ipId = _registerAndApprove();
        vm.prank(owner1);
        uint256 lid = registry.grantLicense{value: 1 ether}(ipId, licensee, 180 days, false);
        (uint256 ip, address lic, uint256 fee,,, bool exclusive, bool active) = registry.licenses(lid);
        assertEq(ip, ipId);
        assertEq(lic, licensee);
        assertEq(fee, 1 ether);
        assertFalse(exclusive);
        assertTrue(active);
    }

    function testGrantLicenseRevertNotOwner() public {
        uint256 ipId = _registerAndApprove();
        vm.prank(anyone);
        vm.expectRevert("Not IP owner");
        registry.grantLicense{value: 1 ether}(ipId, licensee, 180 days, true);
    }

    // ── revokeLicense ──────────────────
    function testRevokeLicense() public {
        uint256 ipId = _registerAndApprove();
        vm.prank(owner1);
        uint256 lid = registry.grantLicense{value: 1 ether}(ipId, licensee, 180 days, false);
        vm.prank(owner1);
        registry.revokeLicense(ipId, lid);
        (,,,,,, bool active) = registry.licenses(lid);
        assertFalse(active);
    }

    function testRevokeLicenseRevertNotOwner() public {
        uint256 ipId = _registerAndApprove();
        vm.prank(owner1);
        uint256 lid = registry.grantLicense{value: 1 ether}(ipId, licensee, 180 days, false);
        vm.prank(anyone);
        vm.expectRevert("Not IP owner");
        registry.revokeLicense(ipId, lid);
    }

    // ── disputeIP ──────────────────
    function testDisputeIP() public {
        uint256 ipId = _registerAndApprove();
        vm.prank(anyone);
        registry.disputeIP(ipId);
        (, , , , , , , IPRegistryNFT.IPStatus status, , , ) = registry.ipAssets(ipId);
        assertEq(uint8(status), uint8(IPRegistryNFT.IPStatus.DISPUTED));
    }

    // ── revokeIP ──────────────────
    function testRevokeIP() public {
        uint256 ipId = _registerAndApprove();
        vm.prank(registrar);
        registry.revokeIP(ipId);
        (, , , , , , , IPRegistryNFT.IPStatus status, , , ) = registry.ipAssets(ipId);
        assertEq(uint8(status), uint8(IPRegistryNFT.IPStatus.REVOKED));
    }

    function testRevokeIPRevertNotRegistrar() public {
        uint256 ipId = _registerAndApprove();
        vm.prank(anyone);
        vm.expectRevert();
        registry.revokeIP(ipId);
    }

    // ── withdrawRevenue ──────────────────
    function testWithdrawRevenue() public {
        uint256 ipId = _registerAndApprove();
        vm.prank(owner1);
        registry.grantLicense{value: 2 ether}(ipId, licensee, 180 days, false);

        uint256 balBefore = owner1.balance;
        vm.prank(owner1);
        registry.withdrawRevenue();
        assertEq(owner1.balance, balBefore + 2 ether);
    }

    function testWithdrawRevenueRevertNothing() public {
        vm.prank(anyone);
        vm.expectRevert("Nothing to withdraw");
        registry.withdrawRevenue();
    }

    // ── verifyProof ──────────────────
    function testVerifyProof() public {
        uint256 ipId = _registerIP();
        assertTrue(registry.verifyProof(ipId, keccak256("proof1")));
        assertFalse(registry.verifyProof(ipId, keccak256("fake")));
    }
}
