// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NFTOffers
 * @dev Contrato para hacer ofertas y contraofertas en NFTs
 * Sistema de negociación P2P con escrow automático
 */
contract NFTOffers is Ownable, ReentrancyGuard {
    IERC20 public immutable paymentToken; // BEZ token
    
    uint256 private _offerIdCounter;
    
    enum OfferStatus {
        Pending,      // Oferta pendiente
        Countered,    // Contraoferta recibida
        Accepted,     // Aceptada
        Rejected,     // Rechazada
        Cancelled,    // Cancelada por el oferente
        Expired       // Expirada
    }
    
    struct Offer {
        uint256 offerId;
        address nftContract;
        uint256 tokenId;
        address offerer;          // Quien hace la oferta
        address nftOwner;         // Dueño actual del NFT
        uint256 offerAmount;      // Monto ofrecido
        uint256 expiresAt;        // Timestamp de expiración
        OfferStatus status;
        uint256 createdAt;
        string message;           // Mensaje opcional
        uint256 feeAtCreation;    // 🔒 SECURITY FIX: Lock fee when created
    }
    
    struct CounterOffer {
        uint256 originalOfferId;
        uint256 counterAmount;
        string message;
        uint256 createdAt;
        uint256 expiresAt;
        bool isActive;
    }
    
    // Ofertas
    mapping(uint256 => Offer) public offers;
    mapping(bytes32 => uint256[]) public nftOffers; // keccak256(nftContract, tokenId) => offerIds
    mapping(address => uint256[]) public userOffers; // ofertas hechas por un usuario
    mapping(address => uint256[]) public receivedOffers; // ofertas recibidas
    
    // Contraofertas
    mapping(uint256 => CounterOffer) public counterOffers; // offerId => counterOffer
    
    // Fondos en escrow
    mapping(uint256 => uint256) public escrowedFunds; // offerId => amount
    
    // Fee del protocolo (250 = 2.5%)
    uint256 public protocolFee = 250;
    address public feeRecipient;
    
    // Configuración
    uint256 public minOfferDuration = 1 hours;
    uint256 public maxOfferDuration = 30 days;
    
    // Eventos
    event OfferCreated(
        uint256 indexed offerId,
        address indexed offerer,
        address indexed nftContract,
        uint256 tokenId,
        uint256 offerAmount
    );
    
    event CounterOfferCreated(
        uint256 indexed offerId,
        uint256 counterAmount
    );
    
    event OfferAccepted(
        uint256 indexed offerId,
        address buyer,
        address seller,
        uint256 finalPrice
    );
    
    event OfferRejected(uint256 indexed offerId);
    event OfferCancelled(uint256 indexed offerId);
    event OfferExpired(uint256 indexed offerId);
    
    constructor(address _paymentToken, address _feeRecipient) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Crear una oferta por un NFT
     */
    function createOffer(
        address nftContract,
        uint256 tokenId,
        uint256 offerAmount,
        uint256 duration,
        string memory message
    ) external nonReentrant returns (uint256) {
        require(offerAmount > 0, "Monto debe ser mayor a 0");
        require(
            duration >= minOfferDuration && duration <= maxOfferDuration,
            "Duracion invalida"
        );
        
        address nftOwner = IERC721(nftContract).ownerOf(tokenId);
        require(nftOwner != msg.sender, "No puedes ofertar tu propio NFT");
        
        // Transferir fondos a escrow
        require(
            paymentToken.transferFrom(msg.sender, address(this), offerAmount),
            "Transfer fallido"
        );
        
        _offerIdCounter++;
        uint256 offerId = _offerIdCounter;
        
        uint256 expiresAt = block.timestamp + duration;
        
        offers[offerId] = Offer({
            offerId: offerId,
            nftContract: nftContract,
            tokenId: tokenId,
            offerer: msg.sender,
            nftOwner: nftOwner,
            offerAmount: offerAmount,
            expiresAt: expiresAt,
            status: OfferStatus.Pending,
            createdAt: block.timestamp,
            message: message,
            feeAtCreation: protocolFee  // 🔒 SECURITY FIX: Store current fee
        });
        
        escrowedFunds[offerId] = offerAmount;
        
        bytes32 nftKey = keccak256(abi.encodePacked(nftContract, tokenId));
        nftOffers[nftKey].push(offerId);
        userOffers[msg.sender].push(offerId);
        receivedOffers[nftOwner].push(offerId);
        
        emit OfferCreated(offerId, msg.sender, nftContract, tokenId, offerAmount);
        
        return offerId;
    }
    
    /**
     * @dev Crear contraoferta
     */
    function createCounterOffer(
        uint256 offerId,
        uint256 counterAmount,
        string memory message,
        uint256 duration
    ) external nonReentrant {
        Offer storage offer = offers[offerId];
        
        require(offer.status == OfferStatus.Pending, "Oferta no esta pendiente");
        require(block.timestamp <= offer.expiresAt, "Oferta expirada");
        require(offer.nftOwner == msg.sender, "No eres el owner del NFT");
        require(counterAmount > offer.offerAmount, "Contraoferta debe ser mayor");
        require(
            duration >= minOfferDuration && duration <= maxOfferDuration,
            "Duracion invalida"
        );
        
        uint256 expiresAt = block.timestamp + duration;
        
        counterOffers[offerId] = CounterOffer({
            originalOfferId: offerId,
            counterAmount: counterAmount,
            message: message,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        });
        
        offer.status = OfferStatus.Countered;
        
        emit CounterOfferCreated(offerId, counterAmount);
    }
    
    /**
     * @dev Aceptar una oferta original
     */
    function acceptOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        
        require(offer.status == OfferStatus.Pending, "Oferta no esta pendiente");
        require(block.timestamp <= offer.expiresAt, "Oferta expirada");
        
        address currentOwner = IERC721(offer.nftContract).ownerOf(offer.tokenId);
        require(currentOwner == msg.sender, "No eres el owner del NFT");
        
        _executeTransaction(offerId, offer.offerAmount);
    }
    
    /**
     * @dev Aceptar una contraoferta (oferente paga diferencia)
     */
    function acceptCounterOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        CounterOffer storage counter = counterOffers[offerId];
        
        require(offer.status == OfferStatus.Countered, "No hay contraoferta");
        require(counter.isActive, "Contraoferta no activa");
        require(block.timestamp <= counter.expiresAt, "Contraoferta expirada");
        require(offer.offerer == msg.sender, "No eres el oferente");
        
        uint256 difference = counter.counterAmount - offer.offerAmount;
        
        // Transferir diferencia adicional
        require(
            paymentToken.transferFrom(msg.sender, address(this), difference),
            "Transfer diferencia fallido"
        );
        
        escrowedFunds[offerId] += difference;
        counter.isActive = false;
        
        _executeTransaction(offerId, counter.counterAmount);
    }
    
    /**
     * @dev Ejecutar transacción final
     */
    function _executeTransaction(uint256 offerId, uint256 finalPrice) internal {
        Offer storage offer = offers[offerId];
        
        // 🔒 SECURITY FIX: Use locked fee from creation time
        uint256 fee = (finalPrice * offer.feeAtCreation) / 10000;
        uint256 sellerAmount = finalPrice - fee;
        
        // Transferir NFT al comprador
        IERC721(offer.nftContract).transferFrom(
            offer.nftOwner,
            offer.offerer,
            offer.tokenId
        );
        
        // Pagar al vendedor y fee
        require(
            paymentToken.transfer(offer.nftOwner, sellerAmount),
            "Pago seller fallido"
        );
        require(
            paymentToken.transfer(feeRecipient, fee),
            "Pago fee fallido"
        );
        
        // Limpiar escrow
        escrowedFunds[offerId] = 0;
        offer.status = OfferStatus.Accepted;
        
        emit OfferAccepted(offerId, offer.offerer, offer.nftOwner, finalPrice);
    }
    
    /**
     * @dev Rechazar una oferta
     */
    function rejectOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        
        require(
            offer.status == OfferStatus.Pending || offer.status == OfferStatus.Countered,
            "Oferta no puede ser rechazada"
        );
        require(offer.nftOwner == msg.sender, "No eres el owner");
        
        offer.status = OfferStatus.Rejected;
        
        // Devolver fondos al oferente
        uint256 refundAmount = escrowedFunds[offerId];
        if (refundAmount > 0) {
            escrowedFunds[offerId] = 0;
            require(
                paymentToken.transfer(offer.offerer, refundAmount),
                "Refund fallido"
            );
        }
        
        emit OfferRejected(offerId);
    }
    
    /**
     * @dev Cancelar una oferta (solo oferente)
     */
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        
        require(offer.offerer == msg.sender, "No eres el oferente");
        require(
            offer.status == OfferStatus.Pending || offer.status == OfferStatus.Countered,
            "Oferta no puede ser cancelada"
        );
        
        offer.status = OfferStatus.Cancelled;
        
        // Devolver fondos
        uint256 refundAmount = escrowedFunds[offerId];
        if (refundAmount > 0) {
            escrowedFunds[offerId] = 0;
            require(
                paymentToken.transfer(msg.sender, refundAmount),
                "Refund fallido"
            );
        }
        
        // Desactivar contraoferta si existe
        if (counterOffers[offerId].isActive) {
            counterOffers[offerId].isActive = false;
        }
        
        emit OfferCancelled(offerId);
    }
    
    /**
     * @dev Marcar ofertas expiradas y devolver fondos
     */
    function expireOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        
        require(
            offer.status == OfferStatus.Pending || offer.status == OfferStatus.Countered,
            "Oferta no puede expirar"
        );
        require(block.timestamp > offer.expiresAt, "Oferta aun no expira");
        
        offer.status = OfferStatus.Expired;
        
        // Devolver fondos
        uint256 refundAmount = escrowedFunds[offerId];
        if (refundAmount > 0) {
            escrowedFunds[offerId] = 0;
            require(
                paymentToken.transfer(offer.offerer, refundAmount),
                "Refund fallido"
            );
        }
        
        emit OfferExpired(offerId);
    }
    
    /**
     * @dev Batch expire ofertas expiradas
     */
    function batchExpireOffers(uint256[] calldata offerIds) 
        external 
        nonReentrant 
    {
        for (uint256 i = 0; i < offerIds.length; i++) {
            Offer storage offer = offers[offerIds[i]];
            
            if (
                (offer.status == OfferStatus.Pending || offer.status == OfferStatus.Countered) &&
                block.timestamp > offer.expiresAt
            ) {
                offer.status = OfferStatus.Expired;
                
                uint256 refundAmount = escrowedFunds[offerIds[i]];
                if (refundAmount > 0) {
                    escrowedFunds[offerIds[i]] = 0;
                    require(
                        paymentToken.transfer(offer.offerer, refundAmount),
                        "Refund fallido"
                    );
                }
                
                emit OfferExpired(offerIds[i]);
            }
        }
    }
    
    /**
     * @dev Obtener ofertas de un NFT específico
     */
    function getNFTOffers(address nftContract, uint256 tokenId) 
        external 
        view 
        returns (Offer[] memory) 
    {
        bytes32 nftKey = keccak256(abi.encodePacked(nftContract, tokenId));
        uint256[] memory offerIds = nftOffers[nftKey];
        
        Offer[] memory result = new Offer[](offerIds.length);
        for (uint256 i = 0; i < offerIds.length; i++) {
            result[i] = offers[offerIds[i]];
        }
        
        return result;
    }
    
    /**
     * @dev Obtener ofertas hechas por un usuario
     */
    function getUserOffers(address user) 
        external 
        view 
        returns (Offer[] memory) 
    {
        uint256[] memory offerIds = userOffers[user];
        Offer[] memory result = new Offer[](offerIds.length);
        
        for (uint256 i = 0; i < offerIds.length; i++) {
            result[i] = offers[offerIds[i]];
        }
        
        return result;
    }
    
    /**
     * @dev Obtener ofertas recibidas por un usuario
     */
    function getReceivedOffers(address user) 
        external 
        view 
        returns (Offer[] memory) 
    {
        uint256[] memory offerIds = receivedOffers[user];
        Offer[] memory result = new Offer[](offerIds.length);
        
        for (uint256 i = 0; i < offerIds.length; i++) {
            result[i] = offers[offerIds[i]];
        }
        
        return result;
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
     * @dev Actualizar duraciones mínima y máxima
     */
    function updateOfferDurations(uint256 minDuration, uint256 maxDuration) 
        external 
        onlyOwner 
    {
        require(minDuration < maxDuration, "Min debe ser < Max");
        minOfferDuration = minDuration;
        maxOfferDuration = maxDuration;
    }
}
