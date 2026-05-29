// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title LazyNFT
 * @dev Contrato para Lazy Minting - NFTs se mintean solo cuando se compran
 * Ahorra gas a los creators usando vouchers pre-firmados
 */
contract LazyNFT is ERC721, EIP712, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    
    IERC20 public immutable paymentToken; // BEZ token
    
    string private _baseTokenURI;
    uint256 private _nextTokenId = 1;
    
    struct NFTVoucher {
        uint256 tokenId;           // ID único del NFT
        string uri;                // Metadata URI
        uint256 price;             // Precio en BEZ
        address creator;           // Creator/Minter autorizado
        uint256 royaltyPercent;    // Royalty % (500 = 5%)
        uint256 expiresAt;         // Timestamp de expiración
        bytes signature;           // Firma del creator
    }
    
    // Mapping de vouchers redimidos
    mapping(uint256 => bool) public redeemedVouchers;
    
    // Creators autorizados
    mapping(address => bool) public authorizedCreators;
    
    // Royalties por tokenId
    mapping(uint256 => uint256) public tokenRoyalties;
    mapping(uint256 => address) public tokenCreators;
    
    // Fee del protocolo (250 = 2.5%)
    uint256 public protocolFee = 250;
    address public feeRecipient;
    
    // Domain separator para EIP-712
    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "NFTVoucher(uint256 tokenId,string uri,uint256 price,address creator,uint256 royaltyPercent,uint256 expiresAt)"
    );
    
    // Eventos
    event VoucherRedeemed(
        uint256 indexed tokenId,
        address indexed redeemer,
        address indexed creator,
        uint256 price
    );
    
    event CreatorAuthorized(address indexed creator, bool authorized);
    
    constructor(
        string memory name,
        string memory symbol,
        address _paymentToken,
        address _feeRecipient
    ) ERC721(name, symbol) EIP712(name, "1") Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Redimir un voucher y mintear el NFT
     * @param voucher Voucher pre-firmado por el creator
     */
    function redeemVoucher(NFTVoucher calldata voucher) 
        external 
        nonReentrant 
        returns (uint256)
    {
        // Validaciones
        require(!redeemedVouchers[voucher.tokenId], "Voucher ya redimido");
        require(
            voucher.expiresAt == 0 || block.timestamp <= voucher.expiresAt,
            "Voucher expirado"
        );
        require(authorizedCreators[voucher.creator], "Creator no autorizado");
        
        // Verificar firma
        address signer = _verifyVoucher(voucher);
        require(signer == voucher.creator, "Firma invalida");
        
        // Marcar como redimido
        redeemedVouchers[voucher.tokenId] = true;
        
        // Procesar pago
        if (voucher.price > 0) {
            require(
                paymentToken.transferFrom(msg.sender, address(this), voucher.price),
                "Transfer fallido"
            );
            
            // Calcular distribución
            uint256 fee = (voucher.price * protocolFee) / 10000;
            uint256 creatorPayment = voucher.price - fee;
            
            // Transferir pagos
            require(
                paymentToken.transfer(voucher.creator, creatorPayment),
                "Pago creator fallido"
            );
            require(
                paymentToken.transfer(feeRecipient, fee),
                "Pago fee fallido"
            );
        }
        
        // Mintear NFT
        _safeMint(msg.sender, voucher.tokenId);
        
        // Guardar royalties y creator
        tokenRoyalties[voucher.tokenId] = voucher.royaltyPercent;
        tokenCreators[voucher.tokenId] = voucher.creator;
        
        emit VoucherRedeemed(
            voucher.tokenId,
            msg.sender,
            voucher.creator,
            voucher.price
        );
        
        return voucher.tokenId;
    }
    
    /**
     * @dev Batch redeem múltiples vouchers
     * @param vouchers Array de vouchers
     */
    function batchRedeemVouchers(NFTVoucher[] calldata vouchers) 
        external 
        nonReentrant 
        returns (uint256[] memory)
    {
        require(vouchers.length > 0, "Array vacio");
        require(vouchers.length <= 20, "Maximo 20 vouchers");
        
        uint256[] memory tokenIds = new uint256[](vouchers.length);
        uint256 totalPrice = 0;
        
        // Calcular precio total
        for (uint256 i = 0; i < vouchers.length; i++) {
            totalPrice += vouchers[i].price;
        }
        
        // Transferir pago total de una vez
        if (totalPrice > 0) {
            require(
                paymentToken.transferFrom(msg.sender, address(this), totalPrice),
                "Transfer fallido"
            );
        }
        
        // Redimir cada voucher
        for (uint256 i = 0; i < vouchers.length; i++) {
            require(!redeemedVouchers[vouchers[i].tokenId], "Voucher ya redimido");
            require(
                vouchers[i].expiresAt == 0 || block.timestamp <= vouchers[i].expiresAt,
                "Voucher expirado"
            );
            require(
                authorizedCreators[vouchers[i].creator],
                "Creator no autorizado"
            );
            
            address signer = _verifyVoucher(vouchers[i]);
            require(signer == vouchers[i].creator, "Firma invalida");
            
            redeemedVouchers[vouchers[i].tokenId] = true;
            
            // Distribuir pago individual
            if (vouchers[i].price > 0) {
                uint256 fee = (vouchers[i].price * protocolFee) / 10000;
                uint256 creatorPayment = vouchers[i].price - fee;
                
                require(
                    paymentToken.transfer(vouchers[i].creator, creatorPayment),
                    "Pago creator fallido"
                );
                require(
                    paymentToken.transfer(feeRecipient, fee),
                    "Pago fee fallido"
                );
            }
            
            _safeMint(msg.sender, vouchers[i].tokenId);
            tokenRoyalties[vouchers[i].tokenId] = vouchers[i].royaltyPercent;
            tokenCreators[vouchers[i].tokenId] = vouchers[i].creator;
            
            tokenIds[i] = vouchers[i].tokenId;
            
            emit VoucherRedeemed(
                vouchers[i].tokenId,
                msg.sender,
                vouchers[i].creator,
                vouchers[i].price
            );
        }
        
        return tokenIds;
    }
    
    /**
     * @dev Verificar firma de un voucher (EIP-712)
     */
    function _verifyVoucher(NFTVoucher calldata voucher) 
        internal 
        view 
        returns (address) 
    {
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            VOUCHER_TYPEHASH,
            voucher.tokenId,
            keccak256(bytes(voucher.uri)),
            voucher.price,
            voucher.creator,
            voucher.royaltyPercent,
            voucher.expiresAt
        )));
        
        return digest.recover(voucher.signature);
    }
    
    /**
     * @dev Autorizar/desautorizar creator
     */
    function authorizeCreator(address creator, bool authorized) 
        external 
        onlyOwner 
    {
        require(creator != address(0), "Direccion invalida");
        authorizedCreators[creator] = authorized;
        
        emit CreatorAuthorized(creator, authorized);
    }
    
    /**
     * @dev Batch authorize creators
     */
    function batchAuthorizeCreators(address[] calldata creators, bool authorized) 
        external 
        onlyOwner 
    {
        for (uint256 i = 0; i < creators.length; i++) {
            require(creators[i] != address(0), "Direccion invalida");
            authorizedCreators[creators[i]] = authorized;
            emit CreatorAuthorized(creators[i], authorized);
        }
    }
    
    /**
     * @dev Obtener royalty info de un token
     */
    function getRoyaltyInfo(uint256 tokenId, uint256 salePrice) 
        external 
        view 
        returns (address receiver, uint256 royaltyAmount) 
    {
        require(_ownerOf(tokenId) != address(0), "Token no existe");
        
        receiver = tokenCreators[tokenId];
        royaltyAmount = (salePrice * tokenRoyalties[tokenId]) / 10000;
    }
    
    /**
     * @dev Set base URI para metadata
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @dev Override _baseURI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }
    
    /**
     * @dev Actualizar protocol fee
     */
    function updateProtocolFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee maximo 10%");
        protocolFee = newFee;
    }
    
    /**
     * @dev Actualizar fee recipient
     */
    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Direccion invalida");
        feeRecipient = newRecipient;
    }
    
    /**
     * @dev Verificar si un voucher es válido (sin redimirlo)
     */
    function isVoucherValid(NFTVoucher calldata voucher) 
        external 
        view 
        returns (bool valid, string memory reason) 
    {
        if (redeemedVouchers[voucher.tokenId]) {
            return (false, "Voucher ya redimido");
        }
        
        if (voucher.expiresAt != 0 && block.timestamp > voucher.expiresAt) {
            return (false, "Voucher expirado");
        }
        
        if (!authorizedCreators[voucher.creator]) {
            return (false, "Creator no autorizado");
        }
        
        address signer = _verifyVoucher(voucher);
        if (signer != voucher.creator) {
            return (false, "Firma invalida");
        }
        
        return (true, "Voucher valido");
    }
}
