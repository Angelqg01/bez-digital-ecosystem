const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Access Control and Pausable', function () {
  let owner, other;
  let token, market, staking, userProfile;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    const Token = await ethers.getContractFactory('BezhasToken');
    token = await Token.deploy(ethers.parseUnits('1000000', 18));
    await token.waitForDeployment();

    const Marketplace = await ethers.getContractFactory('Marketplace');
    market = await Marketplace.deploy();
    await market.waitForDeployment();

    const Staking = await ethers.getContractFactory('StakingPool');
    staking = await Staking.deploy(owner.address, token.target);
    await staking.waitForDeployment();

    const UserProfile = await ethers.getContractFactory('UserProfile');
    userProfile = await UserProfile.deploy(owner.address);
    await userProfile.waitForDeployment();
  });

  it('only owner can pause/unpause Marketplace', async function () {
    await expect(market.connect(other).pause()).to.be.revertedWithCustomError(market, 'OwnableUnauthorizedAccount');
    await expect(market.pause()).to.not.be.reverted;
    await expect(market.unpause()).to.not.be.reverted;
  });

  it('only owner can pause/unpause StakingPool', async function () {
    await expect(staking.connect(other).pause()).to.be.revertedWithCustomError(staking, 'OwnableUnauthorizedAccount');
    await expect(staking.pause()).to.not.be.reverted;
    await expect(staking.unpause()).to.not.be.reverted;
  });

  it('MINTER/BURNER roles exist on token and are granted to owner by default', async function () {
    const MINTER_ROLE = await token.MINTER_ROLE();
    const BURNER_ROLE = await token.BURNER_ROLE();

    expect(await token.hasRole(MINTER_ROLE, owner.address)).to.equal(true);
    expect(await token.hasRole(BURNER_ROLE, owner.address)).to.equal(true);
  });
});
