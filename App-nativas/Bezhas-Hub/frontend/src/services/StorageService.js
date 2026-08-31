import axios from 'axios';

class StorageService {
  constructor() {
    this.ipfsGateways = [
      'https://ipfs.io/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/'
    ];
    
    this.arweaveGateway = 'https://arweave.net/';
    
    this.config = {
      pinata: {
        apiKey: process.env.REACT_APP_PINATA_API_KEY || '',
        secretKey: process.env.REACT_APP_PINATA_SECRET_KEY || '',
        baseUrl: 'https://api.pinata.cloud'
      },
      web3Storage: {
        token: process.env.REACT_APP_WEB3_STORAGE_TOKEN || '',
        baseUrl: 'https://api.web3.storage'
      },
      arweave: {
        host: 'arweave.net',
        port: 443,
        protocol: 'https'
      }
    };
  }

  // IPFS Upload via Pinata
  async uploadToIPFSViaPinata(file, metadata = {}) {
    if (!this.config.pinata.apiKey || !this.config.pinata.secretKey) {
      throw new Error('Pinata API credentials not configured');
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const pinataMetadata = JSON.stringify({
        name: metadata.name || file.name,
        keyvalues: metadata.keyvalues || {}
      });
      formData.append('pinataMetadata', pinataMetadata);

      const pinataOptions = JSON.stringify({
        cidVersion: 0,
        customPinPolicy: {
          regions: [
            { id: 'FRA1', desiredReplicationCount: 1 },
            { id: 'NYC1', desiredReplicationCount: 1 }
          ]
        }
      });
      formData.append('pinataOptions', pinataOptions);

      const response = await axios.post(
        `${this.config.pinata.baseUrl}/pinning/pinFileToIPFS`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'pinata_api_key': this.config.pinata.apiKey,
            'pinata_secret_api_key': this.config.pinata.secretKey
          }
        }
      );

      return {
        hash: response.data.IpfsHash,
        size: response.data.PinSize,
        timestamp: response.data.Timestamp,
        url: `${this.ipfsGateways[0]}${response.data.IpfsHash}`,
        provider: 'pinata'
      };
    } catch (error) {
      console.error('Pinata upload error:', error);
      throw new Error(`Failed to upload to IPFS via Pinata: ${error.message}`);
    }
  }

  // IPFS Upload via Web3.Storage
  async uploadToIPFSViaWeb3Storage(file, metadata = {}) {
    if (!this.config.web3Storage.token) {
      throw new Error('Web3.Storage token not configured');
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${this.config.web3Storage.baseUrl}/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.web3Storage.token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      return {
        hash: response.data.cid,
        size: file.size,
        timestamp: new Date().toISOString(),
        url: `${this.ipfsGateways[0]}${response.data.cid}`,
        provider: 'web3storage'
      };
    } catch (error) {
      console.error('Web3.Storage upload error:', error);
      throw new Error(`Failed to upload to IPFS via Web3.Storage: ${error.message}`);
    }
  }

  // Upload JSON data to IPFS
  async uploadJSONToIPFS(data, filename = 'data.json') {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], filename, { type: 'application/json' });

      // Try Pinata first, fallback to Web3.Storage
      try {
        return await this.uploadToIPFSViaPinata(file, { name: filename });
      } catch (error) {
        console.warn('Pinata failed, trying Web3.Storage:', error.message);
        return await this.uploadToIPFSViaWeb3Storage(file, { name: filename });
      }
    } catch (error) {
      console.error('JSON upload error:', error);
      throw new Error(`Failed to upload JSON to IPFS: ${error.message}`);
    }
  }

  // Upload to Arweave
  async uploadToArweave(file, metadata = {}) {
    try {
      // This is a simplified implementation
      // In production, you'd use the Arweave SDK
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadata));

      // Using a public Arweave gateway service
      const response = await axios.post('https://node1.bundlr.network/tx', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return {
        hash: response.data.id,
        size: file.size,
        timestamp: new Date().toISOString(),
        url: `${this.arweaveGateway}${response.data.id}`,
        provider: 'arweave'
      };
    } catch (error) {
      console.error('Arweave upload error:', error);
      throw new Error(`Failed to upload to Arweave: ${error.message}`);
    }
  }

  // Generic upload method that tries multiple providers
  async upload(file, options = {}) {
    const { provider = 'auto', metadata = {} } = options;

    if (provider === 'pinata') {
      return await this.uploadToIPFSViaPinata(file, metadata);
    } else if (provider === 'web3storage') {
      return await this.uploadToIPFSViaWeb3Storage(file, metadata);
    } else if (provider === 'arweave') {
      return await this.uploadToArweave(file, metadata);
    } else {
      // Auto mode: try providers in order of preference
      const providers = ['pinata', 'web3storage', 'arweave'];
      
      for (const providerName of providers) {
        try {
          switch (providerName) {
            case 'pinata':
              return await this.uploadToIPFSViaPinata(file, metadata);
            case 'web3storage':
              return await this.uploadToIPFSViaWeb3Storage(file, metadata);
            case 'arweave':
              return await this.uploadToArweave(file, metadata);
          }
        } catch (error) {
          console.warn(`${providerName} upload failed:`, error.message);
          continue;
        }
      }
      
      throw new Error('All storage providers failed');
    }
  }

  // Retrieve file from IPFS
  async retrieveFromIPFS(hash, gatewayIndex = 0) {
    const gateway = this.ipfsGateways[gatewayIndex];
    
    try {
      const response = await axios.get(`${gateway}${hash}`, {
        timeout: 10000 // 10 second timeout
      });
      
      return {
        data: response.data,
        contentType: response.headers['content-type'],
        size: response.headers['content-length'],
        url: `${gateway}${hash}`
      };
    } catch (error) {
      // Try next gateway if available
      if (gatewayIndex < this.ipfsGateways.length - 1) {
        console.warn(`Gateway ${gateway} failed, trying next...`);
        return await this.retrieveFromIPFS(hash, gatewayIndex + 1);
      }
      
      throw new Error(`Failed to retrieve from IPFS: ${error.message}`);
    }
  }

  // Retrieve file from Arweave
  async retrieveFromArweave(hash) {
    try {
      const response = await axios.get(`${this.arweaveGateway}${hash}`, {
        timeout: 15000 // 15 second timeout for Arweave
      });
      
      return {
        data: response.data,
        contentType: response.headers['content-type'],
        size: response.headers['content-length'],
        url: `${this.arweaveGateway}${hash}`
      };
    } catch (error) {
      throw new Error(`Failed to retrieve from Arweave: ${error.message}`);
    }
  }

  // Generic retrieve method
  async retrieve(hash, provider = 'auto') {
    if (provider === 'arweave' || hash.length === 43) {
      return await this.retrieveFromArweave(hash);
    } else {
      return await this.retrieveFromIPFS(hash);
    }
  }

  // Pin existing IPFS content via Pinata
  async pinToIPFS(hash, metadata = {}) {
    if (!this.config.pinata.apiKey || !this.config.pinata.secretKey) {
      throw new Error('Pinata API credentials not configured');
    }

    try {
      const response = await axios.post(
        `${this.config.pinata.baseUrl}/pinning/pinByHash`,
        {
          hashToPin: hash,
          pinataMetadata: {
            name: metadata.name || hash,
            keyvalues: metadata.keyvalues || {}
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'pinata_api_key': this.config.pinata.apiKey,
            'pinata_secret_api_key': this.config.pinata.secretKey
          }
        }
      );

      return {
        hash: response.data.ipfsHash,
        status: response.data.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Pin to IPFS error:', error);
      throw new Error(`Failed to pin to IPFS: ${error.message}`);
    }
  }

  // Unpin content from Pinata
  async unpinFromIPFS(hash) {
    if (!this.config.pinata.apiKey || !this.config.pinata.secretKey) {
      throw new Error('Pinata API credentials not configured');
    }

    try {
      await axios.delete(
        `${this.config.pinata.baseUrl}/pinning/unpin/${hash}`,
        {
          headers: {
            'pinata_api_key': this.config.pinata.apiKey,
            'pinata_secret_api_key': this.config.pinata.secretKey
          }
        }
      );

      return { success: true, hash };
    } catch (error) {
      console.error('Unpin from IPFS error:', error);
      throw new Error(`Failed to unpin from IPFS: ${error.message}`);
    }
  }

  // List pinned files
  async listPinnedFiles(options = {}) {
    if (!this.config.pinata.apiKey || !this.config.pinata.secretKey) {
      throw new Error('Pinata API credentials not configured');
    }

    try {
      const params = {
        status: options.status || 'pinned',
        pageLimit: options.limit || 10,
        pageOffset: options.offset || 0
      };

      if (options.metadata) {
        params.metadata = options.metadata;
      }

      const response = await axios.get(
        `${this.config.pinata.baseUrl}/data/pinList`,
        {
          params,
          headers: {
            'pinata_api_key': this.config.pinata.apiKey,
            'pinata_secret_api_key': this.config.pinata.secretKey
          }
        }
      );

      return {
        files: response.data.rows,
        count: response.data.count
      };
    } catch (error) {
      console.error('List pinned files error:', error);
      throw new Error(`Failed to list pinned files: ${error.message}`);
    }
  }

  // Get file info
  async getFileInfo(hash, provider = 'auto') {
    try {
      if (provider === 'arweave' || hash.length === 43) {
        // Arweave transaction info
        const response = await axios.get(`https://arweave.net/tx/${hash}`);
        return {
          hash,
          size: response.data.data_size,
          contentType: response.data.tags?.find(tag => tag.name === 'Content-Type')?.value,
          timestamp: new Date(parseInt(response.data.timestamp) * 1000).toISOString(),
          provider: 'arweave'
        };
      } else {
        // IPFS file info via gateway
        const response = await axios.head(`${this.ipfsGateways[0]}${hash}`);
        return {
          hash,
          size: response.headers['content-length'],
          contentType: response.headers['content-type'],
          timestamp: response.headers['last-modified'],
          provider: 'ipfs'
        };
      }
    } catch (error) {
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  // Validate hash format
  validateHash(hash, provider = 'auto') {
    if (provider === 'arweave' || hash.length === 43) {
      // Arweave hash validation (43 characters, base64url)
      return /^[A-Za-z0-9_-]{43}$/.test(hash);
    } else {
      // IPFS hash validation (CID)
      return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash) || // CIDv0
             /^b[A-Za-z2-7]{58}$/.test(hash) || // CIDv1 base32
             /^z[1-9A-HJ-NP-Za-km-z]{48}$/.test(hash); // CIDv1 base58
    }
  }

  // Generate metadata for NFT
  generateNFTMetadata(options = {}) {
    const {
      name,
      description,
      image,
      attributes = [],
      externalUrl,
      animationUrl,
      backgroundColor
    } = options;

    const metadata = {
      name,
      description,
      image,
      attributes: attributes.map(attr => ({
        trait_type: attr.trait_type,
        value: attr.value,
        ...(attr.display_type && { display_type: attr.display_type })
      }))
    };

    if (externalUrl) metadata.external_url = externalUrl;
    if (animationUrl) metadata.animation_url = animationUrl;
    if (backgroundColor) metadata.background_color = backgroundColor;

    return metadata;
  }

  // Upload NFT with metadata
  async uploadNFT(file, metadata, options = {}) {
    try {
      // Upload the main file first
      const fileResult = await this.upload(file, options);
      
      // Create metadata with image URL
      const nftMetadata = this.generateNFTMetadata({
        ...metadata,
        image: fileResult.url
      });

      // Upload metadata
      const metadataResult = await this.uploadJSONToIPFS(
        nftMetadata, 
        `${metadata.name || 'nft'}_metadata.json`
      );

      return {
        file: fileResult,
        metadata: metadataResult,
        nftMetadata
      };
    } catch (error) {
      throw new Error(`Failed to upload NFT: ${error.message}`);
    }
  }

  // Get storage stats
  async getStorageStats() {
    const stats = {
      pinata: { available: false, usage: null },
      web3storage: { available: false, usage: null },
      arweave: { available: false, usage: null }
    };

    // Check Pinata
    if (this.config.pinata.apiKey && this.config.pinata.secretKey) {
      try {
        const response = await axios.get(
          `${this.config.pinata.baseUrl}/data/userPinnedDataTotal`,
          {
            headers: {
              'pinata_api_key': this.config.pinata.apiKey,
              'pinata_secret_api_key': this.config.pinata.secretKey
            }
          }
        );
        stats.pinata = {
          available: true,
          usage: {
            pinCount: response.data.pin_count,
            pinSizeTotal: response.data.pin_size_total,
            pinSizeWithReplicationsTotal: response.data.pin_size_with_replications_total
          }
        };
      } catch (error) {
        console.warn('Failed to get Pinata stats:', error.message);
      }
    }

    return stats;
  }
}

// Create singleton instance
const storageService = new StorageService();

export default storageService;
