// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/government/LandCadastralRegistry.sol";

contract LandCadastralRegistryTest is Test {
    LandCadastralRegistry registry;
    address admin = address(this);
    address surveyor = address(0xB1);
    address owner1 = address(0xC1);
    address owner2 = address(0xC2);

    function setUp() public {
        registry = new LandCadastralRegistry();
        registry.grantRole(registry.SURVEYOR_ROLE(), surveyor);
    }

    // Helper
    function _registerParcel() internal returns (uint256) {
        vm.prank(surveyor);
        return registry.registerParcel(
            keccak256("GPS:10.5,-66.9"),
            5000,
            LandCadastralRegistry.ZoneType.RESIDENTIAL,
            owner1,
            120_000e18
        );
    }

    // ── registerParcel ──────────────────
    function testRegisterParcel() public {
        uint256 pid = _registerParcel();
        (, bytes32 loc, uint256 area, LandCadastralRegistry.ZoneType zone, address owner, uint256 value, LandCadastralRegistry.ParcelStatus status, ) = registry.parcels(pid);
        assertEq(owner, owner1);
        assertEq(area, 5000);
        assertEq(uint8(zone), uint8(LandCadastralRegistry.ZoneType.RESIDENTIAL));
        assertEq(value, 120_000e18);
        assertEq(uint8(status), uint8(LandCadastralRegistry.ParcelStatus.REGISTERED));
    }

    function testRegisterParcelRevertZeroOwner() public {
        vm.prank(surveyor);
        vm.expectRevert("Invalid owner");
        registry.registerParcel(keccak256("x"), 100, LandCadastralRegistry.ZoneType.COMMERCIAL, address(0), 1e18);
    }

    function testRegisterParcelRevertZeroArea() public {
        vm.prank(surveyor);
        vm.expectRevert("Area must be > 0");
        registry.registerParcel(keccak256("x"), 0, LandCadastralRegistry.ZoneType.COMMERCIAL, owner1, 1e18);
    }

    // ── transferParcel ──────────────────
    function testTransferParcel() public {
        uint256 pid = _registerParcel();
        vm.prank(owner1);
        registry.transferParcel(pid, owner2, 130_000e18);
        (, , , , address newOwner, , , ) = registry.parcels(pid);
        assertEq(newOwner, owner2);
    }

    function testTransferParcelRevertNotOwner() public {
        uint256 pid = _registerParcel();
        vm.prank(owner2);
        vm.expectRevert("Not owner");
        registry.transferParcel(pid, owner2, 130_000e18);
    }

    function testTransferParcelRevertFrozen() public {
        uint256 pid = _registerParcel();
        vm.prank(surveyor);
        registry.freezeParcel(pid);
        vm.prank(owner1);
        vm.expectRevert("Not transferable");
        registry.transferParcel(pid, owner2, 100e18);
    }

    function testGetParcelTransfers() public {
        uint256 pid = _registerParcel();
        vm.prank(owner1);
        registry.transferParcel(pid, owner2, 130_000e18);
        uint256[] memory txIds = registry.getParcelTransfers(pid);
        assertEq(txIds.length, 1);
    }

    // ── appraiseParcel ──────────────────
    function testAppraiseParcel() public {
        uint256 pid = _registerParcel();
        vm.prank(surveyor);
        registry.appraiseParcel(pid, 150_000e18);
        (, , , , , uint256 val, , ) = registry.parcels(pid);
        assertEq(val, 150_000e18);
    }

    // ── rezoneParcel ──────────────────
    function testRezoneParcel() public {
        uint256 pid = _registerParcel();
        vm.prank(surveyor);
        registry.rezoneParcel(pid, LandCadastralRegistry.ZoneType.COMMERCIAL);
        (, , , LandCadastralRegistry.ZoneType zone, , , , ) = registry.parcels(pid);
        assertEq(uint8(zone), uint8(LandCadastralRegistry.ZoneType.COMMERCIAL));
    }

    // ── disputeParcel ──────────────────
    function testDisputeParcel() public {
        uint256 pid = _registerParcel();
        vm.prank(surveyor);
        registry.disputeParcel(pid);
        (, , , , , , LandCadastralRegistry.ParcelStatus status, ) = registry.parcels(pid);
        assertEq(uint8(status), uint8(LandCadastralRegistry.ParcelStatus.DISPUTED));
    }

    // ── freezeParcel / unfreezeParcel ──────────────────
    function testFreezeAndUnfreezeParcel() public {
        uint256 pid = _registerParcel();
        vm.prank(surveyor);
        registry.freezeParcel(pid);
        (, , , , , , LandCadastralRegistry.ParcelStatus s1, ) = registry.parcels(pid);
        assertEq(uint8(s1), uint8(LandCadastralRegistry.ParcelStatus.FROZEN));

        vm.prank(surveyor);
        registry.unfreezeParcel(pid);
        (, , , , , , LandCadastralRegistry.ParcelStatus s2, ) = registry.parcels(pid);
        assertEq(uint8(s2), uint8(LandCadastralRegistry.ParcelStatus.REGISTERED));
    }

    // ── deregisterParcel ──────────────────
    function testDeregisterParcel() public {
        uint256 pid = _registerParcel();
        vm.prank(surveyor);
        registry.deregisterParcel(pid);
        (, , , , , , LandCadastralRegistry.ParcelStatus status, ) = registry.parcels(pid);
        assertEq(uint8(status), uint8(LandCadastralRegistry.ParcelStatus.DEREGISTERED));
    }

    function testDeregisterRevertAlreadyDeregistered() public {
        uint256 pid = _registerParcel();
        vm.prank(surveyor);
        registry.deregisterParcel(pid);
        vm.prank(surveyor);
        vm.expectRevert("Already deregistered");
        registry.deregisterParcel(pid);
    }

    // ── getOwnerParcels ──────────────────
    function testGetOwnerParcels() public {
        _registerParcel();
        vm.prank(surveyor);
        registry.registerParcel(keccak256("GPS:11"), 3000, LandCadastralRegistry.ZoneType.AGRICULTURAL, owner1, 80_000e18);
        uint256[] memory ids = registry.getOwnerParcels(owner1);
        assertEq(ids.length, 2);
    }
}
