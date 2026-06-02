const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("NFTOffers", function () {
    let nftOffers;
    let bezToken;
    let mockNFT;
    let owner;
    let offerer;
    let nftOwner;
    let feeRecipient;

    const OFFER_AMOUNT = ethers.parseUnits("50", 18); // 50 BEZ
    const COUNTER_AMOUNT = ethers.parseUnits("60", 18); // 60 BEZ
    const DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

    beforeEach(async function () {
        [owner, offerer, nftOwner, feeRecipient] = await ethers.getSigners();

        // Deploy mock BEZ token
        const MockERC20 = await ethers.getContractFactory("BezhasToken");
        bezToken = await MockERC20.deploy(owner.address);

        // Deploy mock NFT
        const MockNFT = await ethers.getContractFactory("BezhasNFT");
        mockNFT = await MockNFT.deploy();

        // Deploy NFTOffers contract
        const NFTOffers = await ethers.getContractFactory("NFTOffers");
        nftOffers = await NFTOffers.deploy(
            await bezToken.getAddress(),
            feeRecipient.address
        );

        // Mint NFT to nftOwner
        await mockNFT.safeMint(nftOwner.address, "ipfs://test-uri");

        // Transfer BEZ tokens to offerer and nftOwner
        await bezToken.transfer(offerer.address, ethers.parseUnits("1000", 18));
        await bezToken.transfer(nftOwner.address, ethers.parseUnits("1000", 18));
    });

    describe("Creating Offers", function () {
        it("Should create an offer successfully", async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;

            // Approve payment
            await bezToken.connect(offerer).approve(await nftOffers.getAddress(), OFFER_AMOUNT);

            const tx = await nftOffers.connect(offerer).createOffer(
                nftAddress,
                tokenId,
                OFFER_AMOUNT,
                DURATION,
                "I really want this NFT!"
            );

            await expect(tx)
                .to.emit(nftOffers, "OfferCreated")
                .withArgs(1, offerer.address, nftAddress, tokenId, OFFER_AMOUNT);

            // Check funds are escrowed
            expect(await nftOffers.escrowedFunds(1)).to.equal(OFFER_AMOUNT);

            // Check offer details
            const offer = await nftOffers.offers(1);
            expect(offer.offerer).to.equal(offerer.address);
            expect(offer.nftOwner).to.equal(nftOwner.address);
            expect(offer.offerAmount).to.equal(OFFER_AMOUNT);
            expect(offer.message).to.equal("I really want this NFT!");
        });

        it("Should reject offer for own NFT", async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;

            await bezToken.connect(nftOwner).approve(await nftOffers.getAddress(), OFFER_AMOUNT);

            await expect(
                nftOffers.connect(nftOwner).createOffer(
                    nftAddress,
                    tokenId,
                    OFFER_AMOUNT,
                    DURATION,
                    ""
                )
            ).to.be.revertedWith("No puedes ofertar tu propio NFT");
        });

        it("Should reject offer with invalid duration", async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;

            await bezToken.connect(offerer).approve(await nftOffers.getAddress(), OFFER_AMOUNT);

            // Duration too short
            await expect(
                nftOffers.connect(offerer).createOffer(nftAddress, tokenId,
                    OFFER_AMOUNT,
                    30 * 60, // 30 minutes
                    ""
                )
            ).to.be.revertedWith("Duracion invalida");

            // Duration too long
            await expect(
                nftOffers.connect(offerer).createOffer(nftAddress, tokenId,
                    OFFER_AMOUNT,
                    31 * 24 * 60 * 60, // 31 days
                    ""
                )
            ).to.be.revertedWith("Duracion invalida");
        });

        it("Should reject offer with zero amount", async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;

            await expect(
                nftOffers.connect(offerer).createOffer(nftAddress, tokenId,
                    0,
                    DURATION,
                    ""
                )
            ).to.be.revertedWith("Monto debe ser mayor a 0");
        });
    });

    describe("Counter Offers", function () {
        let offerId;

        beforeEach(async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;
            await bezToken.connect(offerer).approve(await nftOffers.getAddress(), OFFER_AMOUNT);

            const tx = await nftOffers.connect(offerer).createOffer(nftAddress, tokenId,
                OFFER_AMOUNT,
                DURATION,
                "Initial offer"
            );
            const receipt = await tx.wait();
            offerId = 1;
        });

        it("Should create counter offer successfully", async function () {
            const tx = await nftOffers.connect(nftOwner).createCounterOffer(
                offerId,
                COUNTER_AMOUNT,
                "How about this?",
                DURATION
            );

            await expect(tx)
                .to.emit(nftOffers, "CounterOfferCreated")
                .withArgs(offerId, COUNTER_AMOUNT);

            const offer = await nftOffers.offers(offerId);
            expect(offer.status).to.equal(1); // Countered status

            const counter = await nftOffers.counterOffers(offerId);
            expect(counter.counterAmount).to.equal(COUNTER_AMOUNT);
            expect(counter.isActive).to.be.true;
        });

        it("Should reject counter offer from non-owner", async function () {
            await expect(
                nftOffers.connect(offerer).createCounterOffer(
                    offerId,
                    COUNTER_AMOUNT,
                    "Counter",
                    DURATION
                )
            ).to.be.revertedWith("No eres el owner del NFT");
        });

        it("Should reject counter offer less than original", async function () {
            await expect(
                nftOffers.connect(nftOwner).createCounterOffer(
                    offerId,
                    OFFER_AMOUNT - 1n,
                    "Lower counter",
                    DURATION
                )
            ).to.be.revertedWith("Contraoferta debe ser mayor");
        });
    });

    describe("Accepting Offers", function () {
        let offerId;
        const tokenId = 0;

        beforeEach(async function () {
            const nftAddress = await mockNFT.getAddress();
            await bezToken.connect(offerer).approve(await nftOffers.getAddress(), OFFER_AMOUNT);

            await nftOffers.connect(offerer).createOffer(nftAddress, tokenId,
                OFFER_AMOUNT,
                DURATION,
                "Offer"
            );
            offerId = 1;
        });

        it("Should accept offer and transfer NFT", async function () {
            // Approve NFT transfer
            await mockNFT.connect(nftOwner).approve(await nftOffers.getAddress(), tokenId);

            const initialOwnerBalance = await bezToken.balanceOf(nftOwner.address);
            const initialFeeBalance = await bezToken.balanceOf(feeRecipient.address);

            const tx = await nftOffers.connect(nftOwner).acceptOffer(offerId);

            await expect(tx).to.emit(nftOffers, "OfferAccepted");

            // Check NFT transferred
            expect(await mockNFT.ownerOf(tokenId)).to.equal(offerer.address);

            // Check payment distributed (minus 2.5% fee)
            const fee = OFFER_AMOUNT * 250n / 10000n;
            const sellerAmount = OFFER_AMOUNT - fee;

            expect(await bezToken.balanceOf(nftOwner.address) - initialOwnerBalance).to.equal(sellerAmount);
            expect(await bezToken.balanceOf(feeRecipient.address) - initialFeeBalance).to.equal(fee);

            // Check escrow cleared
            expect(await nftOffers.escrowedFunds(offerId)).to.equal(0);

            // Check offer status
            const offer = await nftOffers.offers(offerId);
            expect(offer.status).to.equal(2); // Accepted
        });

        it("Should accept counter offer with additional payment", async function () {
            // Create counter offer
            await nftOffers.connect(nftOwner).createCounterOffer(
                offerId,
                COUNTER_AMOUNT,
                "Counter",
                DURATION
            );

            // Approve additional payment
            const difference = COUNTER_AMOUNT - OFFER_AMOUNT;
            await bezToken.connect(offerer).approve(await nftOffers.getAddress(), difference);

            // Approve NFT transfer
            await mockNFT.connect(nftOwner).approve(await nftOffers.getAddress(), tokenId);

            const tx = await nftOffers.connect(offerer).acceptCounterOffer(offerId);

            await expect(tx).to.emit(nftOffers, "OfferAccepted");

            // Check NFT transferred
            expect(await mockNFT.ownerOf(tokenId)).to.equal(offerer.address);
        });

        it("Should not allow non-owner to accept offer", async function () {
            await expect(
                nftOffers.connect(offerer).acceptOffer(offerId)
            ).to.be.revertedWith("No eres el owner del NFT");
        });
    });

    describe("Rejecting and Cancelling Offers", function () {
        let offerId;

        beforeEach(async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;
            await bezToken.connect(offerer).approve(await nftOffers.getAddress(), OFFER_AMOUNT);

            await nftOffers.connect(offerer).createOffer(nftAddress, tokenId,
                OFFER_AMOUNT,
                DURATION,
                "Offer"
            );
            offerId = 1;
        });

        it("Should reject offer and refund offerer", async function () {
            const initialBalance = await bezToken.balanceOf(offerer.address);

            const tx = await nftOffers.connect(nftOwner).rejectOffer(offerId);

            await expect(tx).to.emit(nftOffers, "OfferRejected");

            // Check refund
            expect(await bezToken.balanceOf(offerer.address) - initialBalance).to.equal(OFFER_AMOUNT);

            // Check offer status
            const offer = await nftOffers.offers(offerId);
            expect(offer.status).to.equal(3); // Rejected
        });

        it("Should allow offerer to cancel offer", async function () {
            const initialBalance = await bezToken.balanceOf(offerer.address);

            const tx = await nftOffers.connect(offerer).cancelOffer(offerId);

            await expect(tx).to.emit(nftOffers, "OfferCancelled");

            // Check refund
            expect(await bezToken.balanceOf(offerer.address) - initialBalance).to.equal(OFFER_AMOUNT);

            // Check offer status
            const offer = await nftOffers.offers(offerId);
            expect(offer.status).to.equal(4); // Cancelled
        });

        it("Should not allow non-owner to reject", async function () {
            await expect(
                nftOffers.connect(offerer).rejectOffer(offerId)
            ).to.be.revertedWith("No eres el owner");
        });
    });

    describe("Expiring Offers", function () {
        let offerId;

        beforeEach(async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;
            await bezToken.connect(offerer).approve(await nftOffers.getAddress(), OFFER_AMOUNT);

            await nftOffers.connect(offerer).createOffer(nftAddress, tokenId,
                OFFER_AMOUNT,
                DURATION,
                "Offer"
            );
            offerId = 1;
        });

        it("Should expire offer after duration", async function () {
            // Advance time beyond expiration
            await time.increase(DURATION + 1);

            const initialBalance = await bezToken.balanceOf(offerer.address);

            const tx = await nftOffers.expireOffer(offerId);

            await expect(tx).to.emit(nftOffers, "OfferExpired");

            // Check refund
            expect(await bezToken.balanceOf(offerer.address) - initialBalance).to.equal(OFFER_AMOUNT);

            // Check offer status
            const offer = await nftOffers.offers(offerId);
            expect(offer.status).to.equal(5); // Expired
        });

        it("Should batch expire multiple offers", async function () {
            // Create another offer
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;
            await bezToken.connect(offerer).approve(await nftOffers.getAddress(), OFFER_AMOUNT);
            await nftOffers.connect(offerer).createOffer(
                nftAddress,
                tokenId,
                OFFER_AMOUNT,
                DURATION,
                "Second offer"
            );

            // Advance time
            await time.increase(DURATION + 1);

            const tx = await nftOffers.batchExpireOffers([1, 2]);

            // Should expire both
            const offer1 = await nftOffers.offers(1);
            const offer2 = await nftOffers.offers(2);

            expect(offer1.status).to.equal(5); // Expired
            expect(offer2.status).to.equal(5); // Expired
        });

        it("Should not allow expiring non-expired offer", async function () {
            await expect(
                nftOffers.expireOffer(offerId)
            ).to.be.revertedWith("Oferta aun no expira");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;

            // Create multiple offers
            await bezToken.connect(offerer).approve(await nftOffers.getAddress(), OFFER_AMOUNT * 2n);

            await nftOffers.connect(offerer).createOffer(nftAddress, tokenId,
                OFFER_AMOUNT,
                DURATION,
                "Offer 1"
            );
        });

        it("Should get NFT offers", async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;
            const offers = await nftOffers.getNFTOffers(nftAddress, tokenId);

            expect(offers.length).to.equal(1);
            expect(offers[0].offerer).to.equal(offerer.address);
        });

        it("Should get user offers", async function () {
            const offers = await nftOffers.getUserOffers(offerer.address);

            expect(offers.length).to.equal(1);
            expect(offers[0].offerer).to.equal(offerer.address);
        });

        it("Should get received offers", async function () {
            const offers = await nftOffers.getReceivedOffers(nftOwner.address);

            expect(offers.length).to.equal(1);
            expect(offers[0].nftOwner).to.equal(nftOwner.address);
        });
    });

    describe("Protocol Configuration", function () {
        it("Should update protocol fee", async function () {
            const newFee = 300; // 3%

            await nftOffers.updateProtocolFee(newFee);

            expect(await nftOffers.protocolFee()).to.equal(newFee);
        });

        it("Should not allow fee above 10%", async function () {
            await expect(
                nftOffers.updateProtocolFee(1001)
            ).to.be.revertedWith("Fee maximo 10%");
        });

        it("Should update offer durations", async function () {
            const newMin = 2 * 60 * 60; // 2 hours
            const newMax = 15 * 24 * 60 * 60; // 15 days

            await nftOffers.updateOfferDurations(newMin, newMax);

            expect(await nftOffers.minOfferDuration()).to.equal(newMin);
            expect(await nftOffers.maxOfferDuration()).to.equal(newMax);
        });
    });
});





