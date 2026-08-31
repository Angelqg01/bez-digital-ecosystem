import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';
import WalletConnect from '@walletconnect/client';
import { WalletConnectModal } from '@walletconnect/modal-react-native';

class WalletService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.address = null;
    this.chainId = null;
    this.walletConnect = null;
    this.isConnected = false;
    this.supportedWallets = [
      {
        id: 'metamask',
        name: 'MetaMask',
        icon: 'account-balance-wallet',
        deepLink: 'metamask://dapp/',
        universalLink: 'https://metamask.app.link/dapp/',
      },
      {
        id: 'trust',
        name: 'Trust Wallet',
        icon: 'security',
        deepLink: 'trust://dapp/',
        universalLink: 'https://link.trustwallet.com/open_url?coin_id=60&url=',
      },
      {
        id: 'rainbow',
        name: 'Rainbow',
        icon: 'palette',
        deepLink: 'rainbow://dapp/',
        universalLink: 'https://rnbwapp.com/dapp/',
      },
      {
        id: 'coinbase',
        name: 'Coinbase Wallet',
        icon: 'monetization-on',
        deepLink: 'cbwallet://dapp/',
        universalLink: 'https://go.cb-w.com/dapp?cb_url=',
      },
      {
        id: 'walletconnect',
        name: 'WalletConnect',
        icon: 'link',
        isWalletConnect: true,
      }
    ];
  }

  async initialize() {
    try {
      // Check for saved wallet connection
      const savedWallet = await AsyncStorage.getItem('connectedWallet');
      const savedAddress = await AsyncStorage.getItem('walletAddress');
      
      if (savedWallet && savedAddress) {
        await this.reconnectWallet(savedWallet);
      }
    } catch (error) {
      console.error('Wallet service initialization error:', error);
    }
  }

  async connectWallet(walletId) {
    try {
      if (walletId === 'walletconnect') {
        return await this.connectWalletConnect();
      } else {
        return await this.connectMobileWallet(walletId);
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      throw error;
    }
  }

  async connectWalletConnect() {
    try {
      const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID;
      
      if (!projectId) {
        throw new Error('WalletConnect project ID not configured');
      }

      this.walletConnect = new WalletConnect({
        bridge: 'https://bridge.walletconnect.org',
        qrcodeModal: WalletConnectModal,
        clientMeta: {
          description: 'BeZhas Web3 Mobile App',
          url: 'https://bez.digital',
          icons: ['https://bez.digital/logo.png'],
          name: 'BeZhas Mobile',
        },
      });

      // Check if already connected
      if (this.walletConnect.connected) {
        await this.walletConnect.killSession();
      }

      // Create session
      await this.walletConnect.createSession();

      return new Promise((resolve, reject) => {
        // Subscribe to connection events
        this.walletConnect.on('connect', (error, payload) => {
          if (error) {
            reject(error);
            return;
          }

          const { accounts, chainId } = payload.params[0];
          this.address = accounts[0];
          this.chainId = chainId;
          this.isConnected = true;

          // Save connection info
          this.saveWalletConnection('walletconnect');
          
          resolve({
            address: this.address,
            chainId: this.chainId,
            walletId: 'walletconnect'
          });
        });

        this.walletConnect.on('session_update', (error, payload) => {
          if (error) {
            console.error('Session update error:', error);
            return;
          }

          const { accounts, chainId } = payload.params[0];
          this.address = accounts[0];
          this.chainId = chainId;
        });

        this.walletConnect.on('disconnect', (error, payload) => {
          if (error) {
            console.error('Disconnect error:', error);
          }

          this.disconnect();
        });

        // Timeout after 2 minutes
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 120000);
      });
    } catch (error) {
      console.error('WalletConnect error:', error);
      throw error;
    }
  }

  async connectMobileWallet(walletId) {
    try {
      const wallet = this.supportedWallets.find(w => w.id === walletId);
      if (!wallet) {
        throw new Error('Unsupported wallet');
      }

      // For mobile wallets, we need to use deep linking
      const { Linking } = require('react-native');
      
      // Create a connection request URL
      const dappUrl = encodeURIComponent('https://bez.digital');
      const deepLinkUrl = wallet.deepLink + dappUrl;
      const universalLinkUrl = wallet.universalLink + dappUrl;

      // Try to open the wallet app
      const canOpen = await Linking.canOpenURL(deepLinkUrl);
      
      if (canOpen) {
        await Linking.openURL(deepLinkUrl);
      } else {
        await Linking.openURL(universalLinkUrl);
      }

      // For now, return a mock connection (in real implementation, this would be handled by the wallet app)
      return new Promise((resolve, reject) => {
        // Simulate wallet connection response
        setTimeout(() => {
          // This would normally come from the wallet app via deep linking
          const mockAddress = '0x742d35Cc6634C0532925a3b8D0A4E5C4C0532925';
          const mockChainId = 1;

          this.address = mockAddress;
          this.chainId = mockChainId;
          this.isConnected = true;

          this.saveWalletConnection(walletId);

          resolve({
            address: this.address,
            chainId: this.chainId,
            walletId: walletId
          });
        }, 2000);
      });
    } catch (error) {
      console.error('Mobile wallet connection error:', error);
      throw error;
    }
  }

  async reconnectWallet(walletId) {
    try {
      if (walletId === 'walletconnect') {
        // Try to restore WalletConnect session
        const session = await AsyncStorage.getItem('walletconnect_session');
        if (session) {
          const sessionData = JSON.parse(session);
          this.walletConnect = new WalletConnect(sessionData);
          
          if (this.walletConnect.connected) {
            this.address = this.walletConnect.accounts[0];
            this.chainId = this.walletConnect.chainId;
            this.isConnected = true;
            return true;
          }
        }
      } else {
        // For mobile wallets, check if we have saved credentials
        const savedAddress = await AsyncStorage.getItem('walletAddress');
        if (savedAddress) {
          this.address = savedAddress;
          this.isConnected = true;
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Wallet reconnection error:', error);
      return false;
    }
  }

  async saveWalletConnection(walletId) {
    try {
      await AsyncStorage.setItem('connectedWallet', walletId);
      await AsyncStorage.setItem('walletAddress', this.address);
      
      if (walletId === 'walletconnect' && this.walletConnect) {
        await AsyncStorage.setItem('walletconnect_session', JSON.stringify(this.walletConnect.session));
      }
    } catch (error) {
      console.error('Error saving wallet connection:', error);
    }
  }

  async disconnect() {
    try {
      if (this.walletConnect && this.walletConnect.connected) {
        await this.walletConnect.killSession();
      }

      this.provider = null;
      this.signer = null;
      this.address = null;
      this.chainId = null;
      this.walletConnect = null;
      this.isConnected = false;

      // Clear saved data
      await AsyncStorage.multiRemove([
        'connectedWallet',
        'walletAddress',
        'walletconnect_session'
      ]);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  async signMessage(message) {
    try {
      if (!this.isConnected) {
        throw new Error('Wallet not connected');
      }

      if (this.walletConnect) {
        const msgParams = [
          ethers.hexlify(ethers.toUtf8Bytes(message)),
          this.address
        ];

        const signature = await this.walletConnect.signPersonalMessage(msgParams);
        return signature;
      } else {
        // For mobile wallets, this would require deep linking to the wallet app
        throw new Error('Message signing not implemented for this wallet');
      }
    } catch (error) {
      console.error('Message signing error:', error);
      throw error;
    }
  }

  async sendTransaction(transaction) {
    try {
      if (!this.isConnected) {
        throw new Error('Wallet not connected');
      }

      if (this.walletConnect) {
        const txHash = await this.walletConnect.sendTransaction(transaction);
        return txHash;
      } else {
        // For mobile wallets, this would require deep linking to the wallet app
        throw new Error('Transaction sending not implemented for this wallet');
      }
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  }

  async switchNetwork(chainId) {
    try {
      if (!this.isConnected) {
        throw new Error('Wallet not connected');
      }

      // Network configurations
      const networks = {
        1: {
          chainId: '0x1',
          chainName: 'Ethereum Mainnet',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://mainnet.infura.io/v3/'],
          blockExplorerUrls: ['https://etherscan.io/']
        },
        137: {
          chainId: '0x89',
          chainName: 'Polygon Mainnet',
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
          rpcUrls: ['https://polygon-rpc.com/'],
          blockExplorerUrls: ['https://polygonscan.com/']
        },
        56: {
          chainId: '0x38',
          chainName: 'Binance Smart Chain',
          nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
          rpcUrls: ['https://bsc-dataseed.binance.org/'],
          blockExplorerUrls: ['https://bscscan.com/']
        }
      };

      const networkConfig = networks[chainId];
      if (!networkConfig) {
        throw new Error('Unsupported network');
      }

      if (this.walletConnect) {
        // Request network switch via WalletConnect
        await this.walletConnect.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: networkConfig.chainId }]
        });
      }

      this.chainId = chainId;
      return true;
    } catch (error) {
      console.error('Network switch error:', error);
      throw error;
    }
  }

  async addToken(tokenAddress, tokenSymbol, tokenDecimals, tokenImage) {
    try {
      if (!this.isConnected) {
        throw new Error('Wallet not connected');
      }

      if (this.walletConnect) {
        await this.walletConnect.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: tokenAddress,
              symbol: tokenSymbol,
              decimals: tokenDecimals,
              image: tokenImage
            }
          }
        });
      }

      return true;
    } catch (error) {
      console.error('Add token error:', error);
      throw error;
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      address: this.address,
      chainId: this.chainId
    };
  }

  getSupportedWallets() {
    return this.supportedWallets;
  }

  async getBalance() {
    try {
      if (!this.isConnected) {
        throw new Error('Wallet not connected');
      }

      // This would require a provider to get the actual balance
      // For now, return a mock balance
      return '1.5'; // ETH
    } catch (error) {
      console.error('Get balance error:', error);
      throw error;
    }
  }
}

// Create singleton instance
const walletService = new WalletService();

export default walletService;
