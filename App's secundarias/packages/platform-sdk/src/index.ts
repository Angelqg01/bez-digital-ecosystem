// @bezhas/platform-sdk — Barrel Export
// Auth
export { useBezhasAuth, type AuthState } from './auth/useBezhasAuth';
export { PlatformGuard } from './auth/PlatformGuard';
export { generateDID, resolveDID, type BeZhasDID } from './auth/did';

// Identity
export { useBezhasUID, type BeZhasIdentity } from './identity/useBezhasUID';

// Gas
export { useGasTank, type GasTankState } from './gas/useGasTank';
export { useAegisGasPredictor, type GasPrediction } from './gas/useAegisGasPredictor';

// Wallet
export { useBEZBalance } from './wallet/useBEZBalance';
export { useSmartWallet } from './wallet/useSmartWallet';

// Billing / BEZ-Coin credits
export {
  BeZhasBillingClient,
  createBillingClient,
  useUnifiedBilling,
  type BillingClientConfig,
  type AIUsagePayload,
  type AIChargeRequest,
  type BEZCreditPackage,
} from './billing';

// Vision
export { useGeminiVision, type VisionResult, type VisionMode } from './vision/useGeminiVision';
export { useSIFTFingerprint } from './vision/useSIFTFingerprint';
export { useVolumetric3D } from './vision/useVolumetric3D';

// MCP
export { useMCPTool, type MCPToolResult } from './mcp/useMCPTool';
export { MCPClient } from './mcp/mcpClient';
export { MCP_TOOLS, type MCPToolName } from './mcp/tools';

// Blockchain
export { useContractCall } from './blockchain/useContractCall';
export { useTransactionStatus } from './blockchain/useTransactionStatus';
export { CONTRACTS } from './blockchain/contracts';

// Navigation
export { ROUTES, getActiveRoutes, getRoutesByCategory, getRouteById, type AppRoute } from './navigation/routes';
