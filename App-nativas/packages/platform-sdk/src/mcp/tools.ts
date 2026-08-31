/**
 * MCP Tool definitions — The 12 AI tools available across the BeZhas ecosystem.
 * Each tool is invocable from any sub-app via useMCPTool().
 */

export const MCP_TOOLS = {
  'analyze-gas': {
    description: 'Analyze gas strategy and recommend optimal gas price',
    apps: ['gas-tank-manager'],
    params: ['chain_id', 'operation_type'],
  },
  'verify-compliance': {
    description: 'Verify regulatory compliance (AML/KYC, customs, food safety)',
    apps: ['Aduana y SupplyChain', 'BZ PureScan'],
    params: ['entity_did', 'regulation_framework', 'cargo_data'],
  },
  'analyze-sentiment': {
    description: 'Analyze market sentiment for BEZ and related assets',
    apps: ['BZ Capital'],
    params: ['asset', 'timeframe', 'sources'],
  },
  'system-health': {
    description: 'Check platform health: nodes, TPS, contracts, services',
    apps: ['Bezhas-Hub'],
    params: [],
  },
  'audit-contract': {
    description: 'Audit a smart contract for vulnerabilities and gas optimization',
    apps: ['developer-sandbox', 'Bezhas-Hub'],
    params: ['contract_address', 'chain_id'],
  },
  'predict-demand': {
    description: 'Predict demand for RWA assets and tokenized products',
    apps: ['BZ Capital'],
    params: ['sector', 'asset_type', 'horizon_days'],
  },
  'score-supplier': {
    description: 'Score a supplier based on on-chain history and quality verdicts',
    apps: ['BEZ_Scaner', 'Aduana y SupplyChain'],
    params: ['supplier_did', 'sector', 'asset_data'],
  },
  'calculate-smart-swap': {
    description: 'Find optimal swap route between BEZ, FIAT, and DEX liquidity',
    apps: ['BZ Capital'],
    params: ['from_token', 'to_token', 'amount', 'slippage_tolerance'],
  },
  'monitor-edge-node': {
    description: 'Monitor edge node health, uptime, and reward eligibility',
    apps: ['edge-node-manager'],
    params: ['node_id', 'enterprise_did'],
  },
  'assess-fraud-risk': {
    description: 'Assess fraud risk for a product or seller using visual fingerprint',
    apps: ['Retail y Lujo'],
    params: ['asset_fingerprint', 'marketplace_source', 'seller_did'],
  },
  'optimize-route': {
    description: 'Optimize shipping route considering customs, cost, and time',
    apps: ['Aduana y SupplyChain'],
    params: ['origin', 'destination', 'cargo_nft', 'priority'],
  },
  'analyze-market': {
    description: 'Deep market analysis: technicals, fundamentals, correlations',
    apps: ['BZ Capital'],
    params: ['asset', 'analysis_type', 'indicators'],
  },
} as const;

export type MCPToolName = keyof typeof MCP_TOOLS;

export type MCPToolParams<T extends MCPToolName> = Record<
  (typeof MCP_TOOLS)[T]['params'][number],
  string | number | boolean | object
>;
