import { Router } from 'express';
import { ethers } from 'ethers';
import { requireAuth } from './auth.js';

const router = Router();

/** POST /api/contracts/read — Read from a contract */
router.post('/read', async (req, res) => {
  const { contractAddress, abi, functionName, args = [] } = req.body;

  if (!contractAddress || !abi || !functionName) {
    return res.status(400).json({ error: 'contractAddress, abi, and functionName required' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
    const contract = new ethers.Contract(contractAddress, abi, provider);
    const result = await contract[functionName](...args);

    res.json({
      success: true,
      result: typeof result === 'bigint' ? result.toString() : result,
      functionName,
      contractAddress,
    });
  } catch (error) {
    res.status(500).json({ error: `Contract read failed: ${error.message}` });
  }
});

/** POST /api/contracts/write — Write to a contract (via Paymaster) */
router.post('/write', requireAuth, async (req, res) => {
  const { contractAddress, abi, functionName, args = [], value = '0' } = req.body;

  if (!contractAddress || !abi || !functionName) {
    return res.status(400).json({ error: 'contractAddress, abi, and functionName required' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');

    // In production: use ERC-4337 Paymaster for gas abstraction
    // For dev: use server wallet
    const serverKey = process.env.SERVER_PRIVATE_KEY;
    if (!serverKey) {
      return res.status(503).json({
        error: 'Server wallet not configured. Set SERVER_PRIVATE_KEY in .env.shared',
        hint: 'For development, use a test account private key',
      });
    }

    const wallet = new ethers.Wallet(serverKey, provider);
    const contract = new ethers.Contract(contractAddress, abi, wallet);
    const tx = await contract[functionName](...args, { value: ethers.parseEther(value) });
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      functionName,
      contractAddress,
    });
  } catch (error) {
    res.status(500).json({ error: `Contract write failed: ${error.message}` });
  }
});

/** GET /api/contracts/addresses — Deployed contract addresses */
router.get('/addresses', (req, res) => {
  res.json({
    chainId: 2708,
    network: 'BeZhas L2',
    contracts: {
      BEZCoinV2: process.env.BEZ_TOKEN_ADDRESS || null,
      StakingPool: process.env.STAKING_POOL_ADDRESS || null,
      LiquidityFarming: process.env.LIQUIDITY_FARMING_ADDRESS || null,
      BeZhasLogisticsNFT: process.env.LOGISTICS_NFT_ADDRESS || null,
      QualityEscrow: process.env.QUALITY_ESCROW_ADDRESS || null,
      EdgeNodeRewards: process.env.EDGE_NODE_REWARDS_ADDRESS || null,
    },
  });
});

export { router as contractsRouter };
