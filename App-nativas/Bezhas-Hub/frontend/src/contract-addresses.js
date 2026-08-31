/**
 * @deprecated — LEGACY MODULE. ABIs and contract addresses now resolved via:
 *   - API Gateway: /contracts/catalog, /abi-public/:name
 *   - SDK: sdk/contracts.js (88 contracts, 14 sectors)
 *   - Shared client: BeZhasClient.getContractInfo(name)
 * These local artifact imports have BROKEN paths (../../artifacts/).
 * Use hubBlockchainService.js → getContractABI() for the Developer Console.
 */
import contractAddresses from './contract-addresses.json';

// ABIs importados desde los artefactos de compilación
import UserProfileArtifact from '../../artifacts/contracts/UserProfile.sol/UserProfile.json';
import PostArtifact from '../../artifacts/contracts/Post.sol/Post.json';
import BezhasNFTArtifact from '../../artifacts/contracts/BezhasNFT.sol/BezhasNFT.json';
import MarketplaceArtifact from '../../artifacts/contracts/Marketplace.sol/Marketplace.json';
import BezhasTokenArtifact from '../../artifacts/contracts/BezhasToken.sol/BezhasToken.json';
import TokenSaleArtifact from '../../artifacts/contracts/TokenSale.sol/TokenSale.json';
import MessagesArtifact from '../../artifacts/contracts/Messages.sol/Messages.json';
import BezhasBridgeArtifact from '../../artifacts/contracts/BezhasBridge.sol/BezhasBridge.json';

// Exportar dinámicamente las direcciones de los contratos
export const {
    UserProfileAddress,
    PostAddress,
    BezhasNFTAddress,
    MarketplaceAddress,
    BezhasTokenAddress,
    TokenSaleAddress,
    MessagesAddress,
    BezhasBridgeAddress
} = contractAddresses;

// Exportar los ABIs
export const UserProfileABI = UserProfileArtifact.abi;
export const PostABI = PostArtifact.abi;
export const BezhasNFTABI = BezhasNFTArtifact.abi;
export const MarketplaceABI = MarketplaceArtifact.abi;
export const BezhasTokenABI = BezhasTokenArtifact.abi;
export const TokenSaleABI = TokenSaleArtifact.abi;
export const MessagesABI = MessagesArtifact.abi;
export const BezhasBridgeABI = BezhasBridgeArtifact.abi;