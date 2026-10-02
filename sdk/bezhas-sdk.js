/**
 * BeZhas Web3 SDK
 * Official JavaScript SDK for BeZhas Platform
 * Version: 1.0.0
 */

import { ethers } from 'ethers';
import axios from 'axios';
import { BezhasConfig } from './bezhas-config.js';

class BeZhasSDK {
  constructor(config = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'https://api.bezhas.com',
      network: config.network || 'mainnet',
      provider: config.provider || null,
      contracts: config.contracts || {},
      apiKey: config.apiKey || null,
      ...config
    };

    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.wallet = null;

    this._initializeProvider();
  }

  // Initialize provider and contracts
  async _initializeProvider() {
    try {
      if (this.config.provider) {
        this.provider = this.config.provider;
      } else if (typeof window !== 'undefined' && window.ethereum) {
        this.provider = new ethers.BrowserProvider(window.ethereum);
      } else {
        // Use default provider for read-only operations
        // If network is local, we might need JsonRpcProvider
        if (this.config.network === 'localhost') {
          this.provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        } else {
          this.provider = ethers.getDefaultProvider(this.config.network);
        }
      }

      await this._loadContracts();
    } catch (error) {
      console.error('Failed to initialize provider:', error);
    }
  }

  async _loadContracts() {
    const contractsConfig = BezhasConfig.contracts;

    // Load contract ABIs and create contract instances
    for (const [name, config] of Object.entries(contractsConfig)) {
      try {
        if (config.address && config.abi && this.provider) {
          this.contracts[name] = new ethers.Contract(config.address, config.abi, this.provider);
        }
      } catch (error) {
        console.warn(`Failed to load contract ${name}:`, error);
      }
    }
  }

  // Wallet connection methods
  async connectWallet(walletType = 'metamask') {
    try {
      if (walletType === 'metamask' && window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();
        this.wallet = await this.signer.getAddress();

        // Update contracts with signer
        for (const [name, contract] of Object.entries(this.contracts)) {
          this.contracts[name] = contract.connect(this.signer);
        }

        return {
          success: true,
          address: this.wallet,
          provider: 'metamask'
        };
      }

      throw new Error(`Wallet type ${walletType} not supported`);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async disconnectWallet() {
    this.signer = null;
    this.wallet = null;

    // Reset contracts to read-only
    await this._loadContracts();

    return { success: true };
  }

  getWalletAddress() {
    return this.wallet;
  }

  isConnected() {
    return !!this.wallet;
  }

  // Token operations
  async getTokenBalance(address = null) {
    try {
      const targetAddress = address || this.wallet;
      if (!targetAddress) throw new Error('No address provided');

      const balance = await this.contracts.BezhasToken.balanceOf(targetAddress);
      return {
        success: true,
        balance: ethers.formatEther(balance),
        raw: balance
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async transferTokens(to, amount) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');

      const amountWei = ethers.parseEther(amount.toString());
      const tx = await this.contracts.BezhasToken.transfer(to, amountWei);

      return {
        success: true,
        txHash: tx.hash,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async approveTokens(spender, amount) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');

      const amountWei = ethers.parseEther(amount.toString());
      const tx = await this.contracts.BezhasToken.approve(spender, amountWei);

      return {
        success: true,
        txHash: tx.hash,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // NFT operations
  async getNFTBalance(address = null) {
    try {
      const targetAddress = address || this.wallet;
      if (!targetAddress) throw new Error('No address provided');

      const balance = await this.contracts.BezhasNFT.balanceOf(targetAddress);
      return {
        success: true,
        balance: balance.toNumber()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getNFTsByOwner(address = null) {
    try {
      const targetAddress = address || this.wallet;
      if (!targetAddress) throw new Error('No address provided');

      const balance = await this.contracts.BezhasNFT.balanceOf(targetAddress);
      const nfts = [];

      for (let i = 0; i < balance.toNumber(); i++) {
        const tokenId = await this.contracts.BezhasNFT.tokenOfOwnerByIndex(targetAddress, i);
        const tokenURI = await this.contracts.BezhasNFT.tokenURI(tokenId);

        nfts.push({
          tokenId: tokenId.toNumber(),
          tokenURI,
          owner: targetAddress
        });
      }

      return {
        success: true,
        nfts
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async mintNFT(to, tokenURI) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');

      const tx = await this.contracts.BezhasNFT.mint(to, tokenURI);

      return {
        success: true,
        txHash: tx.hash,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async transferNFT(from, to, tokenId) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');

      const tx = await this.contracts.BezhasNFT.transferFrom(from, to, tokenId);

      return {
        success: true,
        txHash: tx.hash,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Marketplace operations
  async listNFT(tokenId, price) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');

      const priceWei = ethers.utils.parseEther(price.toString());
      const tx = await this.contracts.Marketplace.listItem(tokenId, priceWei);

      return {
        success: true,
        txHash: tx.hash,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buyNFT(tokenId, price) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');

      const priceWei = ethers.utils.parseEther(price.toString());
      const tx = await this.contracts.Marketplace.buyItem(tokenId, { value: priceWei });

      return {
        success: true,
        txHash: tx.hash,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getMarketplaceListings() {
    try {
      const response = await this._apiCall('/api/nfts', 'GET');
      return {
        success: true,
        listings: response.data.nfts
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Staking operations
  async stakeTokens(amount) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');

      const amountWei = ethers.utils.parseEther(amount.toString());
      const tx = await this.contracts.StakingPool.stake(amountWei);

      return {
        success: true,
        txHash: tx.hash,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async unstakeTokens(amount) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');

      const amountWei = ethers.utils.parseEther(amount.toString());
      const tx = await this.contracts.StakingPool.unstake(amountWei);

      return {
        success: true,
        txHash: tx.hash,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getStakingInfo(address = null) {
    try {
      const targetAddress = address || this.wallet;
      if (!targetAddress) throw new Error('No address provided');

      const stakedAmount = await this.contracts.StakingPool.getStakedAmount(targetAddress);
      const pendingRewards = await this.contracts.StakingPool.getPendingRewards(targetAddress);

      return {
        success: true,
        stakedAmount: ethers.utils.formatEther(stakedAmount),
        pendingRewards: ethers.utils.formatEther(pendingRewards)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async claimRewards() {
    try {
      if (!this.signer) throw new Error('Wallet not connected');

      const tx = await this.contracts.StakingPool.claimRewards();

      return {
        success: true,
        txHash: tx.hash,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Gamification operations
  async getUserProfile(address = null) {
    try {
      const targetAddress = address || this.wallet;
      if (!targetAddress) throw new Error('No address provided');

      const profile = await this.contracts.GamificationSystem.getUserProfile(targetAddress);

      return {
        success: true,
        profile: {
          level: profile.level.toNumber(),
          experience: profile.experience.toNumber(),
          totalPoints: profile.totalPoints.toNumber(),
          streakDays: profile.streakDays.toNumber()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAchievements() {
    try {
      const achievements = await this.contracts.GamificationSystem.getActiveAchievements();

      return {
        success: true,
        achievements: achievements.map(achievement => ({
          id: achievement.id.toNumber(),
          name: achievement.name,
          description: achievement.description,
          pointsReward: achievement.pointsReward.toNumber(),
          tokenReward: ethers.utils.formatEther(achievement.tokenReward),
          rarity: achievement.rarity.toNumber()
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async joinChallenge(challengeId) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');

      const tx = await this.contracts.GamificationSystem.joinChallenge(challengeId);

      return {
        success: true,
        txHash: tx.hash,
        transaction: tx
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // API operations
  async _apiCall(endpoint, method = 'GET', data = null) {
    const config = {
      method,
      url: `${this.config.apiUrl}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.config.apiKey) {
      config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    if (data) {
      config.data = data;
    }

    return await axios(config);
  }

  async getMarketStats() {
    try {
      const response = await this._apiCall('/api/market/stats');
      return {
        success: true,
        stats: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAnalytics(address = null) {
    try {
      const targetAddress = address || this.wallet;
      if (!targetAddress) throw new Error('No address provided');

      const response = await this._apiCall(`/api/analytics/user/${targetAddress}`);
      return {
        success: true,
        analytics: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async uploadToIPFS(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this._apiCall('/api/upload/ipfs', 'POST', formData);
      return {
        success: true,
        ipfsHash: response.data.ipfsHash,
        url: response.data.url
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Utility methods
  async waitForTransaction(txHash) {
    try {
      const receipt = await this.provider.waitForTransaction(txHash);
      return {
        success: true,
        receipt
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatEther(value) {
    return ethers.utils.formatEther(value);
  }

  parseEther(value) {
    return ethers.utils.parseEther(value.toString());
  }

  isValidAddress(address) {
    return ethers.utils.isAddress(address);
  }

  // Event listeners
  onWalletChange(callback) {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', callback);
    }
  }

  onNetworkChange(callback) {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', callback);
    }
  }

  // Contract event listeners
  onTokenTransfer(callback) {
    if (this.contracts.BezhasToken) {
      this.contracts.BezhasToken.on('Transfer', callback);
    }
  }

  onNFTTransfer(callback) {
    if (this.contracts.BezhasNFT) {
      this.contracts.BezhasNFT.on('Transfer', callback);
    }
  }

  onMarketplaceSale(callback) {
    if (this.contracts.Marketplace) {
      this.contracts.Marketplace.on('ItemSold', callback);
    }
  }

  // Cleanup
  removeAllListeners() {
    Object.values(this.contracts).forEach(contract => {
      if (contract.removeAllListeners) {
        contract.removeAllListeners();
      }
    });
  }

  // ═══════════════════════════════════════════════
  //  SMART WALLET (Account Abstraction)
  // ═══════════════════════════════════════════════

  async createSmartWallet(guardian = null, dailyLimit = 0) {
    try {
      const res = await this._apiPost('/wallet/create', {
        guardian, dailyLimit
      });
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getMySmartWallets() {
    try {
      const res = await this._apiGet('/wallet/my-wallets');
      return { success: true, wallets: res.data.wallets };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getSmartWalletInfo(walletAddress) {
    try {
      const res = await this._apiGet(`/wallet/info/${walletAddress}`);
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getWalletPortfolio() {
    try {
      const res = await this._apiGet('/wallet/portfolio');
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getWalletDailyLimit(walletAddress) {
    try {
      const res = await this._apiGet(`/wallet/daily-limit/${walletAddress}`);
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════
  //  MULTI-SIG WALLET (Enterprise)
  // ═══════════════════════════════════════════════

  async getMultiSigInfo(msigAddress) {
    try {
      const res = await this._apiGet(`/wallet/multisig/${msigAddress}`);
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getMultiSigPendingTxs(msigAddress) {
    try {
      const res = await this._apiGet(`/wallet/multisig/${msigAddress}/pending`);
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════
  //  PAYMASTER (Gas Sponsorship)
  // ═══════════════════════════════════════════════

  async getPaymasterInfo(enterpriseAddress) {
    try {
      const res = await this._apiGet(`/wallet/paymaster/${enterpriseAddress}`);
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════
  //  SECURITY
  // ═══════════════════════════════════════════════

  async getSecurityStatus() {
    try {
      const res = await this._apiGet('/wallet/security/status');
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAuditLogs(count = 20) {
    try {
      const res = await this._apiGet(`/wallet/security/audit-log?count=${count}`);
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════
  //  WALLET GUARDIAN
  // ═══════════════════════════════════════════════

  async getWalletGuardians(walletAddress) {
    try {
      const res = await this._apiGet(`/wallet/guardians/${walletAddress}`);
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getGuardianTrustScore(guardianAddress) {
    try {
      const res = await this._apiGet(`/wallet/guardian-score/${guardianAddress}`);
      return { success: true, ...res.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════
  //  DIRECT ON-CHAIN WALLET INTERACTIONS
  //  (when user has signer — bypasses API)
  // ═══════════════════════════════════════════════

  async executeSmartWalletTx(walletAddress, target, value, data) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');
      const abi = ['function execute(address,uint256,bytes) returns (bytes)'];
      const sw = new ethers.Contract(walletAddress, abi, this.signer);
      const tx = await sw.execute(target, ethers.parseEther(String(value)), data || '0x');
      return { success: true, txHash: tx.hash };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async lockSmartWallet(walletAddress) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');
      const abi = ['function lockWallet()'];
      const sw = new ethers.Contract(walletAddress, abi, this.signer);
      const tx = await sw.lockWallet();
      return { success: true, txHash: tx.hash };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async unlockSmartWallet(walletAddress) {
    try {
      if (!this.signer) throw new Error('Wallet not connected');
      const abi = ['function unlockWallet()'];
      const sw = new ethers.Contract(walletAddress, abi, this.signer);
      const tx = await sw.unlockWallet();
      return { success: true, txHash: tx.hash };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ─── Internal API helpers ───────────────────────

  async _apiGet(path) {
    const headers = {};
    if (this._authToken) headers['Authorization'] = `Bearer ${this._authToken}`;
    if (this.config.apiKey) headers['X-API-Key'] = this.config.apiKey;
    return axios.get(`${this.config.apiUrl}/api${path}`, { headers });
  }

  async _apiPost(path, data) {
    const headers = {};
    if (this._authToken) headers['Authorization'] = `Bearer ${this._authToken}`;
    if (this.config.apiKey) headers['X-API-Key'] = this.config.apiKey;
    return axios.post(`${this.config.apiUrl}/api${path}`, data, { headers });
  }

  setAuthToken(token) {
    this._authToken = token;
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BeZhasSDK;
}

if (typeof window !== 'undefined') {
  window.BeZhasSDK = BeZhasSDK;
}

export default BeZhasSDK;
