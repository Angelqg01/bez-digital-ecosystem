// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title BeZhasPartnerSBT
 * @notice Soulbound Token (SBT) que representa la membresía de socio en BeZhas.
 * Es intransferible y certifica que una entidad ha pasado el proceso de verificación
 * de la "red de socios pre-verificados".
 *
 * Integración con Agentes:
 * - El marketing-agent puede solicitar el minteo tras la cualificación del lead.
 * - El legal-agent debe validar la identidad antes de autorizar el minteo.
 */
contract BeZhasPartnerSBT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _nextTokenId;

    error TokenIsSoulbound();

    constructor(address admin) ERC721("BeZhas Partner Membership", "BEZ-SBT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /**
     * @dev Mintea un SBT de socio. Solo minters autorizados (Agentes IA o Admin).
     */
    function mintPartnerSBT(address to) public onlyRole(MINTER_ROLE) returns (uint256) {
        require(balanceOf(to) == 0, "Address already has a Partner SBT");
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    /**
     * @dev Bloquea las transferencias (Soulbound).
     */
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert TokenIsSoulbound();
        }
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
