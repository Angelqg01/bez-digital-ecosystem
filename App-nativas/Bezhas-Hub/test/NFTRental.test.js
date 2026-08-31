const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("NFTRental", function () {
    let nftRental;
    let bezToken;
    let mockNFT;
    let owner;
    let renter;
    let feeRecipient;
    let nftOwner;

    const PRICE_PER_DAY = ethers.parseUnits("10", 18); // 10 BEZ per day
    const MIN_DAYS = 1;
    const MAX_DAYS = 30;
    const COLLATERAL = ethers.parseUnits("100", 18); // 100 BEZ collateral

    beforeEach(async function () {
        [owner, renter, feeRecipient, nftOwner] = await ethers.getSigners();

        // Deploy mock BEZ token
        const MockERC20 = await ethers.getContractFactory("BezhasToken");
        bezToken = await MockERC20.deploy(owner.address);

        // Deploy mock NFT
        const MockNFT = await ethers.getContractFactory("BezhasNFT");
        mockNFT = await MockNFT.deploy();

        // Deploy NFTRental contract
        const NFTRental = await ethers.getContractFactory("NFTRental");
        nftRental = await NFTRental.deploy(
            await bezToken.getAddress(),
            feeRecipient.address
        );

        // Mint NFT to nftOwner
        await mockNFT.safeMint(nftOwner.address, "ipfs://test-uri");

        // Transfer BEZ tokens to renter for testing
        await bezToken.transfer(renter.address, ethers.parseUnits("1000", 18));

        // Allow NFT contract in rental system
        await nftRental.allowNFTContract(await mockNFT.getAddress(), true);
    });

    describe("Listing NFTs", function () {
        it("Should list an NFT for rent", async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0; // First minted NFT has tokenId 0

            // Approve NFT transfer to rental contract
            await mockNFT.connect(nftOwner).approve(await nftRental.getAddress(), tokenId);

            // List NFT
            const tx = await nftRental.connect(nftOwner).listNFTForRent(
                nftAddress,
                tokenId,
                PRICE_PER_DAY,
                MIN_DAYS,
                MAX_DAYS,
                COLLATERAL
            );

            await expect(tx)
                .to.emit(nftRental, "NFTListed")
                .withArgs(
                    ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [nftAddress, tokenId])),
                    nftOwner.address,
                    nftAddress,
                    tokenId,
                    PRICE_PER_DAY
                );

            // Check NFT is now owned by rental contract
            expect(await mockNFT.ownerOf(tokenId)).to.equal(await nftRental.getAddress());
        });

        it("Should reject listing with invalid parameters", async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;

            await mockNFT.connect(nftOwner).approve(await nftRental.getAddress(), tokenId);

            // Invalid price (0)
            await expect(
                nftRental.connect(nftOwner).listNFTForRent(
                    nftAddress,
                    tokenId,
                    0,
                    MIN_DAYS,
                    MAX_DAYS,
                    COLLATERAL
                )
            ).to.be.revertedWith("Precio debe ser mayor a 0");

            // Invalid days (min > max)
            await expect(
                nftRental.connect(nftOwner).listNFTForRent(
                    nftAddress,
                    tokenId,
                    PRICE_PER_DAY,
                    31,
                    30,
                    COLLATERAL
                )
            ).to.be.revertedWith("Max debe ser >= Min");
        });

        it("Should not allow listing non-approved NFT contracts", async function () {
            // Deploy new NFT contract (not approved)
            const NewNFT = await ethers.getContractFactory("BezhasNFT");
            const newNFT = await NewNFT.deploy();
            await newNFT.safeMint(nftOwner.address, "ipfs://test");

            await newNFT.connect(nftOwner).approve(await nftRental.getAddress(), 0);

            await expect(
                nftRental.connect(nftOwner).listNFTForRent(
                    await newNFT.getAddress(),
                    1,
                    PRICE_PER_DAY,
                    MIN_DAYS,
                    MAX_DAYS,
                    COLLATERAL
                )
            ).to.be.revertedWith("NFT contract no permitido");
        });
    });

    describe("Renting NFTs", function () {
        let listingId;
        let nftAddress;
        let tokenId;
        const RENTAL_DAYS = 7;

        beforeEach(async function () {
            nftAddress = await mockNFT.getAddress();
            tokenId = 0;

            await mockNFT.connect(nftOwner).approve(await nftRental.getAddress(), tokenId);

            // Capturar el listingId del valor de retorno
            listingId = await nftRental.connect(nftOwner).listNFTForRent.staticCall(
                nftAddress,
                tokenId,
                PRICE_PER_DAY,
                MIN_DAYS,
                MAX_DAYS,
                COLLATERAL
            );

            // Ejecutar la transacción real
            await nftRental.connect(nftOwner).listNFTForRent(
                nftAddress,
                tokenId,
                PRICE_PER_DAY,
                MIN_DAYS,
                MAX_DAYS,
                COLLATERAL
            );
        });

        it("Should rent an NFT successfully", async function () {
            const totalCost = PRICE_PER_DAY * BigInt(RENTAL_DAYS) + COLLATERAL;

            // Approve payment
            await bezToken.connect(renter).approve(await nftRental.getAddress(), totalCost);

            const tx = await nftRental.connect(renter).rentNFT(listingId, RENTAL_DAYS);

            await expect(tx).to.emit(nftRental, "NFTRented");

            // Check NFT ownership transferred to renter
            expect(await mockNFT.ownerOf(tokenId)).to.equal(renter.address);
        });

        it("Should reject rental with insufficient payment", async function () {
            const insufficientAmount = PRICE_PER_DAY * BigInt(RENTAL_DAYS);

            await bezToken.connect(renter).approve(await nftRental.getAddress(), insufficientAmount);

            await expect(
                nftRental.connect(renter).rentNFT(listingId, RENTAL_DAYS)
            ).to.be.reverted;
        });

        it("Should reject rental for invalid number of days", async function () {
            const totalCost = PRICE_PER_DAY * BigInt(RENTAL_DAYS) + COLLATERAL;
            await bezToken.connect(renter).approve(await nftRental.getAddress(), totalCost);

            // Less than minimum
            await expect(
                nftRental.connect(renter).rentNFT(listingId, 0)
            ).to.be.revertedWith("Dias de renta invalidos");

            // More than maximum
            await expect(
                nftRental.connect(renter).rentNFT(listingId, 31)
            ).to.be.revertedWith("Dias de renta invalidos");
        });
    });

    describe("Returning NFTs", function () {
        let listingId;
        let rentalId;
        let nftAddress;
        let tokenId;
        const RENTAL_DAYS = 7;

        beforeEach(async function () {
            nftAddress = await mockNFT.getAddress();
            tokenId = 0;

            // List NFT
            await mockNFT.connect(nftOwner).approve(await nftRental.getAddress(), tokenId);
            listingId = await nftRental.connect(nftOwner).listNFTForRent.staticCall(
                nftAddress,
                tokenId,
                PRICE_PER_DAY,
                MIN_DAYS,
                MAX_DAYS,
                COLLATERAL
            );
            await nftRental.connect(nftOwner).listNFTForRent(
                nftAddress,
                tokenId,
                PRICE_PER_DAY,
                MIN_DAYS,
                MAX_DAYS,
                COLLATERAL
            );

            // Rent NFT
            const totalCost = PRICE_PER_DAY * BigInt(RENTAL_DAYS) + COLLATERAL;
            await bezToken.connect(renter).approve(await nftRental.getAddress(), totalCost);

            const rentTx = await nftRental.connect(renter).rentNFT(listingId, RENTAL_DAYS);
            const rentReceipt = await rentTx.wait();

            // Capturar rentalId del evento NFTRented
            const rentedEvent = rentReceipt.logs.find(
                log => log.fragment && log.fragment.name === 'NFTRented'
            );
            rentalId = rentedEvent.args[0]; // primer argumento es rentalId
        });

        it("Should return NFT on time and get full collateral back", async function () {
            const initialBalance = await bezToken.balanceOf(renter.address);

            // Approve NFT return
            await mockNFT.connect(renter).approve(await nftRental.getAddress(), tokenId);

            const tx = await nftRental.connect(renter).returnNFT(rentalId);

            await expect(tx).to.emit(nftRental, "NFTReturned");

            // Check collateral returned
            const finalBalance = await bezToken.balanceOf(renter.address);
            expect(finalBalance - initialBalance).to.equal(COLLATERAL);

            // Check NFT back in contract escrow
            expect(await mockNFT.ownerOf(tokenId)).to.equal(await nftRental.getAddress());
        });

        it("Should apply penalty for late return", async function () {
            // Advance time beyond rental period
            await time.increase(RENTAL_DAYS * 24 * 60 * 60 + 24 * 60 * 60); // 1 day late

            const initialBalance = await bezToken.balanceOf(renter.address);

            await mockNFT.connect(renter).approve(await nftRental.getAddress(), tokenId);
            await nftRental.connect(renter).returnNFT(rentalId);

            const finalBalance = await bezToken.balanceOf(renter.address);
            // Contract calculates: daysLate = (timeLate / 1 days) + 1
            // So 1 day late = (86400 / 86400) + 1 = 2 days penalty
            const penalty = COLLATERAL * 10n * 2n / 100n; // 10% per day * 2 days = 20%
            const expectedReturn = COLLATERAL - penalty;

            expect(finalBalance - initialBalance).to.equal(expectedReturn);
        });

        it("Should allow owner to claim overdue NFT after grace period", async function () {
            // Advance time beyond rental + 7 day grace period
            await time.increase((RENTAL_DAYS + 8) * 24 * 60 * 60);

            const tx = await nftRental.connect(nftOwner).claimOverdueNFT(rentalId);

            await expect(tx).to.changeTokenBalance(bezToken, nftOwner, COLLATERAL);
        });
    });

    describe("Listing Management", function () {
        let listingId;
        let nftAddress;
        let tokenId;

        beforeEach(async function () {
            nftAddress = await mockNFT.getAddress();
            tokenId = 0;
            await mockNFT.connect(nftOwner).approve(await nftRental.getAddress(), tokenId);

            listingId = await nftRental.connect(nftOwner).listNFTForRent.staticCall(
                nftAddress,
                tokenId,
                PRICE_PER_DAY,
                MIN_DAYS,
                MAX_DAYS,
                COLLATERAL
            );
            await nftRental.connect(nftOwner).listNFTForRent(
                nftAddress,
                tokenId,
                PRICE_PER_DAY,
                MIN_DAYS,
                MAX_DAYS,
                COLLATERAL
            );
        });

        it("Should allow owner to cancel listing", async function () {
            const tx = await nftRental.connect(nftOwner).cancelListing(listingId);

            await expect(tx).to.emit(nftRental, "ListingCancelled");

            // NFT should be returned to owner
            expect(await mockNFT.ownerOf(tokenId)).to.equal(nftOwner.address);
        });

        it("Should allow owner to update listing price", async function () {
            const newPrice = ethers.parseUnits("15", 18);

            const tx = await nftRental.connect(nftOwner).updateListingPrice(listingId, newPrice);

            await expect(tx)
                .to.emit(nftRental, "ListingUpdated")
                .withArgs(listingId, newPrice);
        });

        it("Should not allow non-owner to cancel listing", async function () {
            await expect(
                nftRental.connect(renter).cancelListing(listingId)
            ).to.be.revertedWith("No eres el owner");
        });
    });

    describe("View Functions", function () {
        it("Should get owner listings", async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;
            await mockNFT.connect(nftOwner).approve(await nftRental.getAddress(), tokenId);

            await nftRental.connect(nftOwner).listNFTForRent(
                nftAddress,
                tokenId,
                PRICE_PER_DAY,
                MIN_DAYS,
                MAX_DAYS,
                COLLATERAL
            );

            const listings = await nftRental.getOwnerListings(nftOwner.address);

            expect(listings.length).to.equal(1);
            expect(listings[0].owner).to.equal(nftOwner.address);
            expect(listings[0].pricePerDay).to.equal(PRICE_PER_DAY);
        });
    });

    describe("Protocol Configuration", function () {
        it("Should update protocol fee", async function () {
            const newFee = 300; // 3%

            await nftRental.updateProtocolFee(newFee);

            expect(await nftRental.protocolFee()).to.equal(newFee);
        });

        it("Should not allow fee above 10%", async function () {
            await expect(
                nftRental.updateProtocolFee(1001)
            ).to.be.revertedWith("Fee maximo 10%");
        });

        it("Should update fee recipient", async function () {
            const [_, newRecipient] = await ethers.getSigners();

            await nftRental.updateFeeRecipient(newRecipient.address);

            expect(await nftRental.feeRecipient()).to.equal(newRecipient.address);
        });
    });
});
