/**
 * BeZhas DID — Decentralized Identifier utilities (W3C compatible).
 * 
 * Format: did:bezhas:<wallet_address>
 * 
 * These DIDs are used across all sub-apps to unify identity,
 * and are compatible with Verifiable Credentials (W3C VC standard).
 */

export interface BeZhasDID {
  id: string;              // "did:bezhas:0x7a3...f4b2"
  controller: string;      // Same as id (self-sovereign)
  walletAddress: string;   // "0x7a3...f4b2"
  created: string;         // ISO timestamp
  verificationMethod: {
    id: string;
    type: string;
    controller: string;
    blockchainAccountId: string;
  }[];
}

const DID_METHOD = 'bezhas';

/**
 * Generate a DID from a wallet address.
 * Deterministic: same address always produces the same DID.
 */
export function generateDID(walletAddress: string): BeZhasDID {
  const normalizedAddress = walletAddress.toLowerCase();
  const did = `did:${DID_METHOD}:${normalizedAddress}`;

  return {
    id: did,
    controller: did,
    walletAddress: normalizedAddress,
    created: new Date().toISOString(),
    verificationMethod: [{
      id: `${did}#key-1`,
      type: 'EcdsaSecp256k1RecoveryMethod2020',
      controller: did,
      blockchainAccountId: `eip155:2708:${normalizedAddress}`, // BeZhas L2 chain
    }],
  };
}

/**
 * Resolve a DID to extract the wallet address and metadata.
 */
export function resolveDID(didString: string): BeZhasDID | null {
  const match = didString.match(/^did:bezhas:(0x[a-fA-F0-9]{40})$/);
  if (!match) return null;
  
  return generateDID(match[1]);
}

/**
 * Validate that a string is a well-formed BeZhas DID.
 */
export function isValidDID(did: string): boolean {
  return /^did:bezhas:0x[a-fA-F0-9]{40}$/.test(did);
}

export default { generateDID, resolveDID, isValidDID };
