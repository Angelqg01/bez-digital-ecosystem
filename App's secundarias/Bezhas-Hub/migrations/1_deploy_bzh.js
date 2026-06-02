const BZHToken = artifacts.require("BZHToken");

module.exports = async function (deployer) {
    const initialSupply = web3.utils.toWei("1000000", "ether");
    await deployer.deploy(BZHToken, initialSupply);
};
