/**
 * Decentralized Identity Service (DID)
 * Implements W3C DID standards for Web3 identity
 * Future-proof for verifiable credentials and cross-chain identity
 * 
 * @module services/did.service
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const pino = require('pino');
const cacheService = require('./cache.service');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Supported DID methods
 */
const DID_METHODS = {
    ETH: 'ethr',           // Ethereum-based DID
    KEY: 'key',            // Key-based DID
    WEB: 'web',            // Web-based DID
    BEZHAS: 'bezhas'       // Custom BeZhas DID
};

/**
 * Credential types
 */
const CREDENTIAL_TYPES = {
    VERIFIED_USER: 'VerifiedUser',
    DAO_MEMBER: 'DAOMember',
    CONTENT_CREATOR: 'ContentCreator',
    VIP_MEMBER: 'VIPMember',
    QUALITY_VALIDATOR: 'QualityValidator',
    NFT_OWNER: 'NFTOwner',
    REPUTATION_BADGE: 'ReputationBadge'
};

class DIDService {
    constructor() {
        this.isInitialized = false;
        this.issuerDID = null;
        this.issuerPrivateKey = null;
    }

    /**
     * Initialize the DID service
     */
    async initialize() {
        try {
            // Setup issuer DID for BeZhas platform
            if (process.env.BEZHAS_ISSUER_PRIVATE_KEY) {
                const wallet = new ethers.Wallet(process.env.BEZHAS_ISSUER_PRIVATE_KEY);
                this.issuerDID = this.createDIDFromAddress(wallet.address);
                this.issuerPrivateKey = process.env.BEZHAS_ISSUER_PRIVATE_KEY;
                logger.info({ issuerDID: this.issuerDID }, 'BeZhas issuer DID initialized');
            } else {
                // Generate ephemeral issuer for development
                const wallet = ethers.Wallet.createRandom();
                this.issuerDID = this.createDIDFromAddress(wallet.address);
                this.issuerPrivateKey = wallet.privateKey;
                logger.warn('Using ephemeral issuer DID (development mode)');
            }

            this.isInitialized = true;
            return true;
        } catch (error) {
            logger.error({ error: error.message }, 'DID service initialization failed');
            return false;
        }
    }

    // ============ DID CREATION ============

    /**
     * Create DID from Ethereum address
     */
    createDIDFromAddress(address, method = DID_METHODS.ETH) {
        const normalizedAddress = address.toLowerCase();
        return `did:${method}:${normalizedAddress}`;
    }

    /**
     * Create DID from public key
     */
    createDIDFromPublicKey(publicKey, method = DID_METHODS.KEY) {
        const hash = crypto.createHash('sha256')
            .update(publicKey)
            .digest('hex')
            .substring(0, 32);
        return `did:${method}:z${hash}`;
    }

    /**
     * Create BeZhas-specific DID for user
     */
    async createBeZhasDID(userId, address) {
        const did = `did:bezhas:${userId}`;

        const didDocument = {
            '@context': [
                'https://www.w3.org/ns/did/v1',
                'https://w3id.org/security/suites/ed25519-2020/v1'
            ],
            id: did,
            alsoKnownAs: [
                this.createDIDFromAddress(address)
            ],
            verificationMethod: [
                {
                    id: `${did}#wallet`,
                    type: 'EcdsaSecp256k1RecoveryMethod2020',
                    controller: did,
                    blockchainAccountId: `eip155:137:${address.toLowerCase()}`
                }
            ],
            authentication: [`${did}#wallet`],
            assertionMethod: [`${did}#wallet`],
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        // Cache the DID document
        await cacheService.set(`did:${did}`, didDocument, 86400 * 30);

        return {
            did,
            document: didDocument
        };
    }

    // ============ DID RESOLUTION ============

    /**
     * Resolve a DID to its DID Document
     */
    async resolveDID(did) {
        // Check cache first
        const cached = await cacheService.get(`did:${did}`);
        if (cached) return cached;

        // Parse DID
        const parts = did.split(':');
        if (parts.length < 3 || parts[0] !== 'did') {
            throw new Error('Invalid DID format');
        }

        const method = parts[1];
        const identifier = parts.slice(2).join(':');

        switch (method) {
            case DID_METHODS.ETH:
                return this.resolveEthrDID(identifier);
            case DID_METHODS.KEY:
                return this.resolveKeyDID(identifier);
            case DID_METHODS.BEZHAS:
                return this.resolveBeZhasDID(identifier);
            default:
                throw new Error(`Unsupported DID method: ${method}`);
        }
    }

    /**
     * Resolve Ethereum DID
     */
    async resolveEthrDID(address) {
        const did = `did:ethr:${address.toLowerCase()}`;

        return {
            '@context': ['https://www.w3.org/ns/did/v1'],
            id: did,
            verificationMethod: [
                {
                    id: `${did}#controller`,
                    type: 'EcdsaSecp256k1RecoveryMethod2020',
                    controller: did,
                    blockchainAccountId: `eip155:137:${address.toLowerCase()}`
                }
            ],
            authentication: [`${did}#controller`],
            assertionMethod: [`${did}#controller`]
        };
    }

    /**
     * Resolve Key-based DID
     */
    async resolveKeyDID(keyId) {
        const did = `did:key:${keyId}`;

        return {
            '@context': ['https://www.w3.org/ns/did/v1'],
            id: did,
            verificationMethod: [
                {
                    id: `${did}#key`,
                    type: 'JsonWebKey2020',
                    controller: did,
                    publicKeyJwk: {} // Would be populated from key
                }
            ],
            authentication: [`${did}#key`]
        };
    }

    /**
     * Resolve BeZhas-specific DID
     */
    async resolveBeZhasDID(userId) {
        const cached = await cacheService.get(`did:did:bezhas:${userId}`);
        if (cached) return cached;

        // In production, fetch from database
        throw new Error(`BeZhas DID not found: ${userId}`);
    }

    // ============ VERIFIABLE CREDENTIALS ============

    /**
     * Issue a Verifiable Credential
     */
    async issueCredential(subjectDID, credentialType, claims) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const credentialId = `urn:uuid:${crypto.randomUUID()}`;
        const issuanceDate = new Date().toISOString();

        const credential = {
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://bezhas.com/credentials/v1'
            ],
            id: credentialId,
            type: ['VerifiableCredential', credentialType],
            issuer: this.issuerDID,
            issuanceDate,
            credentialSubject: {
                id: subjectDID,
                ...claims
            }
        };

        // Sign the credential
        const signature = await this.signCredential(credential);
        credential.proof = {
            type: 'EcdsaSecp256k1Signature2019',
            created: issuanceDate,
            verificationMethod: `${this.issuerDID}#key`,
            proofPurpose: 'assertionMethod',
            proofValue: signature
        };

        logger.info({
            credentialId,
            type: credentialType,
            subject: subjectDID
        }, 'Credential issued');

        return credential;
    }

    /**
     * Sign a credential with issuer's private key
     */
    async signCredential(credential) {
        const wallet = new ethers.Wallet(this.issuerPrivateKey);
        const message = JSON.stringify(credential);
        const signature = await wallet.signMessage(message);
        return signature;
    }

    /**
     * Verify a Verifiable Credential
     */
    async verifyCredential(credential) {
        try {
            // Check basic structure
            if (!credential['@context'] || !credential.type || !credential.issuer) {
                return { valid: false, error: 'Invalid credential structure' };
            }

            // Check if credential is not expired
            if (credential.expirationDate) {
                const expDate = new Date(credential.expirationDate);
                if (expDate < new Date()) {
                    return { valid: false, error: 'Credential expired' };
                }
            }

            // Verify signature
            if (credential.proof) {
                const isValidSignature = await this.verifySignature(credential);
                if (!isValidSignature) {
                    return { valid: false, error: 'Invalid signature' };
                }
            }

            // Verify issuer
            if (credential.issuer !== this.issuerDID) {
                // Could check against list of trusted issuers
                logger.warn({ issuer: credential.issuer }, 'Unknown issuer');
            }

            return {
                valid: true,
                issuer: credential.issuer,
                subject: credential.credentialSubject.id,
                type: credential.type
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Verify signature on credential
     */
    async verifySignature(credential) {
        try {
            const { proof, ...credentialWithoutProof } = credential;
            const message = JSON.stringify(credentialWithoutProof);

            // Recover signer address
            const signerAddress = ethers.verifyMessage(message, proof.proofValue);

            // Check if signer matches issuer DID
            const issuerAddress = credential.issuer.split(':').pop();

            return signerAddress.toLowerCase() === issuerAddress.toLowerCase();
        } catch {
            return false;
        }
    }

    // ============ CREDENTIAL TYPES ============

    /**
     * Issue Verified User credential
     */
    async issueVerifiedUserCredential(userDID, verificationData) {
        return this.issueCredential(userDID, CREDENTIAL_TYPES.VERIFIED_USER, {
            verified: true,
            verificationMethod: verificationData.method,
            verifiedAt: new Date().toISOString(),
            ...verificationData
        });
    }

    /**
     * Issue DAO Membership credential
     */
    async issueDAOMembershipCredential(userDID, daoData) {
        return this.issueCredential(userDID, CREDENTIAL_TYPES.DAO_MEMBER, {
            daoId: daoData.daoId,
            daoName: daoData.name,
            role: daoData.role || 'member',
            votingPower: daoData.votingPower,
            joinedAt: new Date().toISOString()
        });
    }

    /**
     * Issue Content Creator credential
     */
    async issueContentCreatorCredential(userDID, creatorData) {
        return this.issueCredential(userDID, CREDENTIAL_TYPES.CONTENT_CREATOR, {
            tier: creatorData.tier,
            totalPosts: creatorData.totalPosts,
            qualityScore: creatorData.qualityScore,
            specializations: creatorData.specializations || [],
            earnedAt: new Date().toISOString()
        });
    }

    /**
     * Issue VIP Membership credential
     */
    async issueVIPMembershipCredential(userDID, vipData) {
        const expirationDate = new Date();
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);

        const credential = await this.issueCredential(userDID, CREDENTIAL_TYPES.VIP_MEMBER, {
            tier: vipData.tier,
            benefits: vipData.benefits,
            subscriptionId: vipData.subscriptionId,
            startDate: new Date().toISOString()
        });

        credential.expirationDate = expirationDate.toISOString();
        return credential;
    }

    /**
     * Issue Reputation Badge credential
     */
    async issueReputationBadge(userDID, badgeData) {
        return this.issueCredential(userDID, CREDENTIAL_TYPES.REPUTATION_BADGE, {
            badgeId: badgeData.id,
            badgeName: badgeData.name,
            category: badgeData.category,
            level: badgeData.level,
            earnedAt: new Date().toISOString(),
            metadata: badgeData.metadata
        });
    }

    // ============ VERIFIABLE PRESENTATIONS ============

    /**
     * Create a Verifiable Presentation (bundle of credentials)
     */
    async createPresentation(credentials, holderDID, challenge = null) {
        const presentationId = `urn:uuid:${crypto.randomUUID()}`;

        const presentation = {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiablePresentation'],
            id: presentationId,
            holder: holderDID,
            verifiableCredential: credentials,
            created: new Date().toISOString()
        };

        if (challenge) {
            presentation.proof = {
                type: 'EcdsaSecp256k1Signature2019',
                created: new Date().toISOString(),
                challenge,
                proofPurpose: 'authentication',
                verificationMethod: `${holderDID}#wallet`
            };
        }

        return presentation;
    }

    /**
     * Verify a Verifiable Presentation
     */
    async verifyPresentation(presentation) {
        const results = {
            valid: true,
            holder: presentation.holder,
            credentials: []
        };

        for (const credential of presentation.verifiableCredential) {
            const verification = await this.verifyCredential(credential);
            results.credentials.push({
                id: credential.id,
                type: credential.type,
                ...verification
            });

            if (!verification.valid) {
                results.valid = false;
            }
        }

        return results;
    }

    // ============ UTILITY METHODS ============

    /**
     * Get user's credentials
     */
    async getUserCredentials(userDID) {
        const cacheKey = `credentials:${userDID}`;
        return cacheService.get(cacheKey) || [];
    }

    /**
     * Store user credential
     */
    async storeUserCredential(userDID, credential) {
        const cacheKey = `credentials:${userDID}`;
        const credentials = await this.getUserCredentials(userDID);
        credentials.push(credential);
        await cacheService.set(cacheKey, credentials, 86400 * 365);
        return credentials;
    }

    /**
     * Check if user has specific credential type
     */
    async hasCredential(userDID, credentialType) {
        const credentials = await this.getUserCredentials(userDID);
        return credentials.some(c =>
            c.type.includes(credentialType) &&
            (!c.expirationDate || new Date(c.expirationDate) > new Date())
        );
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            issuerDID: this.issuerDID,
            supportedMethods: Object.values(DID_METHODS),
            credentialTypes: Object.values(CREDENTIAL_TYPES)
        };
    }
}

// Export types
module.exports.DID_METHODS = DID_METHODS;
module.exports.CREDENTIAL_TYPES = CREDENTIAL_TYPES;

// Singleton instance
const didService = new DIDService();
module.exports = didService;
