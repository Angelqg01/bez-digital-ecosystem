// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {BeZhasLogisticsNFT} from "../../src/tokens/BeZhasLogisticsNFT.sol";

contract BeZhasLogisticsNFTTest is Test {
    BeZhasLogisticsNFT public nft;
    address public admin = address(1);
    address public apiMinter = address(2);
    address public enterprise = address(3);

    function setUp() public {
        vm.startPrank(admin);
        nft = new BeZhasLogisticsNFT(admin);
        nft.grantRole(nft.MINTER_ROLE(), apiMinter);
        vm.stopPrank();
    }

    function test_SafeMintSuccess() public {
        string memory uri = "ipfs://QmLogisticsMetadataHash123";
        string memory containerId = "MSKU1811882";

        // El backend API acuña el NFT tras validacion de IA
        vm.prank(apiMinter);
        uint256 tokenId = nft.safeMint(enterprise, uri, containerId);

        // Verificar el dueño y el URI
        assertEq(nft.ownerOf(tokenId), enterprise);
        assertEq(nft.tokenURI(tokenId), uri);
    }

    function test_SafeMintRevertsUnauthorized() public {
        address hacker = address(4);

        vm.prank(hacker);
        vm.expectRevert(); // Falta rol de Minter
        nft.safeMint(enterprise, "ipfs://Fake", "FakeID");
    }
}
