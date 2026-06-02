// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LogisticsContainer
 * @dev Smart contract for tracking logistics containers and their status.
 */
contract LogisticsContainer {
    struct Container {
        string containerId;
        string location;
        string status;
        address owner;
        uint256 lastUpdate;
        string contents;
        string origin;
        string metadataURI; // IPFS link for documents/photos
    }

    mapping(string => Container) public containers;
    event ContainerCreated(string containerId, address indexed owner);
    event ContainerUpdated(string containerId, string location, string status, uint256 lastUpdate);
    event ContainerMinted(string containerId, address indexed owner, string metadataURI);

    modifier onlyOwner(string memory containerId) {
        require(containers[containerId].owner == msg.sender, "Not container owner");
        _;
    }

    function mintContainer(
        address owner,
        string memory containerId,
        string memory contents,
        string memory origin,
        string memory metadataURI
    ) external {
        require(containers[containerId].owner == address(0), "Container already exists");
        containers[containerId] = Container({
            containerId: containerId,
            location: origin,
            status: "Created",
            owner: owner,
            lastUpdate: block.timestamp,
            contents: contents,
            origin: origin,
            metadataURI: metadataURI
        });
        emit ContainerMinted(containerId, owner, metadataURI);
    }

    function createContainer(string memory containerId, string memory location, string memory status) external {
        require(containers[containerId].owner == address(0), "Container already exists");
        containers[containerId] = Container({
            containerId: containerId,
            location: location,
            status: status,
            owner: msg.sender,
            lastUpdate: block.timestamp,
            contents: "",
            origin: location,
            metadataURI: ""
        });
        emit ContainerCreated(containerId, msg.sender);
    }

    function updateContainer(string memory containerId, string memory location, string memory status) external onlyOwner(containerId) {
        require(containers[containerId].owner != address(0), "Container does not exist");
        containers[containerId].location = location;
        containers[containerId].status = status;
        containers[containerId].lastUpdate = block.timestamp;
        emit ContainerUpdated(containerId, location, status, block.timestamp);
    }

    function getContainer(string memory containerId) external view returns (Container memory) {
        require(containers[containerId].owner != address(0), "Container does not exist");
        return containers[containerId];
    }
}
