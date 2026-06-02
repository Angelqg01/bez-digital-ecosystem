const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NFTRental Referral System", function () {
    let nftRental;
    let bezToken;
    let mockNFT;
    let owner;
    let renter;
    let referrer;
    let feeRecipient;
    let nftOwner;

    const PRICE_PER_DAY = ethers.parseUnits("100", 18); // 100 BEZ per day (easy for % calc)
    const MIN_DAYS = 1;
    const MAX_DAYS = 30;
    const COLLATERAL = ethers.parseUnits("0", 18); // 0 collateral for simpler fee checks

    beforeEach(async function () {
        [owner, renter, referrer, feeRecipient, nftOwner] = await ethers.getSigners();

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
        await bezToken.transfer(renter.address, ethers.parseUnits("10000", 18));

        // Allow NFT contract in rental system
        await nftRental.allowNFTContract(await mockNFT.getAddress(), true);

        // Approve BEZ for rental contract
        await bezToken.connect(renter).approve(await nftRental.getAddress(), ethers.MaxUint256);
    });

    describe("Referral Setup", function () {
        it("Should allow a user to set a referrer", async function () {
            await expect(nftRental.connect(renter).setReferrer(referrer.address))
                .to.emit(nftRental, "ReferrerSet")
                .withArgs(renter.address, referrer.address);

            expect(await nftRental.userReferrer(renter.address)).to.equal(referrer.address);
        });

        it("Should not allow self-referral", async function () {
            await expect(
                nftRental.connect(renter).setReferrer(renter.address)
            ).to.be.revertedWith("Cannot refer self");
        });

        it("Should not allow setting referrer twice", async function () {
            await nftRental.connect(renter).setReferrer(referrer.address);
            await expect(
                nftRental.connect(renter).setReferrer(owner.address)
            ).to.be.revertedWith("Referrer already set");
        });
    });

    describe("Fee Distribution with Referrals", function () {
        let listingId;

        beforeEach(async function () {
            const nftAddress = await mockNFT.getAddress();
            const tokenId = 0;

            // Approve and List NFT
            await mockNFT.connect(nftOwner).approve(await nftRental.getAddress(), tokenId);

            const tx = await nftRental.connect(nftOwner).listNFTForRent(
                nftAddress,
                tokenId,
                PRICE_PER_DAY,
                MIN_DAYS,
                MAX_DAYS,
                COLLATERAL
            );

            const receipt = await tx.wait();
            // Get listingId from event
            const event = receipt.logs.find(log => {
                try {
                    return nftRental.interface.parseLog(log).name === 'NFTListed';
                } catch (e) { return false; }
            });
            listingId = nftRental.interface.parseLog(event).args.listingId;
        });

        it("Should split fees 80/20 when referrer is set", async function () {
            // Set referrer
            await nftRental.connect(renter).setReferrer(referrer.address);

            // Rent for 1 day
            // Total Price: 100 BEZ
            // Protocol Fee (2.5%): 2.5 BEZ
            // Referrer Share (20% of 2.5): 0.5 BEZ
            // Protocol Share (80% of 2.5): 2.0 BEZ

            const initialReferrerBalance = await bezToken.balanceOf(referrer.address);
            const initialFeeRecipientBalance = await bezToken.balanceOf(feeRecipient.address);

            await nftRental.connect(renter).rentNFT(listingId, 1);

            const finalReferrerBalance = await bezToken.balanceOf(referrer.address);
            const finalFeeRecipientBalance = await bezToken.balanceOf(feeRecipient.address);

            const expectedFee = ethers.parseUnits("2.5", 18);
            const expectedReferrerShare = (expectedFee * 20n) / 100n;
            const expectedProtocolShare = expectedFee - expectedReferrerShare;

            expect(finalReferrerBalance - initialReferrerBalance).to.equal(expectedReferrerShare);
            expect(finalFeeRecipientBalance - initialFeeRecipientBalance).to.equal(expectedProtocolShare);
        });

        it("Should send 100% of fee to protocol if no referrer set", async function () {
            // No referrer set

            const initialFeeRecipientBalance = await bezToken.balanceOf(feeRecipient.address);
            const initialReferrerBalance = await bezToken.balanceOf(referrer.address);

            await nftRental.connect(renter).rentNFT(listingId, 1);

            const finalFeeRecipientBalance = await bezToken.balanceOf(feeRecipient.address);
            const finalReferrerBalance = await bezToken.balanceOf(referrer.address);

            const expectedFee = ethers.parseUnits("2.5", 18);

            expect(finalFeeRecipientBalance - initialFeeRecipientBalance).to.equal(expectedFee);
            expect(finalReferrerBalance).to.equal(initialReferrerBalance);
        });
    });
});
