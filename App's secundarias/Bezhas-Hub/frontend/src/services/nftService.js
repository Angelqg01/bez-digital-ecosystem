/**
 * @deprecated — LEGACY SERVICE. NFT operations now live in BZ Prestige SubApp.
 * Replacement: BZ Prestige/src/services/blockchainService.js
 * NFT minting → BZ Prestige → registerProduct()
 * Provenance → BZ Prestige → getProvenance()
 * The Hub should link to BZ Prestige instead of handling NFTs directly.
 */
import { toast } from 'react-hot-toast';

/**
 * @dev Service module for interacting with the BezhasNFT contract.
 */

/**
 * @dev Mints a new NFT and returns the new token ID.
 * @param {ethers.Contract} nftContract The BezhasNFT contract instance.
 * @param {string} userAddress The address to mint the NFT to (Ignored if contract mints to msg.sender).
 * @param {string} tokenURI The metadata URI for the new NFT.
 * @returns {Promise<number|null>} The ID of the newly minted token, or null on failure.
 */
export const mintNFT = async (nftContract, userAddress, tokenURI) => {
  if (!nftContract || !tokenURI) {
    throw new Error('Required arguments for minting are not provided.');
  }

  try {
    // ABI: mintNFT(string _tokenURI)
    // Note: The contract mints to msg.sender, so userAddress is not passed to the function
    const mintTx = await nftContract.mintNFT(tokenURI);
    toast.loading('Minting your new NFT...', { id: 'mint' });
    const receipt = await mintTx.wait();
    toast.success('NFT minted successfully!', { id: 'mint' });

    // Find the Transfer event in the transaction receipt to get the tokenId
    // Event: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
    // In ethers v6, we might need to parse logs differently if receipt.events is not populated directly

    let tokenId = null;

    // Try to find the event in the logs
    for (const log of receipt.logs) {
      try {
        const parsedLog = nftContract.interface.parseLog(log);
        if (parsedLog.name === 'Transfer') {
          tokenId = Number(parsedLog.args[2]); // args[2] is tokenId
          break;
        }
      } catch (e) {
        // Not a Transfer event or from this contract
        continue;
      }
    }

    if (tokenId !== null) {
      return tokenId;
    }

    throw new Error('Could not determine the new Token ID.');

  } catch (error) {
    console.error('Error minting NFT:', error);
    toast.error(error?.shortMessage || 'Failed to mint NFT.');
    return null;
  }
};
