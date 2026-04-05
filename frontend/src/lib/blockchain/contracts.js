// ABIs importados desde la carpeta /abis
import MarketplaceABI from './abis/Marketplace.json';
import BezhasNFTABI from './abis/BezhasNFT.json';
import BezhasTokenABI from './abis/BezhasToken.json';
import BEZCoinABI from './abis/BEZCoin.json';
import StakingPoolABI from './abis/StakingPool.json';
import UserProfileABI from './abis/UserProfile.json';

// Exportamos los ABIs para que puedan ser utilizados en toda la aplicación
export const marketplaceAbi = MarketplaceABI;
export const nftAbi = BezhasNFTABI;
export const tokenAbi = BezhasTokenABI;
export const bezCoinAbi = BEZCoinABI;
export const stakingAbi = StakingPoolABI;
export const userProfileAbi = UserProfileABI;

// Direcciones de los contratos desplegados
export const contractAddresses = {
  marketplace: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  bezhasNFT: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  bezhasToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  bezCoin: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8', // BEZ-Coin nuevo contrato corregido en Polygon
  stakingPool: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
  userProfile: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
};

// Configuración de redes blockchain
export const networks = {
  polygon: {
    chainId: 137,
    chainIdHex: '0x89',
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    contracts: {
      bezCoin: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8'
    }
  },
  localhost: {
    chainId: 31337,
    chainIdHex: '0x7a69',
    name: 'Localhost',
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorer: '',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      marketplace: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
      bezhasNFT: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
      bezhasToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      stakingPool: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
      userProfile: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
    }
  }
};

// Función para obtener la dirección del contrato según la red
export const getContractAddress = (contractName, chainId = 137) => {
  if (chainId === 137) {
    return networks.polygon.contracts[contractName];
  }
  return networks.localhost.contracts[contractName] || contractAddresses[contractName];
};
