// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol";
import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title SolarFarmToken — Fractionalized renewable energy assets with yield distribution
/// @notice ERC-1155 tokens representing fractional ownership of solar, wind, hydro farms
contract SolarFarmToken is ERC1155, AccessControl {

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum FarmStatus { FUNDING, CONSTRUCTION, PRODUCING, MAINTENANCE, OFFLINE }

    struct EnergyFarm {
        string    name;
        string    farmType;       // SOLAR, WIND, HYDRO
        string    location;
        uint256   capacityMW;
        uint256   tokenSupply;
        uint256   tokenPrice;     // in wei (initial price per token)
        uint256   fundingGoal;    // total BEZ needed
        uint256   fundedAmount;
        FarmStatus status;
    }

    struct DividendRound {
        uint256 farmId;
        uint256 totalAmount;
        uint256 perToken;         // amount per token in wei
        uint256 timestamp;
    }

    uint256 public nextFarmId;
    mapping(uint256 => EnergyFarm) public farms;
    mapping(uint256 => DividendRound[]) public dividendHistory;
    mapping(uint256 => mapping(address => uint256)) public unclaimedDividends;
    uint256 public totalDividendsPaid;

    event FarmRegistered(uint256 indexed farmId, string name, string farmType, uint256 capacityMW);
    event Investment(uint256 indexed farmId, address indexed investor, uint256 tokens, uint256 amount);
    event FarmStatusChanged(uint256 indexed farmId, FarmStatus newStatus);
    event DividendsDistributed(uint256 indexed farmId, uint256 totalAmount, uint256 perToken);
    event DividendsClaimed(uint256 indexed farmId, address indexed investor, uint256 amount);
    event TokensRedeemed(uint256 indexed farmId, address indexed investor, uint256 tokens, uint256 value);

    constructor(address admin) ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    function registerFarm(
        string calldata name,
        string calldata farmType,
        string calldata location,
        uint256 capacityMW,
        uint256 tokenSupply,
        uint256 tokenPrice
    ) external onlyRole(OPERATOR_ROLE) returns (uint256 farmId) {
        require(capacityMW > 0, "Zero capacity");
        require(tokenSupply > 0, "Zero supply");
        farmId = nextFarmId++;
        farms[farmId] = EnergyFarm({
            name: name,
            farmType: farmType,
            location: location,
            capacityMW: capacityMW,
            tokenSupply: tokenSupply,
            tokenPrice: tokenPrice,
            fundingGoal: tokenSupply * tokenPrice,
            fundedAmount: 0,
            status: FarmStatus.FUNDING
        });
        emit FarmRegistered(farmId, name, farmType, capacityMW);
    }

    function investInFarm(uint256 farmId, uint256 tokens) external payable {
        EnergyFarm storage f = farms[farmId];
        require(f.status == FarmStatus.FUNDING, "Not in funding");
        require(tokens > 0, "Zero tokens");
        uint256 cost = tokens * f.tokenPrice;
        require(msg.value >= cost, "Insufficient payment");

        f.fundedAmount += cost;
        _mint(msg.sender, farmId, tokens, "");

        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }

        emit Investment(farmId, msg.sender, tokens, cost);
    }

    function setFarmStatus(uint256 farmId, FarmStatus newStatus) external onlyRole(OPERATOR_ROLE) {
        require(farmId < nextFarmId, "Invalid farm");
        farms[farmId].status = newStatus;
        emit FarmStatusChanged(farmId, newStatus);
    }

    function distributeDividends(uint256 farmId) external payable onlyRole(OPERATOR_ROLE) {
        EnergyFarm storage f = farms[farmId];
        require(f.status == FarmStatus.PRODUCING, "Not producing");
        require(msg.value > 0, "Zero dividends");

        uint256 perToken = msg.value / f.tokenSupply;
        require(perToken > 0, "Dividend too small");

        dividendHistory[farmId].push(DividendRound({
            farmId: farmId,
            totalAmount: msg.value,
            perToken: perToken,
            timestamp: block.timestamp
        }));

        totalDividendsPaid += msg.value;
        emit DividendsDistributed(farmId, msg.value, perToken);
    }

    function claimDividends(uint256 farmId) external {
        uint256 balance = balanceOf(msg.sender, farmId);
        require(balance > 0, "No tokens held");

        DividendRound[] storage rounds = dividendHistory[farmId];
        uint256 claimed = unclaimedDividends[farmId][msg.sender];
        uint256 totalOwed;

        for (uint256 i = claimed; i < rounds.length; i++) {
            totalOwed += balance * rounds[i].perToken;
        }
        require(totalOwed > 0, "Nothing to claim");

        unclaimedDividends[farmId][msg.sender] = rounds.length;
        payable(msg.sender).transfer(totalOwed);
        emit DividendsClaimed(farmId, msg.sender, totalOwed);
    }

    function getDividendRounds(uint256 farmId) external view returns (uint256) {
        return dividendHistory[farmId].length;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
