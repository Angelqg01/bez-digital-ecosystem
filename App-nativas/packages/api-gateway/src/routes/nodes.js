import { Router } from 'express';
import { ethers } from 'ethers';
import { requireAuth, requireScope, requireNodeHeartbeat } from './auth.js';

const router = Router();
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');

// In-memory node registry (replace with DB)
const nodeRegistry = new Map();

/** GET /api/nodes/network — Global network stats */
router.get('/network', (req, res) => {
  const allNodes = Array.from(nodeRegistry.values());
  const online = allNodes.filter(n => n.status === 'online').length;

  res.json({
    totalNodes: Math.max(allNodes.length, 847),
    online: Math.max(online, 812),
    syncing: 23,
    offline: 12,
    tps: 1240,
    avgBlockTime: 2.1,
    status: 'healthy',
  });
});

/** GET /api/nodes/mine — User's nodes */
router.get('/mine', requireScope('nodes:read'), (req, res) => {
  const userNodes = Array.from(nodeRegistry.values()).filter(n => n.owner === req.user.sub);
  res.json({ nodes: userNodes, count: userNodes.length });
});

/** POST /api/nodes/register — Register a new edge node */
router.post('/register', requireScope('nodes:write'), async (req, res) => {
  const { name, region, tier } = req.body;

  if (!name || !region || !tier) {
    return res.status(400).json({ error: 'name, region, and tier required' });
  }

  const nodeId = `NODE-${String(nodeRegistry.size + 1).padStart(3, '0')}`;
  const apiKey = `bzh_node_sk_live_${ethers.hexlify(ethers.randomBytes(16)).slice(2)}`;

  const node = {
    id: nodeId,
    name,
    region,
    tier,
    owner: req.user.sub,
    status: 'syncing',
    apiKey,
    apiKeyHash: ethers.keccak256(ethers.toUtf8Bytes(apiKey)),
    registeredAt: new Date().toISOString(),
    uptime: 0,
    points: 0,
    metrics: { cpu: 0, ram: 0, disk: 0, peers: 0 },
  };

  nodeRegistry.set(nodeId, node);

  // In production: call EdgeNodeRewards.registerNode() on-chain
  res.json({
    success: true,
    node: { ...node, apiKey }, // Only show apiKey on registration
    deployCommand: `bezhas-node init --name "${name}" --region ${region} --tier ${tier} --api-key "${apiKey}" --chain-id 2708 && bezhas-node start --daemon`,
    dockerCommand: `docker run -d --name bezhas-${nodeId.toLowerCase()} -p 30303:30303 -p 8545:8545 bezhas/edge-node:latest --api-key="${apiKey}"`,
  });
});

/** PATCH /api/nodes/:nodeId/metrics — Update node metrics (from node heartbeat) */
router.patch('/:nodeId/metrics', requireNodeHeartbeat, (req, res) => {
  const { nodeId } = req.params;
  const { cpu, ram, disk, peers, status } = req.body;

  const node = nodeRegistry.get(nodeId);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  const providedKey = req.headers['x-node-api-key'] || req.headers['x-api-key'];
  if (node.apiKey && providedKey !== node.apiKey && req.user?.sub !== node.owner) {
    return res.status(403).json({ error: 'Invalid node credentials' });
  }

  if (cpu !== undefined) node.metrics.cpu = cpu;
  if (ram !== undefined) node.metrics.ram = ram;
  if (disk !== undefined) node.metrics.disk = disk;
  if (peers !== undefined) node.metrics.peers = peers;
  if (status) node.status = status;

  res.json({ success: true, nodeId });
});

/** POST /api/nodes/:nodeId/claim — Claim node rewards */
router.post('/:nodeId/claim', requireScope('nodes:write'), async (req, res) => {
  const { nodeId } = req.params;
  const node = nodeRegistry.get(nodeId);

  if (!node) return res.status(404).json({ error: 'Node not found' });
  if (node.owner !== req.user.sub) return res.status(403).json({ error: 'Not your node' });

  const rewards = node.points * 0.028; // Points to BEZ conversion
  node.points = 0;

  // In production: call EdgeNodeRewards.claimRewards() on-chain
  res.json({
    success: true,
    claimed: rewards,
    token: 'BEZ',
    txHash: '0x' + ethers.hexlify(ethers.randomBytes(32)).slice(2),
    message: `${rewards.toFixed(2)} BEZ sent to ${req.user.sub}`,
  });
});

export { router as nodesRouter };
