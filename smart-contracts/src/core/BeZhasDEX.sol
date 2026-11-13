// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {BeZhasLPToken} from "./BeZhasLPToken.sol";

/**
 * @title BeZhasDEX
 * @notice AMM ligero para liquidez y trading del ecosistema BeZhas.
 * @dev Mantiene pools x*y=k con comision configurable. Esta pensado para
 * pares BEZ-Coin/token, aunque permite cualquier par ERC20 aprobado.
 */
contract BeZhasDEX is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Pool {
        address token0;
        address token1;
        uint112 reserve0;
        uint112 reserve1;
        uint32 lastBlockTimestamp;
        uint256 totalLiquidity;
        address lpToken; // ERC-20 que representa la LP de este par (stakeable en farming)
        bool exists;
    }

    uint16 public feeBps;
    uint16 public constant MAX_FEE_BPS = 100;

    mapping(bytes32 => Pool) public pools;

    // ─── Precio medio ponderado por tiempo (TWAP, estilo Uniswap v2) ───
    // getSpotPrice() lee las reservas del bloque actual: con un préstamo flash se mueve
    // todo lo que se quiera DENTRO de una transacción, así que un oráculo que lo use se
    // puede manipular y cobrar de más o de menos. El TWAP acumula precio × segundos: lo que
    // dura 0 segundos (una manipulación dentro de un bloque) pesa 0.
    uint256 private constant TWAP_PRECISION = 1e27;
    /// @notice Tiempo mínimo entre dos observaciones: una ventana corta no se puede imponer.
    uint32 public constant TWAP_PERIOD = 30 minutes;
    /// @notice Ventana mínima para que consultTwap devuelva un precio.
    uint32 public constant MIN_TWAP_WINDOW = 10 minutes;

    /// @notice Precio de token0 en token1 (y al revés) × TWAP_PRECISION × segundos acumulados.
    mapping(bytes32 => uint256) public price0Cumulative;
    mapping(bytes32 => uint256) public price1Cumulative;

    struct Observation {
        uint256 price0Cumulative;
        uint256 price1Cumulative;
        uint32 timestamp;
    }
    mapping(bytes32 => Observation) public observations;

    event PoolCreated(bytes32 indexed pairId, address indexed token0, address indexed token1);
    event LPTokenCreated(bytes32 indexed pairId, address indexed lpToken);
    event LiquidityAdded(bytes32 indexed pairId, address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event LiquidityRemoved(bytes32 indexed pairId, address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Swap(bytes32 indexed pairId, address indexed trader, address indexed tokenIn, uint256 amountIn, uint256 amountOut);
    event FeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event ObservationUpdated(bytes32 indexed pairId, uint256 price0Cumulative, uint256 price1Cumulative, uint32 timestamp);

    error IdenticalTokens();
    error ZeroAddress();
    error PoolExists();
    error PoolNotFound();
    error InsufficientAmount();
    error InsufficientLiquidity();
    error SlippageExceeded();
    error InvalidFee();
    error NoObservation();
    error ObservationTooRecent();
    error TwapWindowTooShort();

    constructor(address initialOwner, uint16 initialFeeBps) Ownable(initialOwner) {
        if (initialFeeBps > MAX_FEE_BPS) revert InvalidFee();
        feeBps = initialFeeBps;
    }

    function pairId(address tokenA, address tokenB) public pure returns (bytes32) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        return keccak256(abi.encodePacked(token0, token1));
    }

    function sortTokens(address tokenA, address tokenB) public pure returns (address token0, address token1) {
        if (tokenA == tokenB) revert IdenticalTokens();
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    function createPool(address tokenA, address tokenB) external returns (bytes32 id) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        id = keccak256(abi.encodePacked(token0, token1));
        if (pools[id].exists) revert PoolExists();

        BeZhasLPToken lpToken = new BeZhasLPToken("BeZhas LP Token", "BEZ-LP");

        pools[id] = Pool({
            token0: token0,
            token1: token1,
            reserve0: 0,
            reserve1: 0,
            lastBlockTimestamp: uint32(block.timestamp),
            totalLiquidity: 0,
            lpToken: address(lpToken),
            exists: true
        });

        emit PoolCreated(id, token0, token1);
        emit LPTokenCreated(id, address(lpToken));
    }

    function getPool(address tokenA, address tokenB) external view returns (Pool memory) {
        Pool memory pool = pools[pairId(tokenA, tokenB)];
        if (!pool.exists) revert PoolNotFound();
        return pool;
    }

    /// @notice LP tokens (posicion de liquidez) que posee `provider` en el par `id`.
    /// @dev Conveniencia de lectura: la contabilidad real vive en el LP token (BeZhasLPToken).
    function liquidityOf(bytes32 id, address provider) external view returns (uint256) {
        Pool storage pool = pools[id];
        if (!pool.exists) revert PoolNotFound();
        return BeZhasLPToken(pool.lpToken).balanceOf(provider);
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 minLiquidity
    ) external nonReentrant returns (uint256 liquidity) {
        if (amountA == 0 || amountB == 0) revert InsufficientAmount();

        bytes32 id = pairId(tokenA, tokenB);
        Pool storage pool = pools[id];
        if (!pool.exists) revert PoolNotFound();

        (uint256 amount0, uint256 amount1) = tokenA == pool.token0 ? (amountA, amountB) : (amountB, amountA);

        _accumulate(id, pool);
        if (pool.totalLiquidity == 0) {
            liquidity = _sqrt(amount0 * amount1);
        } else {
            liquidity = _min(
                (amount0 * pool.totalLiquidity) / pool.reserve0,
                (amount1 * pool.totalLiquidity) / pool.reserve1
            );
        }
        if (liquidity == 0) revert InsufficientLiquidity();
        if (liquidity < minLiquidity) revert SlippageExceeded();

        IERC20(pool.token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(pool.token1).safeTransferFrom(msg.sender, address(this), amount1);

        pool.reserve0 += uint112(amount0);
        pool.reserve1 += uint112(amount1);
        pool.totalLiquidity += liquidity;
        pool.lastBlockTimestamp = uint32(block.timestamp);
        BeZhasLPToken(pool.lpToken).mint(msg.sender, liquidity);

        emit LiquidityAdded(id, msg.sender, amount0, amount1, liquidity);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 minAmountA,
        uint256 minAmountB
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        if (liquidity == 0) revert InsufficientAmount();

        bytes32 id = pairId(tokenA, tokenB);
        Pool storage pool = pools[id];
        if (!pool.exists) revert PoolNotFound();
        if (BeZhasLPToken(pool.lpToken).balanceOf(msg.sender) < liquidity) revert InsufficientLiquidity();

        _accumulate(id, pool);
        uint256 amount0 = (liquidity * pool.reserve0) / pool.totalLiquidity;
        uint256 amount1 = (liquidity * pool.reserve1) / pool.totalLiquidity;
        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidity();

        BeZhasLPToken(pool.lpToken).burn(msg.sender, liquidity);
        pool.totalLiquidity -= liquidity;
        pool.reserve0 -= uint112(amount0);
        pool.reserve1 -= uint112(amount1);
        pool.lastBlockTimestamp = uint32(block.timestamp);

        (amountA, amountB) = tokenA == pool.token0 ? (amount0, amount1) : (amount1, amount0);
        if (amountA < minAmountA || amountB < minAmountB) revert SlippageExceeded();

        IERC20(pool.token0).safeTransfer(msg.sender, amount0);
        IERC20(pool.token1).safeTransfer(msg.sender, amount1);

        emit LiquidityRemoved(id, msg.sender, amount0, amount1, liquidity);
    }

    function quoteSwap(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256 amountOut) {
        if (amountIn == 0) revert InsufficientAmount();
        Pool memory pool = pools[pairId(tokenIn, tokenOut)];
        if (!pool.exists) revert PoolNotFound();

        bool zeroForOne = tokenIn == pool.token0;
        uint256 reserveIn = zeroForOne ? pool.reserve0 : pool.reserve1;
        uint256 reserveOut = zeroForOne ? pool.reserve1 : pool.reserve0;
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        uint256 amountInWithFee = amountIn * (10_000 - feeBps);
        amountOut = (amountInWithFee * reserveOut) / ((reserveIn * 10_000) + amountInWithFee);
    }

    /**
     * @notice Precio spot (mid-price) de `tokenIn` expresado en `tokenOut`, escalado a 1e18.
     * @dev Derivado solo de reservas (sin comision): `reserveOut * 1e18 / reserveIn`.
     *      NO normaliza decimales entre tokens (el DEX es agnostico de decimales); el
     *      consumidor (p. ej. el oraculo de precio BEZ/USDC del ecosistema) debe ajustar
     *      por la diferencia de decimales. Pensado para alimentar el oraculo interno desde
     *      esta pool en lugar de un DEX externo.
     */
    function getSpotPrice(address tokenIn, address tokenOut) external view returns (uint256 price) {
        Pool memory pool = pools[pairId(tokenIn, tokenOut)];
        if (!pool.exists) revert PoolNotFound();

        bool zeroForOne = tokenIn == pool.token0;
        uint256 reserveIn = zeroForOne ? pool.reserve0 : pool.reserve1;
        uint256 reserveOut = zeroForOne ? pool.reserve1 : pool.reserve0;
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        price = (reserveOut * 1e18) / reserveIn;
    }

    /**
     * @notice Registra el acumulador actual como punto de partida del TWAP. Cualquiera puede
     *         llamarla, como mucho una vez cada TWAP_PERIOD.
     * @dev Guardar el acumulador (no el precio) hace inofensivo llamarla en mitad de una
     *      manipulación: lo que cuenta es cuánto tiempo estuvo el precio donde estuvo.
     */
    function updateObservation(address tokenA, address tokenB) external {
        bytes32 id = pairId(tokenA, tokenB);
        Pool storage pool = pools[id];
        if (!pool.exists) revert PoolNotFound();
        if (pool.reserve0 == 0 || pool.reserve1 == 0) revert InsufficientLiquidity();

        Observation storage obs = observations[id];
        if (obs.timestamp != 0 && block.timestamp - obs.timestamp < TWAP_PERIOD) revert ObservationTooRecent();

        (uint256 c0, uint256 c1) = _currentCumulative(id, pool);
        observations[id] = Observation({price0Cumulative: c0, price1Cumulative: c1, timestamp: uint32(block.timestamp)});
        emit ObservationUpdated(id, c0, c1, uint32(block.timestamp));
    }

    /**
     * @notice Precio medio de `tokenIn` en `tokenOut` desde la última observación, escalado a
     *         1e18 (mismas unidades que getSpotPrice, que NO normaliza decimales).
     * @dev Es el precio que debe usar cualquier oráculo o contrato que mueva dinero. Revierte
     *      si no hay observación o si la ventana es menor que MIN_TWAP_WINDOW.
     */
    function consultTwap(address tokenIn, address tokenOut) external view returns (uint256 price) {
        bytes32 id = pairId(tokenIn, tokenOut);
        Pool memory pool = pools[id];
        if (!pool.exists) revert PoolNotFound();

        Observation memory obs = observations[id];
        if (obs.timestamp == 0) revert NoObservation();
        uint32 elapsed;
        unchecked { elapsed = uint32(block.timestamp) - obs.timestamp; }
        if (elapsed < MIN_TWAP_WINDOW) revert TwapWindowTooShort();

        (uint256 c0, uint256 c1) = _currentCumulative(id, pool);
        uint256 delta;
        unchecked { delta = tokenIn == pool.token0 ? c0 - obs.price0Cumulative : c1 - obs.price1Cumulative; }
        price = delta / elapsed / (TWAP_PRECISION / 1e18);
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        bytes32 id = pairId(tokenIn, tokenOut);
        Pool storage pool = pools[id];
        if (!pool.exists) revert PoolNotFound();

        amountOut = quoteSwap(tokenIn, tokenOut, amountIn);
        if (amountOut < minAmountOut) revert SlippageExceeded();

        _accumulate(id, pool);

        bool zeroForOne = tokenIn == pool.token0;
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        if (zeroForOne) {
            pool.reserve0 += uint112(amountIn);
            pool.reserve1 -= uint112(amountOut);
        } else {
            pool.reserve1 += uint112(amountIn);
            pool.reserve0 -= uint112(amountOut);
        }
        pool.lastBlockTimestamp = uint32(block.timestamp);

        emit Swap(id, msg.sender, tokenIn, amountIn, amountOut);
    }

    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert InvalidFee();
        emit FeeUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    /// @dev Suma precio × segundos desde la última actualización. Se llama ANTES de cambiar las
    /// reservas, con las reservas que han estado vigentes todo ese tiempo. Puede desbordar a
    /// propósito (aritmética modular): sólo importan las diferencias entre dos lecturas.
    function _accumulate(bytes32 id, Pool storage pool) internal {
        uint32 elapsed;
        unchecked { elapsed = uint32(block.timestamp) - pool.lastBlockTimestamp; }
        if (elapsed > 0 && pool.reserve0 > 0 && pool.reserve1 > 0) {
            unchecked {
                price0Cumulative[id] += (uint256(pool.reserve1) * TWAP_PRECISION / pool.reserve0) * elapsed;
                price1Cumulative[id] += (uint256(pool.reserve0) * TWAP_PRECISION / pool.reserve1) * elapsed;
            }
        }
    }

    /// @dev Acumulador a fecha de ahora, incluyendo el tramo desde la última operación.
    function _currentCumulative(bytes32 id, Pool memory pool) internal view returns (uint256 c0, uint256 c1) {
        c0 = price0Cumulative[id];
        c1 = price1Cumulative[id];
        uint32 elapsed;
        unchecked { elapsed = uint32(block.timestamp) - pool.lastBlockTimestamp; }
        if (elapsed > 0 && pool.reserve0 > 0 && pool.reserve1 > 0) {
            unchecked {
                c0 += (uint256(pool.reserve1) * TWAP_PRECISION / pool.reserve0) * elapsed;
                c1 += (uint256(pool.reserve0) * TWAP_PRECISION / pool.reserve1) * elapsed;
            }
        }
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
