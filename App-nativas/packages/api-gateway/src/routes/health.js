import { Router } from 'express';
import { ethers } from 'ethers';

const router = Router();
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');

/** GET /api/health — Full system status */
router.get('/', async (req, res) => {
  try {
    const blockNumber = await provider.getBlockNumber().catch(() => null);
    const network = await provider.getNetwork().catch(() => null);

    res.json({
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        gateway: { status: 'online', port: process.env.GATEWAY_PORT || 3001 },
        blockchain: {
          status: blockNumber ? 'connected' : 'disconnected',
          chainId: network?.chainId?.toString() || null,
          blockNumber,
          rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
        },
        aegis: {
          status: process.env.AEGIS_BASE_URL ? 'configured' : 'not_configured',
          url: process.env.AEGIS_BASE_URL || null,
        },
        vision: {
          status: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
        },
      },
      apps: {
        hub: ':3000', wallet: ':3010', gasTank: ':3011',
        edgeNodes: ':3012', visionScan: ':3013',
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'degraded', error: error.message });
  }
});

/** GET /api/health/blockchain — Chain-specific health */
router.get('/blockchain', async (req, res) => {
  try {
    const [blockNumber, feeData, network] = await Promise.all([
      provider.getBlockNumber(),
      provider.getFeeData(),
      provider.getNetwork(),
    ]);

    res.json({
      chainId: network.chainId.toString(),
      blockNumber,
      gasPrice: feeData.gasPrice?.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      status: 'connected',
    });
  } catch (error) {
    res.status(503).json({ status: 'disconnected', error: error.message });
  }
});

export { router as healthRouter };
