export const shortHash = (value, size = 18) => (
  value ? `${value.slice(0, size)}...` : 'PENDING_ONCHAIN'
)

export const blockchainStatusText = (blockchain = {}) => {
  if (blockchain.txHash) return shortHash(blockchain.txHash)
  if (blockchain.mode === 'wallet_signature_required') return 'WALLET_SIGNATURE_REQUIRED'
  if (blockchain.mode === 'pending_contract_config') return 'PENDING_CONTRACT_CONFIG'
  return blockchain.nextAction || 'PENDING_ONCHAIN'
}

export const blockNumberText = (blockchain = {}) => (
  blockchain.blockNumber || 'pending'
)
