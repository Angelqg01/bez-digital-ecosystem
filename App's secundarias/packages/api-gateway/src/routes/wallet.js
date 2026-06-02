import { Router } from 'express';
import { ethers } from 'ethers';
import { requireAuth } from './auth.js';

const router = Router();
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');

/** GET /api/wallet/balance/:address — BEZ + ETH balance */
router.get('/balance/:address', async (req, res) => {
  const { address } = req.params;
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid address' });
  }

  try {
    const ethBalance = await provider.getBalance(address);

    // BEZ token balance
    const bezAddress = process.env.BEZ_TOKEN_ADDRESS;
    let bezBalance = '0';
    if (bezAddress) {
      const bez = new ethers.Contract(bezAddress, ['function balanceOf(address) view returns (uint256)'], provider);
      bezBalance = (await bez.balanceOf(address)).toString();
    }

    res.json({
      address,
      eth: ethers.formatEther(ethBalance),
      bez: ethers.formatUnits(bezBalance, 18),
      bezRaw: bezBalance,
      usdRate: 0.07, // In production: fetch from oracle
      bezUsd: (parseFloat(ethers.formatUnits(bezBalance, 18)) * 0.07).toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balance: ' + error.message });
  }
});

/** GET /api/wallet/nfts/:address — RWA NFTs owned */
router.get('/nfts/:address', async (req, res) => {
  const { address } = req.params;

  try {
    const nftAddress = process.env.LOGISTICS_NFT_ADDRESS;
    if (!nftAddress) {
      return res.json({ nfts: [], total: 0, message: 'NFT contract not configured' });
    }

    const nft = new ethers.Contract(nftAddress, [
      'function balanceOf(address) view returns (uint256)',
      'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
      'function tokenURI(uint256) view returns (string)',
    ], provider);

    const balance = await nft.balanceOf(address);
    const nfts = [];

    for (let i = 0; i < Math.min(Number(balance), 50); i++) {
      try {
        const tokenId = await nft.tokenOfOwnerByIndex(address, i);
        const uri = await nft.tokenURI(tokenId);
        nfts.push({ tokenId: tokenId.toString(), uri });
      } catch { break; }
    }

    res.json({ nfts, total: Number(balance) });
  } catch (error) {
    res.json({ nfts: [], total: 0, error: error.message });
  }
});

/** GET /api/wallet/transactions/:address — Transaction history */
router.get('/transactions/:address', async (req, res) => {
  const { address } = req.params;
  const { page = 1, limit = 20 } = req.query;

  // In production: index with TheGraph or custom indexer
  try {
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 1000);

    // Return structured response; actual indexing requires a subgraph
    res.json({
      address,
      transactions: [],
      fromBlock,
      toBlock: latestBlock,
      page: parseInt(page),
      limit: parseInt(limit),
      message: 'Full indexing requires TheGraph subgraph deployment',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/wallet/staking/:address — Staking position */
router.get('/staking/:address', async (req, res) => {
  const { address } = req.params;

  try {
    const stakingAddress = process.env.STAKING_POOL_ADDRESS;
    if (!stakingAddress) {
      return res.json({ staked: '0', pending: '0', apy: '0' });
    }

    const staking = new ethers.Contract(stakingAddress, [
      'function getStakedBalance(address) view returns (uint256)',
      'function getPendingRewards(address) view returns (uint256)',
      'function getAPY() view returns (uint256)',
    ], provider);

    const [staked, pending, apy] = await Promise.all([
      staking.getStakedBalance(address),
      staking.getPendingRewards(address),
      staking.getAPY(),
    ]);

    res.json({
      staked: ethers.formatUnits(staked, 18),
      pending: ethers.formatUnits(pending, 18),
      apy: (Number(apy) / 100).toFixed(2) + '%',
    });
  } catch (error) {
    res.json({ staked: '0', pending: '0', apy: '0', error: error.message });
  }
});

export { router as walletRouter };
