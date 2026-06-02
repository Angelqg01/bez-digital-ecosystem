// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract GlobalConfigurationSystem is ReentrancyGuard, Pausable, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CONFIG_MANAGER_ROLE = keccak256("CONFIG_MANAGER_ROLE");

    struct ConfigParameter {
        string key;
        string value;
        string dataType; // "uint256", "string", "bool", "address"
        string description;
        uint256 lastUpdated;
        address updatedBy;
        bool isLocked;
        uint256 minValue;
        uint256 maxValue;
    }

    struct ConfigCategory {
        string name;
        string description;
        bool isActive;
        string[] parameterKeys;
    }

    // Storage
    mapping(string => ConfigParameter) public parameters;
    mapping(string => ConfigCategory) public categories;
    mapping(address => mapping(string => bool)) public userPermissions;
    
    string[] public allParameterKeys;
    string[] public allCategoryNames;
    
    // System-wide settings
    uint256 public configVersion;
    bool public emergencyMode;
    address public emergencyContact;
    
    // Events
    event ParameterUpdated(string indexed key, string oldValue, string newValue, address updatedBy);
    event ParameterCreated(string indexed key, string value, string dataType);
    event ParameterLocked(string indexed key, address lockedBy);
    event ParameterUnlocked(string indexed key, address unlockedBy);
    event CategoryCreated(string indexed categoryName, string description);
    event CategoryUpdated(string indexed categoryName, bool isActive);
    event EmergencyModeToggled(bool enabled, address triggeredBy);
    event ConfigVersionUpdated(uint256 oldVersion, uint256 newVersion);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(CONFIG_MANAGER_ROLE, msg.sender);
        
        configVersion = 1;
        emergencyContact = msg.sender;
        
        // Initialize default categories
        _createCategory("system", "System-wide configuration parameters", true);
        _createCategory("security", "Security-related parameters", true);
        _createCategory("defi", "DeFi and staking parameters", true);
        _createCategory("marketplace", "Marketplace configuration", true);
        _createCategory("social", "Social features configuration", true);
        
        // Initialize default parameters
        _initializeDefaultParameters();
    }

    modifier parameterExists(string memory key) {
        require(bytes(parameters[key].key).length > 0, "Parameter does not exist");
        _;
    }

    modifier parameterNotLocked(string memory key) {
        require(!parameters[key].isLocked, "Parameter is locked");
        _;
    }

    modifier categoryExists(string memory categoryName) {
        require(bytes(categories[categoryName].name).length > 0, "Category does not exist");
        _;
    }

    modifier notEmergencyMode() {
        require(!emergencyMode, "System in emergency mode");
        _;
    }

    function createParameter(
        string memory key,
        string memory value,
        string memory dataType,
        string memory description,
        string memory categoryName,
        uint256 minValue,
        uint256 maxValue
    ) external onlyRole(CONFIG_MANAGER_ROLE) notEmergencyMode {
        require(bytes(parameters[key].key).length == 0, "Parameter already exists");
        require(bytes(categories[categoryName].name).length > 0, "Category does not exist");
        require(_isValidDataType(dataType), "Invalid data type");
        
        if (keccak256(abi.encodePacked(dataType)) == keccak256(abi.encodePacked("uint256"))) {
            uint256 numValue = _stringToUint(value);
            require(numValue >= minValue && numValue <= maxValue, "Value out of range");
        }

        parameters[key] = ConfigParameter({
            key: key,
            value: value,
            dataType: dataType,
            description: description,
            lastUpdated: block.timestamp,
            updatedBy: msg.sender,
            isLocked: false,
            minValue: minValue,
            maxValue: maxValue
        });

        allParameterKeys.push(key);
        categories[categoryName].parameterKeys.push(key);

        emit ParameterCreated(key, value, dataType);
    }

    function updateParameter(
        string memory key,
        string memory newValue
    ) external onlyRole(CONFIG_MANAGER_ROLE) parameterExists(key) parameterNotLocked(key) notEmergencyMode {
        _updateParameter(key, newValue);
    }

    function _updateParameter(
        string memory key,
        string memory newValue
    ) internal {
        ConfigParameter storage param = parameters[key];
        
        // Validate new value based on data type
        if (keccak256(abi.encodePacked(param.dataType)) == keccak256(abi.encodePacked("uint256"))) {
            uint256 numValue = _stringToUint(newValue);
            require(numValue >= param.minValue && numValue <= param.maxValue, "Value out of range");
        } else if (keccak256(abi.encodePacked(param.dataType)) == keccak256(abi.encodePacked("bool"))) {
            require(_isValidBool(newValue), "Invalid boolean value");
        } else if (keccak256(abi.encodePacked(param.dataType)) == keccak256(abi.encodePacked("address"))) {
            require(_isValidAddress(newValue), "Invalid address format");
        }

        string memory oldValue = param.value;
        param.value = newValue;
        param.lastUpdated = block.timestamp;
        param.updatedBy = msg.sender;

        emit ParameterUpdated(key, oldValue, newValue, msg.sender);
    }

    function lockParameter(string memory key) external onlyRole(ADMIN_ROLE) parameterExists(key) {
        parameters[key].isLocked = true;
        emit ParameterLocked(key, msg.sender);
    }

    function unlockParameter(string memory key) external onlyRole(ADMIN_ROLE) parameterExists(key) {
        parameters[key].isLocked = false;
        emit ParameterUnlocked(key, msg.sender);
    }

    function createCategory(
        string memory categoryName,
        string memory description
    ) external onlyRole(CONFIG_MANAGER_ROLE) {
        require(bytes(categories[categoryName].name).length == 0, "Category already exists");
        _createCategory(categoryName, description, true);
    }

    function updateCategory(
        string memory categoryName,
        bool isActive
    ) external onlyRole(CONFIG_MANAGER_ROLE) categoryExists(categoryName) {
        categories[categoryName].isActive = isActive;
        emit CategoryUpdated(categoryName, isActive);
    }

    function getParameter(string memory key) external view parameterExists(key) returns (
        string memory value,
        string memory dataType,
        string memory description,
        uint256 lastUpdated,
        address updatedBy,
        bool isLocked
    ) {
        ConfigParameter memory param = parameters[key];
        return (
            param.value,
            param.dataType,
            param.description,
            param.lastUpdated,
            param.updatedBy,
            param.isLocked
        );
    }

    function getParameterValue(string memory key) external view parameterExists(key) returns (string memory) {
        return parameters[key].value;
    }

    function getParameterAsUint(string memory key) external view parameterExists(key) returns (uint256) {
        require(
            keccak256(abi.encodePacked(parameters[key].dataType)) == keccak256(abi.encodePacked("uint256")),
            "Parameter is not uint256"
        );
        return _stringToUint(parameters[key].value);
    }

    function getParameterAsBool(string memory key) external view parameterExists(key) returns (bool) {
        require(
            keccak256(abi.encodePacked(parameters[key].dataType)) == keccak256(abi.encodePacked("bool")),
            "Parameter is not bool"
        );
        return keccak256(abi.encodePacked(parameters[key].value)) == keccak256(abi.encodePacked("true"));
    }

    function getParameterAsAddress(string memory key) external view parameterExists(key) returns (address) {
        require(
            keccak256(abi.encodePacked(parameters[key].dataType)) == keccak256(abi.encodePacked("address")),
            "Parameter is not address"
        );
        return _stringToAddress(parameters[key].value);
    }

    function getCategoryParameters(string memory categoryName) 
        external 
        view 
        categoryExists(categoryName) 
        returns (string[] memory) 
    {
        return categories[categoryName].parameterKeys;
    }

    function getAllParameters() external view returns (string[] memory) {
        return allParameterKeys;
    }

    function getAllCategories() external view returns (string[] memory) {
        return allCategoryNames;
    }

    function setEmergencyMode(bool enabled) external onlyRole(ADMIN_ROLE) {
        emergencyMode = enabled;
        emit EmergencyModeToggled(enabled, msg.sender);
    }

    function setEmergencyContact(address newContact) external onlyRole(ADMIN_ROLE) {
        require(newContact != address(0), "Invalid emergency contact");
        emergencyContact = newContact;
    }

    function incrementConfigVersion() external onlyRole(ADMIN_ROLE) {
        uint256 oldVersion = configVersion;
        configVersion++;
        emit ConfigVersionUpdated(oldVersion, configVersion);
    }

    function batchUpdateParameters(
        string[] memory keys,
        string[] memory values
    ) external onlyRole(CONFIG_MANAGER_ROLE) notEmergencyMode {
        require(keys.length == values.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < keys.length; i++) {
            if (bytes(parameters[keys[i]].key).length > 0 && !parameters[keys[i]].isLocked) {
                _updateParameter(keys[i], values[i]);
            }
        }
    }

    function _createCategory(
        string memory categoryName,
        string memory description,
        bool isActive
    ) internal {
        categories[categoryName] = ConfigCategory({
            name: categoryName,
            description: description,
            isActive: isActive,
            parameterKeys: new string[](0)
        });

        allCategoryNames.push(categoryName);
        emit CategoryCreated(categoryName, description);
    }

    function _initializeDefaultParameters() internal {
        // System parameters
        _createDefaultParameter("system", "platform_fee", "250", "uint256", "Platform fee in basis points", 0, 1000);
        _createDefaultParameter("system", "max_transaction_size", "1000000", "uint256", "Maximum transaction size in tokens", 1, 10000000);
        _createDefaultParameter("system", "maintenance_mode", "false", "bool", "System maintenance mode", 0, 0);
        
        // Security parameters
        _createDefaultParameter("security", "max_daily_transactions", "100", "uint256", "Maximum daily transactions per user", 1, 1000);
        _createDefaultParameter("security", "fraud_detection_enabled", "true", "bool", "Enable fraud detection", 0, 0);
        _createDefaultParameter("security", "blacklist_enabled", "true", "bool", "Enable address blacklisting", 0, 0);
        
        // DeFi parameters
        _createDefaultParameter("defi", "min_stake_amount", "1", "uint256", "Minimum stake amount in tokens", 1, 1000);
        _createDefaultParameter("defi", "max_stake_duration", "365", "uint256", "Maximum stake duration in days", 1, 1095);
        _createDefaultParameter("defi", "base_reward_rate", "1000", "uint256", "Base reward rate in basis points", 100, 5000);
        
        // Marketplace parameters
        _createDefaultParameter("marketplace", "listing_fee", "10", "uint256", "NFT listing fee in tokens", 0, 100);
        _createDefaultParameter("marketplace", "royalty_cap", "1000", "uint256", "Maximum royalty in basis points", 0, 2000);
        _createDefaultParameter("marketplace", "auction_min_duration", "3600", "uint256", "Minimum auction duration in seconds", 1800, 604800);
        
        // Social parameters
        _createDefaultParameter("social", "max_post_length", "500", "uint256", "Maximum post length in characters", 50, 2000);
        _createDefaultParameter("social", "enable_reactions", "true", "bool", "Enable post reactions", 0, 0);
        _createDefaultParameter("social", "max_followers", "10000", "uint256", "Maximum followers per user", 100, 100000);
    }

    function _createDefaultParameter(
        string memory categoryName,
        string memory key,
        string memory value,
        string memory dataType,
        string memory description,
        uint256 minValue,
        uint256 maxValue
    ) internal {
        parameters[key] = ConfigParameter({
            key: key,
            value: value,
            dataType: dataType,
            description: description,
            lastUpdated: block.timestamp,
            updatedBy: msg.sender,
            isLocked: false,
            minValue: minValue,
            maxValue: maxValue
        });

        allParameterKeys.push(key);
        categories[categoryName].parameterKeys.push(key);
    }

    function _isValidDataType(string memory dataType) internal pure returns (bool) {
        return (
            keccak256(abi.encodePacked(dataType)) == keccak256(abi.encodePacked("uint256")) ||
            keccak256(abi.encodePacked(dataType)) == keccak256(abi.encodePacked("string")) ||
            keccak256(abi.encodePacked(dataType)) == keccak256(abi.encodePacked("bool")) ||
            keccak256(abi.encodePacked(dataType)) == keccak256(abi.encodePacked("address"))
        );
    }

    function _isValidBool(string memory value) internal pure returns (bool) {
        return (
            keccak256(abi.encodePacked(value)) == keccak256(abi.encodePacked("true")) ||
            keccak256(abi.encodePacked(value)) == keccak256(abi.encodePacked("false"))
        );
    }

    function _isValidAddress(string memory value) internal pure returns (bool) {
        bytes memory valueBytes = bytes(value);
        if (valueBytes.length != 42) return false;
        if (valueBytes[0] != '0' || valueBytes[1] != 'x') return false;
        
        for (uint256 i = 2; i < 42; i++) {
            bytes1 char = valueBytes[i];
            if (!(char >= '0' && char <= '9') && !(char >= 'a' && char <= 'f') && !(char >= 'A' && char <= 'F')) {
                return false;
            }
        }
        return true;
    }

    function _stringToUint(string memory s) internal pure returns (uint256) {
        bytes memory b = bytes(s);
        uint256 result = 0;
        for (uint256 i = 0; i < b.length; i++) {
            uint256 c = uint256(uint8(b[i]));
            if (c >= 48 && c <= 57) {
                result = result * 10 + (c - 48);
            }
        }
        return result;
    }

    function _stringToAddress(string memory s) internal pure returns (address) {
        bytes memory _bytes = _hexStringToBytes(s);
        require(_bytes.length == 20, "Invalid address length");
        
        address addr;
        assembly {
            addr := mload(add(_bytes, 20))
        }
        return addr;
    }

    function _hexStringToBytes(string memory s) internal pure returns (bytes memory) {
        bytes memory ss = bytes(s);
        require(ss.length % 2 == 0, "Invalid hex string length");
        
        bytes memory r = new bytes(ss.length / 2);
        for (uint256 i = 0; i < ss.length / 2; ++i) {
            r[i] = bytes1(_fromHexChar(uint8(ss[2 * i])) * 16 + _fromHexChar(uint8(ss[2 * i + 1])));
        }
        return r;
    }

    function _fromHexChar(uint8 c) internal pure returns (uint8) {
        if (bytes1(c) >= bytes1('0') && bytes1(c) <= bytes1('9')) {
            return c - uint8(bytes1('0'));
        }
        if (bytes1(c) >= bytes1('a') && bytes1(c) <= bytes1('f')) {
            return 10 + c - uint8(bytes1('a'));
        }
        if (bytes1(c) >= bytes1('A') && bytes1(c) <= bytes1('F')) {
            return 10 + c - uint8(bytes1('A'));
        }
        revert("Invalid hex character");
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
