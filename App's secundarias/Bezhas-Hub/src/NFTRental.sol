// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NFTRental
 * @dev Contrato para alquilar NFTs por tiempo limitado
 * Ideal para gaming assets, memberships, virtual land, etc.
 */
contract NFTRental is Ownable, ReentrancyGuard {
    
    IERC20 public immutable paymentToken; // BEZ token
    
    struct RentalListing {
        address nftContract;
        uint256 tokenId;
        address owner;
        uint256 pricePerDay;        // Precio por día en BEZ
        uint256 minRentalDays;      // Mínimo de días
        uint256 maxRentalDays;      // Máximo de días
        uint256 collateralAmount;   // Colateral requerido
        bool isActive;
        uint256 listedAt;
    }
    
    struct RentalAgreement {
        bytes32 listingId;
        address renter;
        uint256 rentalStart;
        uint256 rentalEnd;
        uint256 totalPrice;
        uint256 collateralPaid;
        bool isActive;
        bool isReturned;
        uint256 returnedAt;
    }
    
    // Listings activos
    mapping(bytes32 => RentalListing) public listings; // keccak256(nftContract, tokenId)
    mapping(address => bytes32[]) public ownerListings;
    
    // Acuerdos de renta
    mapping(bytes32 => RentalAgreement) public rentals; // rentalId
    mapping(address => bytes32[]) public renterAgreements;
    
    // Fee del protocolo (250 = 2.5%)
    uint256 public protocolFee = 250;
    uint256 public constant MAX_PROTOCOL_FEE = 1000; // 10% máximo
    address public feeRecipient;
    
    // Contratos NFT permitidos
    mapping(address => bool) public allowedNFTContracts;

    // Referral System
    mapping(address => address) public userReferrer;
    uint256 public referralFeeShare = 2000; // 20% of protocol fee goes to referrer (Basis Points: 2000/10000 = 20%)
    
    event ReferrerSet(address indexed user, address indexed referrer);
    event ReferralPaid(address indexed referrer, address indexed user, uint256 amount);
    
    // Constante de seguridad: días máximos de retraso antes de claim
    uint256 public constant MAX_OVERDUE_DAYS = 7 days;
    
    // Eventos
    event NFTListed(
        bytes32 indexed listingId,
        address indexed owner,
        address nftContract,
        uint256 tokenId,
        uint256 pricePerDay
    );
    
    event NFTRented(
        bytes32 indexed rentalId,
        bytes32 indexed listingId,
        address indexed renter,
        uint256 rentalDays,
        uint256 totalPrice
    );
    
    event NFTReturned(
        bytes32 indexed rentalId,
        address indexed renter,
        uint256 collateralReturned
    );
    
    event ListingCancelled(bytes32 indexed listingId);
    event ListingUpdated(bytes32 indexed listingId, uint256 newPricePerDay);
    event NFTContractAllowed(address indexed nftContract, bool allowed);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    
    constructor(address _paymentToken, address _feeRecipient) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        feeRecipient = _feeRecipient;
    }
    
    function setReferrer(address referrer) external {
        require(userReferrer[msg.sender] == address(0), "Referrer already set");
        require(referrer != msg.sender, "Cannot refer self");
        require(referrer != address(0), "Invalid referrer");
        userReferrer[msg.sender] = referrer;
        emit ReferrerSet(msg.sender, referrer);
    }

    /**
     * @dev Listar un NFT para renta
     */
    function listNFTForRent(
        address nftContract,
        uint256 tokenId,
        uint256 pricePerDay,
        uint256 minRentalDays,
        uint256 maxRentalDays,
        uint256 collateralAmount
    ) external nonReentrant returns (bytes32) {
        require(allowedNFTContracts[nftContract], "NFT contract no permitido");
        require(pricePerDay > 0, "Precio debe ser mayor a 0");
        require(minRentalDays >= 1, "Minimo 1 dia");
        require(maxRentalDays >= minRentalDays, "Max debe ser >= Min");
        require(maxRentalDays <= 365, "Maximo 365 dias");
        
        bytes32 listingId = keccak256(abi.encodePacked(nftContract, tokenId));
        require(!listings[listingId].isActive, "Ya listado");
        
        // Transferir NFT al contrato (escrow)
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        
        listings[listingId] = RentalListing({
            nftContract: nftContract,
            tokenId: tokenId,
            owner: msg.sender,
            pricePerDay: pricePerDay,
            minRentalDays: minRentalDays,
            maxRentalDays: maxRentalDays,
            collateralAmount: collateralAmount,
            isActive: true,
            listedAt: block.timestamp
        });
        
        ownerListings[msg.sender].push(listingId);
        
        emit NFTListed(listingId, msg.sender, nftContract, tokenId, pricePerDay);
        
        return listingId;
    }
    
    /**
     * @dev Rentar un NFT
     * @param listingId ID del listing
     * @param rentalDays Días de renta
     */
    function rentNFT(bytes32 listingId, uint256 rentalDays) 
        external 
        nonReentrant 
        returns (bytes32)
    {
        RentalListing storage listing = listings[listingId];
        require(listing.isActive, "Listing no activo");
        require(
            rentalDays >= listing.minRentalDays && rentalDays <= listing.maxRentalDays,
            "Dias de renta invalidos"
        );
        
        uint256 totalPrice = listing.pricePerDay * rentalDays;
        uint256 totalPayment = totalPrice + listing.collateralAmount;
        
        // Transferir pago + colateral
        require(
            paymentToken.transferFrom(msg.sender, address(this), totalPayment),
            "Transfer fallido"
        );
        
        // Calcular fee y pago al owner
        uint256 fee = (totalPrice * protocolFee) / 10000;
        uint256 ownerPayment = totalPrice - fee;
        
        // Pagar al owner
        require(paymentToken.transfer(listing.owner, ownerPayment), "Pago owner fallido");

        // Distribuir fee (Referral System)
        address referrer = userReferrer[msg.sender];
        if (referrer != address(0)) {
            uint256 referrerShare = (fee * referralFeeShare) / 10000;
            uint256 protocolShare = fee - referrerShare;
            
            require(paymentToken.transfer(referrer, referrerShare), "Pago referrer fallido");
            require(paymentToken.transfer(feeRecipient, protocolShare), "Pago fee fallido");
            
            emit ReferralPaid(referrer, msg.sender, referrerShare);
        } else {
            require(paymentToken.transfer(feeRecipient, fee), "Pago fee fallido");
        }
        
        // Crear acuerdo de renta
        bytes32 rentalId = keccak256(
            abi.encodePacked(listingId, msg.sender, block.timestamp)
        );
        
        uint256 rentalEnd = block.timestamp + (rentalDays * 1 days);
        
        rentals[rentalId] = RentalAgreement({
            listingId: listingId,
            renter: msg.sender,
            rentalStart: block.timestamp,
            rentalEnd: rentalEnd,
            totalPrice: totalPrice,
            collateralPaid: listing.collateralAmount,
            isActive: true,
            isReturned: false,
            returnedAt: 0
        });
        
        renterAgreements[msg.sender].push(rentalId);
        
        // Marcar listing como no activo mientras está rentado
        listing.isActive = false;
        
        // Transferir NFT al renter
        IERC721(listing.nftContract).transferFrom(
            address(this),
            msg.sender,
            listing.tokenId
        );
        
        emit NFTRented(rentalId, listingId, msg.sender, rentalDays, totalPrice);
        
        return rentalId;
    }
    
    /**
     * @dev Devolver NFT rentado
     * @param rentalId ID del acuerdo de renta
     */
    function returnNFT(bytes32 rentalId) external nonReentrant {
        RentalAgreement storage rental = rentals[rentalId];
        require(rental.isActive, "Renta no activa");
        require(rental.renter == msg.sender, "No eres el renter");
        require(!rental.isReturned, "Ya devuelto");
        
        RentalListing storage listing = listings[rental.listingId];
        
        // Transferir NFT de vuelta al contrato
        IERC721(listing.nftContract).transferFrom(
            msg.sender,
            address(this),
            listing.tokenId
        );
        
        // Devolver colateral al renter
        uint256 collateralToReturn = rental.collateralPaid;
        
        // Penalización si devuelve tarde (10% del colateral por día de retraso)
        if (block.timestamp > rental.rentalEnd) {
            uint256 daysLate = (block.timestamp - rental.rentalEnd) / 1 days + 1;
            uint256 penalty = (rental.collateralPaid * 10 * daysLate) / 100;
            
            // 🔒 SECURITY FIX: Cap penalty at collateral amount
            if (penalty > collateralToReturn) {
                penalty = collateralToReturn;
            }
            
            if (penalty >= collateralToReturn) {
                // Penalty consume todo el colateral
                collateralToReturn = 0;
                require(
                    paymentToken.transfer(listing.owner, rental.collateralPaid),
                    "Transfer penalty fallido"
                );
            } else {
                collateralToReturn -= penalty;
                require(
                    paymentToken.transfer(listing.owner, penalty),
                    "Transfer penalty fallido"
                );
            }
        }
        
        if (collateralToReturn > 0) {
            require(
                paymentToken.transfer(msg.sender, collateralToReturn),
                "Return colateral fallido"
            );
        }
        
        // Actualizar estado
        rental.isActive = false;
        rental.isReturned = true;
        rental.returnedAt = block.timestamp;
        
        // Reactivar listing
        listing.isActive = true;
        
        emit NFTReturned(rentalId, msg.sender, collateralToReturn);
    }
    
    /**
     * @dev Owner puede reclamar NFT si renter no devuelve a tiempo
     * @param rentalId ID del acuerdo de renta
     */
    function claimOverdueNFT(bytes32 rentalId) external nonReentrant {
        RentalAgreement storage rental = rentals[rentalId];
        RentalListing storage listing = listings[rental.listingId];
        
        require(listing.owner == msg.sender, "No eres el owner");
        require(rental.isActive, "Renta no activa");
        require(!rental.isReturned, "Ya devuelto");
        require(
            block.timestamp > rental.rentalEnd + MAX_OVERDUE_DAYS,
            "Espera tiempo de gracia antes de reclamar"
        );
        
        // Intentar recuperar NFT (puede fallar si renter aún lo tiene)
        try IERC721(listing.nftContract).transferFrom(
            rental.renter,
            address(this),
            listing.tokenId
        ) {
            // NFT recuperado exitosamente
        } catch {
            // Si falla, owner se queda con el colateral como compensación
        }
        
        // Owner recibe el colateral como compensación
        require(
            paymentToken.transfer(msg.sender, rental.collateralPaid),
            "Transfer colateral fallido"
        );
        
        rental.isActive = false;
        listing.isActive = true;
    }
    
    /**
     * @dev Cancelar listing (solo si no está rentado)
     * @param listingId ID del listing
     */
    function cancelListing(bytes32 listingId) external nonReentrant {
        RentalListing storage listing = listings[listingId];
        require(listing.owner == msg.sender, "No eres el owner");
        require(listing.isActive, "Listing no activo");
        
        listing.isActive = false;
        
        // Devolver NFT al owner
        IERC721(listing.nftContract).transferFrom(
            address(this),
            msg.sender,
            listing.tokenId
        );
        
        emit ListingCancelled(listingId);
    }
    
    /**
     * @dev Actualizar precio de un listing
     * @param listingId ID del listing
     * @param newPricePerDay Nuevo precio por día
     */
    function updateListingPrice(bytes32 listingId, uint256 newPricePerDay) 
        external 
    {
        RentalListing storage listing = listings[listingId];
        require(listing.owner == msg.sender, "No eres el owner");
        require(listing.isActive, "Listing no activo");
        require(newPricePerDay > 0, "Precio invalido");
        
        listing.pricePerDay = newPricePerDay;
        
        emit ListingUpdated(listingId, newPricePerDay);
    }
    
    /**
     * @dev Obtener listings de un owner
     */
    function getOwnerListings(address owner) 
        external 
        view 
        returns (RentalListing[] memory) 
    {
        bytes32[] memory listingIds = ownerListings[owner];
        RentalListing[] memory result = new RentalListing[](listingIds.length);
        
        for (uint256 i = 0; i < listingIds.length; i++) {
            result[i] = listings[listingIds[i]];
        }
        
        return result;
    }
    
    /**
     * @dev Obtener rentas activas de un usuario
     */
    function getRenterAgreements(address renter) 
        external 
        view 
        returns (RentalAgreement[] memory) 
    {
        bytes32[] memory rentalIds = renterAgreements[renter];
        RentalAgreement[] memory result = new RentalAgreement[](rentalIds.length);
        
        for (uint256 i = 0; i < rentalIds.length; i++) {
            result[i] = rentals[rentalIds[i]];
        }
        
        return result;
    }
    
    /**
     * @dev Permitir un contrato NFT (solo owner)
     */
    function allowNFTContract(address nftContract, bool allowed) 
        external 
        onlyOwner 
    {
        allowedNFTContracts[nftContract] = allowed;
    }
    
    /**
     * @dev Actualizar protocol fee (solo owner)
     */
    function updateProtocolFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee maximo 10%");
        protocolFee = newFee;
    }
    
    /**
     * @dev Actualizar fee recipient (solo owner)
     */
    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Direccion invalida");
        feeRecipient = newRecipient;
    }
}
