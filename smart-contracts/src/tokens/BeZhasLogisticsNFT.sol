// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title BeZhasLogisticsNFT
 * @dev Emite Coleccionables (NFTs) B2B para rastrear la cadena de suministro.
 * Cada contenedor operado es validado por AEGIS IA y luego "tokenizado"
 * aquí para certificar su temperatura, origen y destino on-chain de 
 * de manera inmutable.
 */
contract BeZhasLogisticsNFT is ERC721, ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _nextTokenId;

    event LogisticsManifestCreated(uint256 indexed tokenId, string containerId, address indexed to);

    constructor(address defaultAdmin) ERC721("BeZhas Logistics Container Asset", "BEZNFT") {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin); // Admin puede mintear inicialmente o asignar a oráculos
    }

    /**
     * @dev Acuña un nuevo NFT logístico.
     * Solo las entidades con MINTER_ROLE (Como el servidor API tras validar en QualityEscrow o la IA Aegis)
     * pueden crear estos registros inmutables.
     *
     * @param to Dueño inicial del NFT (La empresa o tesorería de la mercancía).
     * @param uri URI de metadatos (ej. ipfs://hash con detalles técnicos del viaje).
     * @param containerId El ID del mundo real del contenedor.
     * @return El ID del token acuñado.
     */
    function safeMint(address to, string memory uri, string memory containerId) 
        public 
        onlyRole(MINTER_ROLE) 
        returns (uint256) 
    {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit LogisticsManifestCreated(tokenId, containerId, to);

        return tokenId;
    }

    // Funciones sobrescritas obligatorias por herencia múltiple de OpenZeppelin
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
}
