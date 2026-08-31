// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CargoManifestNFT
 * @dev Digital cargo manifest as NFT with BEZ-Coin payment integration
 * Implements DCSA v3.0 standards for maritime logistics
 */
contract CargoManifestNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIds;
    
    // BEZ-Coin contract address on Polygon
    IERC20 public immutable bezCoin;
    
    // Registration fee in BEZ-Coin (equivalent to $0.05 USD)
    uint256 public registrationFee;
    
    // Manifest metadata structure
    struct ManifestData {
        string containerId;
        string transportMode; // Maritime, Air, Road, Rail
        string commodityDescription;
        uint256 weightMT; // Weight in metric tons (scaled by 1000)
        string vesselVoyage;
        string hsCode;
        address shipper;
        address consignee;
        string originPort;
        string destinationPort;
        bool isHazardous;
        bool isReefered;
        bool isOOG; // Out-of-Gauge
        uint256 timestamp;
        ManifestStatus status;
    }
    
    enum ManifestStatus {
        REGISTERED,
        IN_TRANSIT,
        CUSTOMS_CLEARANCE,
        DELIVERED,
        CANCELLED
    }
    
    // Token ID => Manifest Data
    mapping(uint256 => ManifestData) public manifests;
    
    // Container ID => Token ID (for lookups)
    mapping(string => uint256) public containerToToken;
    
    // Appendix tracking
    mapping(uint256 => string) public hazardousAppendix; // MSDS URI
    mapping(uint256 => string) public reeferAppendix; // Temperature/Humidity data URI
    mapping(uint256 => string) public oogAppendix; // Dimensions data URI
    
    // Commercial documents URIs
    mapping(uint256 => string[]) public commercialInvoices;
    mapping(uint256 => string[]) public packingLists;
    mapping(uint256 => string[]) public certificatesOfOrigin;
    
    // Events
    event ManifestRegistered(
        uint256 indexed tokenId,
        string containerId,
        address indexed shipper,
        address indexed consignee,
        string originPort,
        string destinationPort
    );
    
    event HazardousAppendixAttached(uint256 indexed tokenId, string msdsURI);
    event ReeferAppendixAttached(uint256 indexed tokenId, string tempDataURI);
    event OOGAppendixAttached(uint256 indexed tokenId, string dimensionsURI);
    event StatusUpdated(uint256 indexed tokenId, ManifestStatus newStatus);
    event DocumentAttached(uint256 indexed tokenId, string documentType, string uri);
    
    constructor(
        address _bezCoinAddress,
        uint256 _registrationFee
    ) ERC721("BeZhas Cargo Manifest", "BCM") Ownable(msg.sender) {
        require(_bezCoinAddress != address(0), "Invalid BEZ-Coin address");
        bezCoin = IERC20(_bezCoinAddress);
        registrationFee = _registrationFee;
    }
    
    /**
     * @dev Register a new cargo manifest as NFT
     * @param containerId Unique container identifier
     * @param transportMode Mode of transport (Maritime, Air, Road, Rail)
     * @param commodityDescription Description of cargo
     * @param weightMT Weight in metric tons (scaled by 1000)
     * @param vesselVoyage Vessel/flight/truck identification
     * @param hsCode Harmonized System code
     * @param consignee Address of the consignee
     * @param originPort Origin port/airport code
     * @param destinationPort Destination port/airport code
     * @param manifestURI IPFS URI with full manifest data
     * @param isHazardous Is cargo hazardous?
     * @param isReefered Is cargo refrigerated?
     * @param isOOG Is cargo out-of-gauge?
     */
    function registerManifest(
        string memory containerId,
        string memory transportMode,
        string memory commodityDescription,
        uint256 weightMT,
        string memory vesselVoyage,
        string memory hsCode,
        address consignee,
        string memory originPort,
        string memory destinationPort,
        string memory manifestURI,
        bool isHazardous,
        bool isReefered,
        bool isOOG
    ) external returns (uint256) {
        require(bytes(containerId).length > 0, "Container ID required");
        require(containerToToken[containerId] == 0, "Container already registered");
        require(consignee != address(0), "Invalid consignee address");
        
        // Transfer registration fee in BEZ-Coin
        require(
            bezCoin.transferFrom(msg.sender, owner(), registrationFee),
            "BEZ-Coin payment failed"
        );
        
        _tokenIds++;
        uint256 newTokenId = _tokenIds;
        
        // Mint NFT to shipper
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, manifestURI);
        
        // Store manifest data
        manifests[newTokenId] = ManifestData({
            containerId: containerId,
            transportMode: transportMode,
            commodityDescription: commodityDescription,
            weightMT: weightMT,
            vesselVoyage: vesselVoyage,
            hsCode: hsCode,
            shipper: msg.sender,
            consignee: consignee,
            originPort: originPort,
            destinationPort: destinationPort,
            isHazardous: isHazardous,
            isReefered: isReefered,
            isOOG: isOOG,
            timestamp: block.timestamp,
            status: ManifestStatus.REGISTERED
        });
        
        containerToToken[containerId] = newTokenId;
        
        emit ManifestRegistered(
            newTokenId,
            containerId,
            msg.sender,
            consignee,
            originPort,
            destinationPort
        );
        
        return newTokenId;
    }
    
    /**
     * @dev Attach hazardous cargo appendix (MSDS)
     */
    function attachHazardousAppendix(
        uint256 tokenId,
        string memory msdsURI,
        string memory unClass
    ) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not manifest owner");
        require(manifests[tokenId].isHazardous, "Not hazardous cargo");
        
        hazardousAppendix[tokenId] = msdsURI;
        emit HazardousAppendixAttached(tokenId, msdsURI);
    }
    
    /**
     * @dev Attach reefer (refrigerated) cargo appendix
     */
    function attachReeferAppendix(
        uint256 tokenId,
        string memory tempDataURI
    ) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not manifest owner");
        require(manifests[tokenId].isReefered, "Not reefer cargo");
        
        reeferAppendix[tokenId] = tempDataURI;
        emit ReeferAppendixAttached(tokenId, tempDataURI);
    }
    
    /**
     * @dev Attach OOG (Out-of-Gauge) cargo appendix
     */
    function attachOOGAppendix(
        uint256 tokenId,
        string memory dimensionsURI
    ) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not manifest owner");
        require(manifests[tokenId].isOOG, "Not OOG cargo");
        
        oogAppendix[tokenId] = dimensionsURI;
        emit OOGAppendixAttached(tokenId, dimensionsURI);
    }
    
    /**
     * @dev Attach commercial documents
     */
    function attachCommercialInvoice(uint256 tokenId, string memory invoiceURI) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not manifest owner");
        commercialInvoices[tokenId].push(invoiceURI);
        emit DocumentAttached(tokenId, "CommercialInvoice", invoiceURI);
    }
    
    function attachPackingList(uint256 tokenId, string memory packingListURI) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not manifest owner");
        packingLists[tokenId].push(packingListURI);
        emit DocumentAttached(tokenId, "PackingList", packingListURI);
    }
    
    function attachCertificateOfOrigin(uint256 tokenId, string memory certURI) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not manifest owner");
        certificatesOfOrigin[tokenId].push(certURI);
        emit DocumentAttached(tokenId, "CertificateOfOrigin", certURI);
    }
    
    /**
     * @dev Update manifest status
     */
    function updateStatus(uint256 tokenId, ManifestStatus newStatus) external {
        require(_exists(tokenId), "Token does not exist");
        require(
            ownerOf(tokenId) == msg.sender || owner() == msg.sender,
            "Not authorized"
        );
        
        manifests[tokenId].status = newStatus;
        emit StatusUpdated(tokenId, newStatus);
    }
    
    /**
     * @dev Transfer manifest ownership (following MLETR principles)
     */
    function transferManifest(uint256 tokenId, address newOwner) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not manifest owner");
        require(newOwner != address(0), "Invalid new owner");
        
        _transfer(msg.sender, newOwner, tokenId);
    }
    
    /**
     * @dev Verify manifest ownership
     */
    function verifyOwnership(uint256 tokenId) external view returns (address) {
        require(_exists(tokenId), "Token does not exist");
        return ownerOf(tokenId);
    }
    
    /**
     * @dev Calculate registration fee in BEZ-Coin
     */
    function calculateFees() external view returns (uint256) {
        return registrationFee;
    }
    
    /**
     * @dev Update registration fee (only owner)
     */
    function updateRegistrationFee(uint256 newFee) external onlyOwner {
        registrationFee = newFee;
    }
    
    /**
     * @dev Get manifest data
     */
    function getManifest(uint256 tokenId) external view returns (ManifestData memory) {
        require(_exists(tokenId), "Token does not exist");
        return manifests[tokenId];
    }
    
    /**
     * @dev Get token ID from container ID
     */
    function getTokenIdFromContainer(string memory containerId) external view returns (uint256) {
        uint256 tokenId = containerToToken[containerId];
        require(tokenId != 0, "Container not registered");
        return tokenId;
    }
    
    /**
     * @dev Get all documents for a manifest
     */
    function getDocuments(uint256 tokenId) external view returns (
        string[] memory invoices,
        string[] memory packing,
        string[] memory certificates
    ) {
        require(_exists(tokenId), "Token does not exist");
        return (
            commercialInvoices[tokenId],
            packingLists[tokenId],
            certificatesOfOrigin[tokenId]
        );
    }
    
    /**
     * @dev Check if token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
