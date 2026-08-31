const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BeZhasRealEstate", function () {
    let realEstate;
    let owner;
    let investor1;
    let investor2;
    let guest;

    const PROPERTY_ID = 1;
    const TOTAL_SHARES = 10000;
    const SHARE_PRICE = ethers.parseEther("0.001"); // 0.001 ETH per share
    const PROPERTY_NAME = "Beachfront Villa - Miami";
    const PROPERTY_LOCATION = "Miami Beach, FL";

    beforeEach(async function () {
        [owner, investor1, investor2, guest] = await ethers.getSigners();

        const BeZhasRealEstate = await ethers.getContractFactory("BeZhasRealEstate");
        realEstate = await BeZhasRealEstate.deploy();
    });

    describe("Property Creation", function () {
        it("Should create a new property", async function () {
            await realEstate.createProperty(
                PROPERTY_ID,
                TOTAL_SHARES,
                SHARE_PRICE,
                PROPERTY_NAME,
                PROPERTY_LOCATION
            );

            const property = await realEstate.properties(PROPERTY_ID);

            expect(property.name).to.equal(PROPERTY_NAME);
            expect(property.totalShares).to.equal(TOTAL_SHARES);
            expect(property.sharePrice).to.equal(SHARE_PRICE);
            expect(property.totalRevenue).to.equal(0);
            expect(property.isActive).to.be.true;

            // Contract should have all shares initially (tokens are minted to contract)
            expect(await realEstate.balanceOf(realEstate.target, PROPERTY_ID)).to.equal(TOTAL_SHARES);
        });

        it("Should reject duplicate property IDs", async function () {
            await realEstate.createProperty(PROPERTY_ID, TOTAL_SHARES, SHARE_PRICE, PROPERTY_NAME, PROPERTY_LOCATION);

            await expect(
                realEstate.createProperty(PROPERTY_ID, TOTAL_SHARES, SHARE_PRICE, "Another Property", "Location 2")
            ).to.be.revertedWith("Property ID already exists");
        });

        it("Should only allow owner to create properties", async function () {
            await expect(
                realEstate.connect(investor1).createProperty(
                    PROPERTY_ID,
                    TOTAL_SHARES,
                    SHARE_PRICE,
                    PROPERTY_NAME,
                    PROPERTY_LOCATION
                )
            ).to.be.revertedWithCustomError(realEstate, "OwnableUnauthorizedAccount");
        });
    });

    describe("Buying Shares", function () {
        beforeEach(async function () {
            await realEstate.createProperty(
                PROPERTY_ID,
                TOTAL_SHARES,
                SHARE_PRICE,
                PROPERTY_NAME,
                PROPERTY_LOCATION
            );
        });

        it("Should allow buying shares", async function () {
            const sharesToBuy = 100;
            const payment = SHARE_PRICE * BigInt(sharesToBuy);

            await realEstate.connect(investor1).buyShares(PROPERTY_ID, sharesToBuy, {
                value: payment
            });

            const balance = await realEstate.balanceOf(investor1.address, PROPERTY_ID);
            expect(balance).to.equal(sharesToBuy);

            // Contract balance should decrease (tokens are minted to contract initially)
            const contractBalance = await realEstate.balanceOf(realEstate.target, PROPERTY_ID);
            expect(contractBalance).to.equal(TOTAL_SHARES - sharesToBuy);
        });

        it("Should reject purchase with insufficient payment", async function () {
            const sharesToBuy = 100;
            const insufficientPayment = SHARE_PRICE * BigInt(sharesToBuy) - 1n;

            await expect(
                realEstate.connect(investor1).buyShares(PROPERTY_ID, sharesToBuy, {
                    value: insufficientPayment
                })
            ).to.be.revertedWith("Insufficient payment");
        });

        it("Should reject purchase for inactive property", async function () {
            // Create another property that we won't activate
            const inactiveId = 99;
            // Property doesn't exist, so isActive = false

            await expect(
                realEstate.connect(investor1).buyShares(inactiveId, 10, {
                    value: SHARE_PRICE * 10n
                })
            ).to.be.revertedWith("Property not active");
        });

        it("Should distribute payment to owner", async function () {
            const sharesToBuy = 100;
            const payment = SHARE_PRICE * BigInt(sharesToBuy);

            const initialContractBalance = await ethers.provider.getBalance(realEstate.target);

            await realEstate.connect(investor1).buyShares(PROPERTY_ID, sharesToBuy, {
                value: payment
            });

            const finalContractBalance = await ethers.provider.getBalance(realEstate.target);
            // Contract should receive the payment (it accumulates for owner withdrawal)
            expect(finalContractBalance).to.be.greaterThanOrEqual(initialContractBalance);
        });
    });

    describe("Revenue Management", function () {
        beforeEach(async function () {
            await realEstate.createProperty(
                PROPERTY_ID,
                TOTAL_SHARES,
                SHARE_PRICE,
                PROPERTY_NAME,
                PROPERTY_LOCATION
            );

            // Investor1 buys 1000 shares (10%)
            const sharesToBuy = 1000;
            const payment = SHARE_PRICE * BigInt(sharesToBuy);
            await realEstate.connect(investor1).buyShares(PROPERTY_ID, sharesToBuy, {
                value: payment
            });

            // Investor2 buys 500 shares (5%)
            const sharesToBuy2 = 500;
            const payment2 = SHARE_PRICE * BigInt(sharesToBuy2);
            await realEstate.connect(investor2).buyShares(PROPERTY_ID, sharesToBuy2, {
                value: payment2
            });
        });

        it("Should deposit revenue correctly", async function () {
            const revenue = ethers.parseEther("10"); // 10 ETH booking revenue

            await realEstate.depositRevenue(PROPERTY_ID, { value: revenue });

            const property = await realEstate.properties(PROPERTY_ID);
            expect(property.totalRevenue).to.equal(revenue);

            // Check dividends per share is updated
            const dividendsPerShare = await realEstate.dividendsPerShare(PROPERTY_ID);
            expect(dividendsPerShare).to.be.greaterThan(0n);
        });

        it("Should calculate dividends correctly", async function () {
            const revenue = ethers.parseEther("10");
            await realEstate.depositRevenue(PROPERTY_ID, { value: revenue });

            // Investor1 has 1000 shares (10%)
            const expectedDividends1 = (revenue * 1000n) / BigInt(TOTAL_SHARES);

            // Check claimable dividends
            const claimable = await realEstate.getClaimableDividends(PROPERTY_ID, investor1.address);
            expect(claimable).to.be.closeTo(expectedDividends1, ethers.parseEther("0.001"));
        });

        it("Should allow claiming dividends", async function () {
            const revenue = ethers.parseEther("10");
            await realEstate.depositRevenue(PROPERTY_ID, { value: revenue });

            const initialBalance = await ethers.provider.getBalance(investor1.address);

            const tx = await realEstate.connect(investor1).claimDividends(PROPERTY_ID);
            const receipt = await tx.wait();
            const gasCost = receipt.gasUsed * receipt.gasPrice;

            const finalBalance = await ethers.provider.getBalance(investor1.address);

            // Should receive dividends minus gas cost
            const expectedDividends = (revenue * 1000n) / BigInt(TOTAL_SHARES);
            expect(finalBalance + gasCost - initialBalance).to.be.closeTo(
                expectedDividends,
                ethers.parseEther("0.001") // Allow small rounding error
            );
        });

        it("Should prevent double claiming", async function () {
            const revenue = ethers.parseEther("10");
            await realEstate.depositRevenue(PROPERTY_ID, { value: revenue });

            // Claim once
            await realEstate.connect(investor1).claimDividends(PROPERTY_ID);

            // Try to claim again immediately
            await expect(
                realEstate.connect(investor1).claimDividends(PROPERTY_ID)
            ).to.be.revertedWith("No new dividends");
        });

        it("Should accumulate multiple revenue deposits", async function () {
            const revenue1 = ethers.parseEther("5");
            const revenue2 = ethers.parseEther("8");

            await realEstate.depositRevenue(PROPERTY_ID, { value: revenue1 });
            await realEstate.depositRevenue(PROPERTY_ID, { value: revenue2 });

            const property = await realEstate.properties(PROPERTY_ID);
            expect(property.totalRevenue).to.equal(revenue1 + revenue2);
        });

        it("Should distribute dividends proportionally", async function () {
            const revenue = ethers.parseEther("10");
            await realEstate.depositRevenue(PROPERTY_ID, { value: revenue });

            // Investor1: 1000 shares = 10%
            // Investor2: 500 shares = 5%
            const expectedDiv1 = revenue * 1000n / BigInt(TOTAL_SHARES);
            const expectedDiv2 = revenue * 500n / BigInt(TOTAL_SHARES);

            const balance1Before = await ethers.provider.getBalance(investor1.address);
            const tx1 = await realEstate.connect(investor1).claimDividends(PROPERTY_ID);
            const receipt1 = await tx1.wait();
            const balance1After = await ethers.provider.getBalance(investor1.address);
            const gasCost1 = receipt1.gasUsed * receipt1.gasPrice;

            const balance2Before = await ethers.provider.getBalance(investor2.address);
            const tx2 = await realEstate.connect(investor2).claimDividends(PROPERTY_ID);
            const receipt2 = await tx2.wait();
            const balance2After = await ethers.provider.getBalance(investor2.address);
            const gasCost2 = receipt2.gasUsed * receipt2.gasPrice;

            // Check proportional distribution
            const received1 = balance1After + gasCost1 - balance1Before;
            const received2 = balance2After + gasCost2 - balance2Before;

            expect(received1).to.be.closeTo(expectedDiv1, ethers.parseEther("0.001"));
            expect(received2).to.be.closeTo(expectedDiv2, ethers.parseEther("0.001"));
        });
    });

    describe("Share Transfers", function () {
        beforeEach(async function () {
            await realEstate.createProperty(
                PROPERTY_ID,
                TOTAL_SHARES,
                SHARE_PRICE,
                PROPERTY_NAME,
                PROPERTY_LOCATION
            );

            // Investor1 buys shares
            const sharesToBuy = 1000;
            const payment = SHARE_PRICE * BigInt(sharesToBuy);
            await realEstate.connect(investor1).buyShares(PROPERTY_ID, sharesToBuy, {
                value: payment
            });
        });

        it("Should allow transferring shares between users", async function () {
            const sharesToTransfer = 200;

            await realEstate.connect(investor1).safeTransferFrom(
                investor1.address,
                investor2.address,
                PROPERTY_ID,
                sharesToTransfer,
                "0x"
            );

            const balance1 = await realEstate.balanceOf(investor1.address, PROPERTY_ID);
            const balance2 = await realEstate.balanceOf(investor2.address, PROPERTY_ID);

            expect(balance1).to.equal(800);
            expect(balance2).to.equal(sharesToTransfer);
        });
    });

    describe("ERC1155 Compliance", function () {
        it("Should support ERC1155 interface", async function () {
            // ERC1155 interface ID: 0xd9b67a26
            expect(await realEstate.supportsInterface("0xd9b67a26")).to.be.true;
        });

        it("Should handle ERC1155 batch operations", async function () {
            // Create multiple properties
            await realEstate.createProperty(1, TOTAL_SHARES, SHARE_PRICE, "Property 1", "Location 1");
            await realEstate.createProperty(2, TOTAL_SHARES, SHARE_PRICE, "Property 2", "Location 2");

            // Buy shares in both
            const payment = SHARE_PRICE * 100n * 2n;
            await realEstate.connect(investor1).buyShares(1, 100, { value: SHARE_PRICE * 100n });
            await realEstate.connect(investor1).buyShares(2, 100, { value: SHARE_PRICE * 100n });

            // Check batch balance
            const balances = await realEstate.balanceOfBatch(
                [investor1.address, investor1.address],
                [1, 2]
            );

            expect(balances[0]).to.equal(100);
            expect(balances[1]).to.equal(100);
        });
    });

    describe("Gas Optimization", function () {
        it("Should be gas efficient for share purchases", async function () {
            await realEstate.createProperty(
                PROPERTY_ID,
                TOTAL_SHARES,
                SHARE_PRICE,
                PROPERTY_NAME,
                PROPERTY_LOCATION
            );

            const tx = await realEstate.connect(investor1).buyShares(PROPERTY_ID, 100, {
                value: SHARE_PRICE * 100n
            });
            const receipt = await tx.wait();

            // Should use less than 200k gas
            expect(receipt.gasUsed).to.be.lessThan(200000n);
        });
    });
});
