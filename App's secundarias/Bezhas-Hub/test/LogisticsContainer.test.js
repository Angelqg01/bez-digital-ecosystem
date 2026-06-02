const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LogisticsContainer", function () {
    let logistics;
    let owner;
    let operator;
    let user;

    beforeEach(async function () {
        [owner, operator, user] = await ethers.getSigners();

        const LogisticsContainer = await ethers.getContractFactory("LogisticsContainer");
        logistics = await LogisticsContainer.deploy();
    });

    describe("Container Creation", function () {
        it("Should create a basic container", async function () {
            const containerId = "CONT-001";
            const location = "Port of Shanghai";
            const status = "Created";

            const tx = await logistics.createContainer(containerId, location, status);

            await expect(tx)
                .to.emit(logistics, "ContainerCreated")
                .withArgs(containerId, owner.address);

            const container = await logistics.getContainer(containerId);
            expect(container.containerId).to.equal(containerId);
            expect(container.location).to.equal(location);
            expect(container.status).to.equal(status);
            expect(container.owner).to.equal(owner.address);
        });

        it("Should mint a container with metadata", async function () {
            const containerId = "CONT-002";
            const contents = "Electronics";
            const origin = "Shenzhen";
            const metadataURI = "ipfs://QmTest123";

            const tx = await logistics.mintContainer(
                user.address,
                containerId,
                contents,
                origin,
                metadataURI
            );

            await expect(tx)
                .to.emit(logistics, "ContainerMinted")
                .withArgs(containerId, user.address, metadataURI);

            const container = await logistics.getContainer(containerId);
            expect(container.owner).to.equal(user.address);
            expect(container.contents).to.equal(contents);
            expect(container.origin).to.equal(origin);
            expect(container.metadataURI).to.equal(metadataURI);
        });

        it("Should reject duplicate container IDs", async function () {
            const containerId = "CONT-003";

            await logistics.createContainer(containerId, "Location A", "Created");

            await expect(
                logistics.createContainer(containerId, "Location B", "Created")
            ).to.be.revertedWith("Container already exists");
        });
    });

    describe("Container Updates", function () {
        const containerId = "CONT-004";

        beforeEach(async function () {
            await logistics.createContainer(containerId, "Port A", "Created");
        });

        it("Should update container location and status", async function () {
            const newLocation = "Port B";
            const newStatus = "In Transit";

            const tx = await logistics.updateContainer(containerId, newLocation, newStatus);

            await expect(tx)
                .to.emit(logistics, "ContainerUpdated");

            const container = await logistics.getContainer(containerId);
            expect(container.location).to.equal(newLocation);
            expect(container.status).to.equal(newStatus);
        });

        it("Should only allow owner to update container", async function () {
            await expect(
                logistics.connect(user).updateContainer(containerId, "Port C", "Delivered")
            ).to.be.revertedWith("Not container owner");
        });

        it("Should reject updates to non-existent container", async function () {
            // Contract checks ownership first, so it reverts with "Not container owner"
            // when trying to update a non-existent container
            await expect(
                logistics.updateContainer("FAKE-CONTAINER", "Location", "Status")
            ).to.be.revertedWith("Not container owner");
        });

        it("Should track last update timestamp", async function () {
            const beforeUpdate = await ethers.provider.getBlock('latest');

            await logistics.updateContainer(containerId, "New Location", "Updated");

            const container = await logistics.getContainer(containerId);
            expect(container.lastUpdate).to.be.at.least(beforeUpdate.timestamp);
        });
    });

    describe("Container Queries", function () {
        it("Should retrieve container details correctly", async function () {
            const containerId = "CONT-005";
            const location = "Rotterdam";
            const status = "Customs Cleared";
            const contents = "Automotive Parts";
            const origin = "Stuttgart";
            const metadataURI = "ipfs://QmDocuments";

            await logistics.mintContainer(
                owner.address,
                containerId,
                contents,
                origin,
                metadataURI
            );

            const container = await logistics.getContainer(containerId);

            expect(container.containerId).to.equal(containerId);
            expect(container.location).to.equal(origin);
            expect(container.status).to.equal("Created");
            expect(container.owner).to.equal(owner.address);
            expect(container.contents).to.equal(contents);
            expect(container.origin).to.equal(origin);
            expect(container.metadataURI).to.equal(metadataURI);
        });

        it("Should reject query for non-existent container", async function () {
            await expect(
                logistics.getContainer("NON-EXISTENT")
            ).to.be.revertedWith("Container does not exist");
        });
    });

    describe("Container Lifecycle", function () {
        it("Should track complete shipment lifecycle", async function () {
            const containerId = "CONT-LIFECYCLE";

            // 1. Creation
            await logistics.createContainer(containerId, "Factory Suzhou", "Picked Up");
            let container = await logistics.getContainer(containerId);
            expect(container.status).to.equal("Picked Up");

            // 2. Gate In
            await logistics.updateContainer(containerId, "Port of Shanghai", "Gate In");
            container = await logistics.getContainer(containerId);
            expect(container.status).to.equal("Gate In");

            // 3. Loaded
            await logistics.updateContainer(containerId, "Port of Shanghai", "Loaded");
            container = await logistics.getContainer(containerId);
            expect(container.status).to.equal("Loaded");

            // 4. In Transit
            await logistics.updateContainer(containerId, "Pacific Ocean", "In Transit");
            container = await logistics.getContainer(containerId);
            expect(container.status).to.equal("In Transit");

            // 5. Arrival
            await logistics.updateContainer(containerId, "Port of Los Angeles", "Arrival");
            container = await logistics.getContainer(containerId);
            expect(container.status).to.equal("Arrival");

            // 6. Delivered
            await logistics.updateContainer(containerId, "Warehouse LA", "Delivered");
            container = await logistics.getContainer(containerId);
            expect(container.status).to.equal("Delivered");
            expect(container.location).to.equal("Warehouse LA");
        });
    });

    describe("Gas Optimization", function () {
        it("Should be gas efficient for basic operations", async function () {
            const containerId = "CONT-GAS-TEST";

            const createTx = await logistics.createContainer(
                containerId,
                "Location",
                "Status"
            );
            const createReceipt = await createTx.wait();

            // Container creation should use less than 200k gas
            // (includes ERC721 minting + metadata storage)
            expect(createReceipt.gasUsed).to.be.lessThan(200000n);

            const updateTx = await logistics.updateContainer(
                containerId,
                "New Location",
                "New Status"
            );
            const updateReceipt = await updateTx.wait();

            // Update should use less than 100k gas
            expect(updateReceipt.gasUsed).to.be.lessThan(100000n);
        });
    });
});
