// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title CropTokenFutures — Tokenized crop futures with harvest oracle on BeZhas Chain
/// @notice Create crop futures, certify harvests via oracle, buy/settle
contract CropTokenFutures is AccessControl {

    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    struct CropFuture {
        string  cropName;
        string  variety;
        address farmer;
        uint256 hectares;
        uint256 estimatedYield;   // kg
        uint256 pricePerTon;      // in wei
        uint256 harvestDate;
        bool    certified;
        bool    settled;
        address buyer;
    }

    struct HarvestCertificate {
        uint256 futureId;
        uint256 actualYield;      // kg
        uint256 qualityScore;     // 0-100
        address certifier;
        uint256 certifiedAt;
    }

    uint256 public nextFutureId;
    mapping(uint256 => CropFuture) public futures;

    uint256 public nextCertId;
    mapping(uint256 => HarvestCertificate) public harvestCerts;
    mapping(uint256 => uint256) public futureToCert;

    event FutureCreated(uint256 indexed futureId, string cropName, address indexed farmer, uint256 hectares);
    event FuturePurchased(uint256 indexed futureId, address indexed buyer);
    event HarvestCertified(uint256 indexed futureId, uint256 certId, uint256 actualYield, uint256 qualityScore);
    event FutureSettled(uint256 indexed futureId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FARMER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    function createFuture(
        string calldata cropName,
        string calldata variety,
        uint256 hectares,
        uint256 estimatedYield,
        uint256 pricePerTon,
        uint256 harvestDate
    ) external onlyRole(FARMER_ROLE) returns (uint256) {
        require(hectares > 0, "Hectares must be > 0");
        require(estimatedYield > 0, "Yield must be > 0");
        require(harvestDate > block.timestamp, "Harvest must be future");

        uint256 id = nextFutureId++;
        futures[id] = CropFuture({
            cropName: cropName,
            variety: variety,
            farmer: msg.sender,
            hectares: hectares,
            estimatedYield: estimatedYield,
            pricePerTon: pricePerTon,
            harvestDate: harvestDate,
            certified: false,
            settled: false,
            buyer: address(0)
        });

        emit FutureCreated(id, cropName, msg.sender, hectares);
        return id;
    }

    function buyFuture(uint256 futureId) external payable {
        CropFuture storage f = futures[futureId];
        require(f.hectares > 0, "Future does not exist");
        require(f.buyer == address(0), "Already purchased");
        require(!f.settled, "Already settled");
        require(msg.value >= f.pricePerTon, "Insufficient payment");

        f.buyer = msg.sender;
        emit FuturePurchased(futureId, msg.sender);
    }

    function certifyHarvest(
        uint256 futureId,
        uint256 actualYield,
        uint256 qualityScore
    ) external onlyRole(ORACLE_ROLE) {
        CropFuture storage f = futures[futureId];
        require(f.hectares > 0, "Future does not exist");
        require(!f.certified, "Already certified");
        require(qualityScore <= 100, "Max quality is 100");

        uint256 certId = nextCertId++;
        harvestCerts[certId] = HarvestCertificate({
            futureId: futureId,
            actualYield: actualYield,
            qualityScore: qualityScore,
            certifier: msg.sender,
            certifiedAt: block.timestamp
        });
        futureToCert[futureId] = certId;
        f.certified = true;

        emit HarvestCertified(futureId, certId, actualYield, qualityScore);
    }

    function settleFuture(uint256 futureId) external {
        CropFuture storage f = futures[futureId];
        require(f.hectares > 0, "Future does not exist");
        require(f.certified, "Not certified yet");
        require(!f.settled, "Already settled");
        require(msg.sender == f.farmer || msg.sender == f.buyer, "Not authorized");

        f.settled = true;
        if (f.buyer != address(0)) {
            payable(f.farmer).transfer(f.pricePerTon);
        }
        emit FutureSettled(futureId);
    }

    function getFuture(uint256 id) external view returns (
        string memory cropName, string memory variety, address farmer,
        uint256 hectares, uint256 estimatedYield, uint256 pricePerTon,
        uint256 harvestDate, bool certified, bool settled, address buyer
    ) {
        CropFuture storage f = futures[id];
        return (f.cropName, f.variety, f.farmer, f.hectares, f.estimatedYield,
                f.pricePerTon, f.harvestDate, f.certified, f.settled, f.buyer);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
