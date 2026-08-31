/**
 * @deprecated — LEGACY SERVICE. Wallet connection now handled by:
 *   - _shared/bezhas-blockchain-client.js → BeZhasClient.connectWallet()
 *   - bez-wallet SubApp for full multi-wallet management
 * The Hub should use hubBlockchainService.js → connectWallet() instead.
 */
import { ethers } from 'ethers';
class WalletConnector {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.account = null;
    this.chainId = null;
    this.walletType = null;
    this.listeners = [];
  }

  // Add event listener
  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  // Emit event to all listeners
  emit(event, data) {
    this.listeners
      .filter(listener => listener.event === event)
      .forEach(listener => listener.callback(data));
  }

  // Check if wallet is available
  isWalletAvailable(walletType) {
    switch (walletType) {
      case 'metamask':
        return typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask;
      case 'walletconnect':
        return typeof window !== 'undefined';
      case 'coinbase':
        return typeof window !== 'undefined' && window.ethereum && window.ethereum.isCoinbaseWallet;
      case 'trust':
        return typeof window !== 'undefined' && window.ethereum && window.ethereum.isTrust;
      case 'brave':
        return typeof window !== 'undefined' && window.ethereum && window.ethereum.isBraveWallet;
      default:
        return false;
    }
  }

  // Get available wallets
  getAvailableWallets() {
    const wallets = [];

    if (this.isWalletAvailable('metamask')) {
      wallets.push({
        type: 'metamask',
        name: 'MetaMask',
        icon: '🦊',
        description: 'Connect using MetaMask wallet'
      });
    }

    if (this.isWalletAvailable('coinbase')) {
      wallets.push({
        type: 'coinbase',
        name: 'Coinbase Wallet',
        icon: '🔷',
        description: 'Connect using Coinbase Wallet'
      });
    }

    if (this.isWalletAvailable('trust')) {
      wallets.push({
        type: 'trust',
        name: 'Trust Wallet',
        icon: '🛡️',
        description: 'Connect using Trust Wallet'
      });
    }

    if (this.isWalletAvailable('brave')) {
      wallets.push({
        type: 'brave',
        name: 'Brave Wallet',
        icon: '🦁',
        description: 'Connect using Brave Wallet'
      });
    }

    // WalletConnect is always available as it's a protocol
    wallets.push({
      type: 'walletconnect',
      name: 'WalletConnect',
      icon: '🔗',
      description: 'Connect using WalletConnect protocol'
    });

    return wallets;
  }

  // Connect to MetaMask
  async connectMetaMask() {
    if (!this.isWalletAvailable('metamask')) {
      throw new Error('MetaMask is not installed');
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.account = await this.signer.getAddress();
      this.chainId = await this.provider.getNetwork().then(network => Number(network.chainId));
      this.walletType = 'metamask';

      this.setupEventListeners();
      this.emit('connected', { account: this.account, walletType: this.walletType });

      return {
        provider: this.provider,
        signer: this.signer,
        account: this.account,
        chainId: this.chainId
      };
    } catch (error) {
      throw new Error(`Failed to connect to MetaMask: ${error.message}`);
    }
  }

  // Connect to Coinbase Wallet
  async connectCoinbase() {
    if (!this.isWalletAvailable('coinbase')) {
      throw new Error('Coinbase Wallet is not installed');
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.account = await this.signer.getAddress();
      this.chainId = await this.provider.getNetwork().then(network => Number(network.chainId));
      this.walletType = 'coinbase';

      this.setupEventListeners();
      this.emit('connected', { account: this.account, walletType: this.walletType });

      return {
        provider: this.provider,
        signer: this.signer,
        account: this.account,
        chainId: this.chainId
      };
    } catch (error) {
      throw new Error(`Failed to connect to Coinbase Wallet: ${error.message}`);
    }
  }

  // Connect using WalletConnect
  async connectWalletConnect() {
    try {
      // Dynamic import for WalletConnect
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');

      const walletConnectProvider = await EthereumProvider.init({
        projectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || 'your-project-id',
        chains: [1, 5, 137, 80001], // Ethereum, Goerli, Polygon, Mumbai
        showQrModal: true,
        methods: ['eth_sendTransaction', 'personal_sign'],
        events: ['chainChanged', 'accountsChanged']
      });

      await walletConnectProvider.enable();

      this.provider = new ethers.BrowserProvider(walletConnectProvider);
      this.signer = await this.provider.getSigner();
      this.account = await this.signer.getAddress();
      this.chainId = await this.provider.getNetwork().then(network => Number(network.chainId));
      this.walletType = 'walletconnect';

      this.setupWalletConnectListeners(walletConnectProvider);
      this.emit('connected', { account: this.account, walletType: this.walletType });

      return {
        provider: this.provider,
        signer: this.signer,
        account: this.account,
        chainId: this.chainId
      };
    } catch (error) {
      throw new Error(`Failed to connect via WalletConnect: ${error.message}`);
    }
  }

  // Connect to Trust Wallet
  async connectTrust() {
    if (!this.isWalletAvailable('trust')) {
      throw new Error('Trust Wallet is not installed');
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.account = await this.signer.getAddress();
      this.chainId = await this.provider.getNetwork().then(network => Number(network.chainId));
      this.walletType = 'trust';

      this.setupEventListeners();
      this.emit('connected', { account: this.account, walletType: this.walletType });

      return {
        provider: this.provider,
        signer: this.signer,
        account: this.account,
        chainId: this.chainId
      };
    } catch (error) {
      throw new Error(`Failed to connect to Trust Wallet: ${error.message}`);
    }
  }

  // Connect to Brave Wallet
  async connectBrave() {
    if (!this.isWalletAvailable('brave')) {
      throw new Error('Brave Wallet is not installed');
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.account = await this.signer.getAddress();
      this.chainId = await this.provider.getNetwork().then(network => Number(network.chainId));
      this.walletType = 'brave';

      this.setupEventListeners();
      this.emit('connected', { account: this.account, walletType: this.walletType });

      return {
        provider: this.provider,
        signer: this.signer,
        account: this.account,
        chainId: this.chainId
      };
    } catch (error) {
      throw new Error(`Failed to connect to Brave Wallet: ${error.message}`);
    }
  }

  // Generic connect method
  async connect(walletType) {
    switch (walletType) {
      case 'metamask':
        return await this.connectMetaMask();
      case 'coinbase':
        return await this.connectCoinbase();
      case 'walletconnect':
        return await this.connectWalletConnect();
      case 'trust':
        return await this.connectTrust();
      case 'brave':
        return await this.connectBrave();
      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
  }

  // Setup event listeners for wallet changes
  setupEventListeners() {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          this.disconnect();
        } else {
          this.account = accounts[0];
          this.emit('accountChanged', { account: this.account });
        }
      });

      window.ethereum.on('chainChanged', (chainId) => {
        this.chainId = parseInt(chainId, 16);
        this.emit('chainChanged', { chainId: this.chainId });
      });

      window.ethereum.on('disconnect', () => {
        this.disconnect();
      });
    }
  }

  // Setup WalletConnect specific listeners
  setupWalletConnectListeners(walletConnectProvider) {
    walletConnectProvider.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        this.account = accounts[0];
        this.emit('accountChanged', { account: this.account });
      }
    });

    walletConnectProvider.on('chainChanged', (chainId) => {
      this.chainId = chainId;
      this.emit('chainChanged', { chainId: this.chainId });
    });

    walletConnectProvider.on('disconnect', () => {
      this.disconnect();
    });
  }

  // Disconnect wallet
  async disconnect() {
    if (this.walletType === 'walletconnect' && this.provider?.provider?.disconnect) {
      await this.provider.provider.disconnect();
    }

    this.provider = null;
    this.signer = null;
    this.account = null;
    this.chainId = null;
    this.walletType = null;

    this.emit('disconnected', {});
  }

  // Switch network
  async switchNetwork(chainId) {
    if (!this.provider) {
      throw new Error('No wallet connected');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        const networkConfig = this.getNetworkConfig(chainId);
        if (networkConfig) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
        }
      } else {
        throw switchError;
      }
    }
  }

  // Get network configuration
  getNetworkConfig(chainId) {
    const networks = {
      1: {
        chainId: '0x1',
        chainName: 'Ethereum Mainnet',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://mainnet.infura.io/v3/'],
        blockExplorerUrls: ['https://etherscan.io/']
      },
      5: {
        chainId: '0x5',
        chainName: 'Goerli Testnet',
        nativeCurrency: { name: 'GoerliETH', symbol: 'GoerliETH', decimals: 18 },
        rpcUrls: ['https://goerli.infura.io/v3/'],
        blockExplorerUrls: ['https://goerli.etherscan.io/']
      },
      137: {
        chainId: '0x89',
        chainName: 'Polygon Mainnet',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        rpcUrls: ['https://polygon-bor-rpc.publicnode.com/'],
        blockExplorerUrls: ['https://polygonscan.com/']
      },
      80001: {
        chainId: '0x13881',
        chainName: 'Mumbai Testnet',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
        blockExplorerUrls: ['https://mumbai.polygonscan.com/']
      }
    };

    return networks[chainId];
  }

  // Add token to wallet
  async addToken(tokenAddress, tokenSymbol, tokenDecimals, tokenImage) {
    if (!this.provider) {
      throw new Error('No wallet connected');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenAddress,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            image: tokenImage,
          },
        },
      });
    } catch (error) {
      throw new Error(`Failed to add token: ${error.message}`);
    }
  }

  // Sign message
  async signMessage(message) {
    if (!this.signer) {
      throw new Error('No wallet connected');
    }

    try {
      return await this.signer.signMessage(message);
    } catch (error) {
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }

  // Get balance
  async getBalance(address = null) {
    if (!this.provider) {
      throw new Error('No wallet connected');
    }

    try {
      const targetAddress = address || this.account;
      const balance = await this.provider.getBalance(targetAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  // Get connection status
  isConnected() {
    return !!(this.provider && this.account);
  }

  // Get current connection info
  getConnectionInfo() {
    return {
      provider: this.provider,
      signer: this.signer,
      account: this.account,
      chainId: this.chainId,
      walletType: this.walletType,
      isConnected: this.isConnected()
    };
  }
}

// Create singleton instance
const walletConnector = new WalletConnector();

export default walletConnector;
