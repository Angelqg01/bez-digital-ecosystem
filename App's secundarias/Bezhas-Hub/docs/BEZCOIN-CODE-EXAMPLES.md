# 💻 BezCoin - Code Examples & Patterns

## 📚 Guía de Código para Desarrolladores

Esta guía muestra ejemplos prácticos de cómo usar cada función del sistema BezCoin.

---

## 🎯 Tabla de Contenidos

1. [Setup Básico](#setup-básico)
2. [Leer Balance](#leer-balance)
3. [Comprar Tokens](#comprar-tokens)
4. [Transferir Tokens](#transferir-tokens)
5. [Donar con Mensaje](#donar-con-mensaje)
6. [Verificar Balance Antes de Acción](#verificar-balance-antes-de-acción)
7. [Event Listeners Personalizados](#event-listeners-personalizados)
8. [Manejo de Errores](#manejo-de-errores)
9. [Componentes UI](#componentes-ui)
10. [Patrones Avanzados](#patrones-avanzados)

---

## 🚀 Setup Básico

### 1. Importar el Contexto

```jsx
import { useBezCoin } from '../context/BezCoinContext';

function MiComponente() {
    const {
        balance,
        tokenPrice,
        loading,
        pendingTx,
        networkError,
        contractsInitialized,
        fetchBalance,
        buyWithETH,
        transfer,
        donate
    } = useBezCoin();

    return (
        <div>
            <p>Balance: {balance} BEZ</p>
            {loading && <p>Cargando...</p>}
            {pendingTx && <p>Transacción: {pendingTx}</p>}
        </div>
    );
}
```

---

## 💰 Leer Balance

### Opción 1: Automático (Recomendado)
El balance se actualiza automáticamente cada 30s y cuando hay eventos Transfer.

```jsx
function BalanceDisplay() {
    const { balance, loading } = useBezCoin();

    return (
        <div className="bg-purple-100 p-4 rounded">
            <h3>Mi Balance</h3>
            {loading ? (
                <Spinner />
            ) : (
                <p className="text-2xl font-bold">{balance} BEZ</p>
            )}
        </div>
    );
}
```

### Opción 2: Manual (Forzar Actualización)
```jsx
function RefreshButton() {
    const { fetchBalance, loading } = useBezCoin();

    const handleRefresh = async () => {
        try {
            await fetchBalance();
            toast.success('Balance actualizado');
        } catch (error) {
            toast.error('Error al actualizar balance');
        }
    };

    return (
        <button 
            onClick={handleRefresh} 
            disabled={loading}
            className="btn-primary"
        >
            {loading ? 'Actualizando...' : '🔄 Actualizar Balance'}
        </button>
    );
}
```

---

## 🛒 Comprar Tokens

### Ejemplo Básico
```jsx
function BuyTokensButton() {
    const { buyWithETH, loading } = useBezCoin();
    const [ethAmount, setEthAmount] = useState('0.01');

    const handleBuy = async () => {
        try {
            const success = await buyWithETH(ethAmount);
            if (success) {
                toast.success('¡Compra exitosa!');
            }
        } catch (error) {
            console.error('Error comprando:', error);
            toast.error(error.message);
        }
    };

    return (
        <div>
            <input
                type="number"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                placeholder="0.01"
                step="0.001"
            />
            <button onClick={handleBuy} disabled={loading}>
                {loading ? 'Comprando...' : 'Comprar con ETH'}
            </button>
        </div>
    );
}
```

### Ejemplo Avanzado con Cálculo
```jsx
function AdvancedBuyModal() {
    const { buyWithETH, tokenPrice, calculateTokenAmount, loading, pendingTx } = useBezCoin();
    const [ethAmount, setEthAmount] = useState('');
    const [tokensToReceive, setTokensToReceive] = useState('0');

    // Calcular tokens cada vez que cambia ETH amount
    useEffect(() => {
        if (ethAmount && tokenPrice) {
            const tokens = calculateTokenAmount(ethAmount);
            setTokensToReceive(tokens);
        }
    }, [ethAmount, tokenPrice, calculateTokenAmount]);

    const handleBuy = async () => {
        if (!ethAmount || parseFloat(ethAmount) <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }

        try {
            await buyWithETH(ethAmount);
            // Reset form
            setEthAmount('');
            setTokensToReceive('0');
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="modal">
            <h2>Comprar BEZ Tokens</h2>
            
            <div className="input-group">
                <label>Cantidad de ETH</label>
                <input
                    type="number"
                    value={ethAmount}
                    onChange={(e) => setEthAmount(e.target.value)}
                    placeholder="0.01"
                    step="0.001"
                    disabled={loading}
                />
            </div>

            <div className="info">
                <p>Precio: {tokenPrice} ETH por BEZ</p>
                <p className="text-xl">
                    Recibirás: <strong>{tokensToReceive} BEZ</strong>
                </p>
            </div>

            {pendingTx && (
                <div className="alert alert-info">
                    {pendingTx}
                </div>
            )}

            <button 
                onClick={handleBuy} 
                disabled={loading || !ethAmount}
                className="btn-primary"
            >
                {loading ? 'Procesando...' : `Comprar ${tokensToReceive} BEZ`}
            </button>
        </div>
    );
}
```

---

## 📤 Transferir Tokens

### Ejemplo Básico
```jsx
function TransferForm() {
    const { transfer, loading } = useBezCoin();
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');

    const handleTransfer = async (e) => {
        e.preventDefault();
        
        try {
            const success = await transfer(recipient, amount);
            if (success) {
                toast.success(`${amount} BEZ enviados a ${recipient.slice(0, 6)}...`);
                setRecipient('');
                setAmount('');
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    return (
        <form onSubmit={handleTransfer}>
            <input
                type="text"
                placeholder="0x... dirección destino"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
            />
            <input
                type="number"
                placeholder="Cantidad"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
                required
            />
            <button type="submit" disabled={loading}>
                {loading ? 'Enviando...' : 'Transferir'}
            </button>
        </form>
    );
}
```

### Ejemplo Avanzado con Validaciones
```jsx
function AdvancedTransferForm() {
    const { transfer, balance, checkBalance, loading } = useBezCoin();
    const { address } = useAccount(); // Wagmi hook
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [errors, setErrors] = useState({});

    // Validar dirección en tiempo real
    const validateRecipient = (addr) => {
        if (!addr) return 'Dirección requerida';
        if (!ethers.isAddress(addr)) return 'Dirección inválida';
        if (addr.toLowerCase() === address?.toLowerCase()) {
            return 'No puedes transferir a ti mismo';
        }
        return null;
    };

    // Validar cantidad
    const validateAmount = async (amt) => {
        if (!amt || parseFloat(amt) <= 0) return 'Cantidad inválida';
        
        const hasSufficient = await checkBalance(amt);
        if (!hasSufficient) {
            return `Fondos insuficientes. Tienes ${balance} BEZ`;
        }
        
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validar todo
        const recipientError = validateRecipient(recipient);
        const amountError = await validateAmount(amount);
        
        if (recipientError || amountError) {
            setErrors({
                recipient: recipientError,
                amount: amountError
            });
            return;
        }

        setErrors({});

        try {
            await transfer(recipient, amount);
            setRecipient('');
            setAmount('');
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label>Destinatario</label>
                <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    onBlur={() => {
                        const error = validateRecipient(recipient);
                        setErrors(prev => ({ ...prev, recipient: error }));
                    }}
                    className={errors.recipient ? 'border-red-500' : ''}
                />
                {errors.recipient && (
                    <p className="text-red-500 text-sm">{errors.recipient}</p>
                )}
            </div>

            <div>
                <label>Cantidad</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.01"
                />
                {errors.amount && (
                    <p className="text-red-500 text-sm">{errors.amount}</p>
                )}
                <p className="text-gray-500 text-xs">
                    Balance disponible: {balance} BEZ
                </p>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="btn-primary w-full"
            >
                {loading ? 'Enviando...' : `Transferir ${amount || '0'} BEZ`}
            </button>
        </form>
    );
}
```

---

## 💝 Donar con Mensaje

### Ejemplo Básico
```jsx
function DonateButton({ recipientAddress, recipientName }) {
    const { donate, loading } = useBezCoin();
    const [isOpen, setIsOpen] = useState(false);

    const handleDonate = async (amount, message) => {
        try {
            const success = await donate(recipientAddress, amount, message);
            if (success) {
                toast.success(`¡Donación de ${amount} BEZ enviada a ${recipientName}! 💝`);
                setIsOpen(false);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    return (
        <>
            <button onClick={() => setIsOpen(true)}>
                💝 Donar
            </button>

            {isOpen && (
                <DonateModal
                    recipient={recipientName}
                    onDonate={handleDonate}
                    onClose={() => setIsOpen(false)}
                    loading={loading}
                />
            )}
        </>
    );
}
```

### Modal de Donación Completo
```jsx
function DonateModal({ recipient, onDonate, onClose, loading }) {
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const suggestedAmounts = [1, 5, 10, 20, 50];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }
        onDonate(amount, message);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Donar a {recipient}</h2>
                    <button onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Botones de cantidad sugerida */}
                    <div className="suggested-amounts">
                        {suggestedAmounts.map(amt => (
                            <button
                                key={amt}
                                type="button"
                                onClick={() => setAmount(amt.toString())}
                                className={`suggested-btn ${amount === amt.toString() ? 'active' : ''}`}
                            >
                                {amt} BEZ
                            </button>
                        ))}
                    </div>

                    {/* Input custom */}
                    <div className="input-group">
                        <label>O ingresa cantidad personalizada</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="10"
                            step="0.01"
                            min="0"
                        />
                    </div>

                    {/* Mensaje opcional */}
                    <div className="input-group">
                        <label>Mensaje (opcional)</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="¡Gran contenido!"
                            maxLength={200}
                            rows={3}
                        />
                        <p className="text-xs text-gray-500">
                            {message.length}/200 caracteres
                        </p>
                    </div>

                    {/* Preview */}
                    {amount && (
                        <div className="donation-preview">
                            <p>Enviarás: <strong>{amount} BEZ</strong></p>
                            {message && <p>Con mensaje: "{message}"</p>}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading || !amount}
                        className="btn-primary w-full"
                    >
                        {loading ? 'Enviando...' : `💝 Donar ${amount || '0'} BEZ`}
                    </button>
                </form>
            </div>
        </div>
    );
}
```

---

## ✅ Verificar Balance Antes de Acción

### Pattern: verifyAndProceed()
```jsx
function BuyNFTButton({ nftPrice }) {
    const { verifyAndProceed } = useBezCoin();

    const handleBuyNFT = async () => {
        // Esta función verifica balance y muestra modal si es insuficiente
        const canProceed = await verifyAndProceed(
            nftPrice,
            'Comprar NFT',
            () => handleBuyNFT() // Callback después de comprar tokens
        );

        if (canProceed) {
            // Usuario tiene fondos suficientes, proceder con compra NFT
            try {
                // Lógica de compra NFT aquí
                const result = await buyNFT(nftId, nftPrice);
                toast.success('NFT comprado exitosamente!');
            } catch (error) {
                toast.error('Error comprando NFT');
            }
        }
    };

    return (
        <button onClick={handleBuyNFT} className="btn-primary">
            Comprar NFT ({nftPrice} BEZ)
        </button>
    );
}
```

### Pattern: checkBalance() Manual
```jsx
function CustomAction() {
    const { balance, checkBalance } = useBezCoin();
    const requiredAmount = 100;

    const handleAction = async () => {
        // Verificación manual
        const hasSufficient = await checkBalance(requiredAmount);
        
        if (!hasSufficient) {
            toast.error(
                `Necesitas ${requiredAmount} BEZ, pero solo tienes ${balance} BEZ`,
                { duration: 5000 }
            );
            return;
        }

        // Proceder con acción
        console.log('Usuario tiene fondos suficientes');
    };

    return <button onClick={handleAction}>Acción (requiere {requiredAmount} BEZ)</button>;
}
```

---

## 🎧 Event Listeners Personalizados

### Escuchar Transfers Específicos
```jsx
function CustomTransferListener() {
    const { address } = useAccount();
    const [recentTransfers, setRecentTransfers] = useState([]);

    useEffect(() => {
        if (!address || !window.ethereum) return;

        const setupListener = async () => {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const tokenContract = new ethers.Contract(
                BezhasTokenAddress,
                BezhasTokenABI,
                provider
            );

            // Escuchar solo transfers HACIA esta dirección
            const filter = tokenContract.filters.Transfer(null, address);

            const handleTransfer = (from, to, value, event) => {
                const transfer = {
                    from,
                    amount: ethers.formatEther(value),
                    txHash: event.log.transactionHash,
                    blockNumber: event.log.blockNumber,
                    timestamp: Date.now()
                };

                setRecentTransfers(prev => [transfer, ...prev].slice(0, 10)); // Keep last 10
                
                // Custom notification
                showCustomNotification(`Recibiste ${transfer.amount} BEZ de ${from.slice(0, 6)}...`);
            };

            tokenContract.on(filter, handleTransfer);

            return () => tokenContract.off(filter, handleTransfer);
        };

        const cleanup = setupListener();
        return () => {
            cleanup.then(fn => fn && fn());
        };
    }, [address]);

    return (
        <div>
            <h3>Transfers Recientes</h3>
            <ul>
                {recentTransfers.map((t, i) => (
                    <li key={i}>
                        {t.amount} BEZ desde {t.from.slice(0, 6)}...
                        <a href={`https://etherscan.io/tx/${t.txHash}`} target="_blank">
                            Ver en Etherscan
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

### Escuchar Eventos de Compra (TokenSale)
```jsx
function PurchaseEventListener() {
    const { address } = useAccount();
    const [purchases, setPurchases] = useState([]);

    useEffect(() => {
        if (!address) return;

        const setupListener = async () => {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const saleContract = new ethers.Contract(
                TokenSaleAddress,
                TokenSaleABI,
                provider
            );

            // Evento: TokensPurchased(address buyer, uint256 ethAmount, uint256 tokenAmount)
            const filter = saleContract.filters.TokensPurchased(address);

            const handlePurchase = (buyer, ethAmount, tokenAmount, event) => {
                const purchase = {
                    ethSpent: ethers.formatEther(ethAmount),
                    tokensReceived: ethers.formatEther(tokenAmount),
                    txHash: event.log.transactionHash,
                    timestamp: Date.now()
                };

                setPurchases(prev => [purchase, ...prev]);
                
                toast.success(
                    `¡Compra confirmada! ${purchase.tokensReceived} BEZ recibidos`,
                    { duration: 5000 }
                );
            };

            saleContract.on(filter, handlePurchase);

            return () => saleContract.off(filter, handlePurchase);
        };

        const cleanup = setupListener();
        return () => {
            cleanup.then(fn => fn && fn());
        };
    }, [address]);

    return (
        <div>
            <h3>Historial de Compras</h3>
            {purchases.map((p, i) => (
                <div key={i} className="purchase-card">
                    <p>ETH gastado: {p.ethSpent}</p>
                    <p>Tokens recibidos: {p.tokensReceived} BEZ</p>
                    <a href={`https://etherscan.io/tx/${p.txHash}`}>Ver TX</a>
                </div>
            ))}
        </div>
    );
}
```

---

## 🚨 Manejo de Errores

### Pattern: Try-Catch con Mensajes Específicos
```jsx
function SafeTransferButton() {
    const { transfer } = useBezCoin();

    const handleTransfer = async (to, amount) => {
        try {
            await transfer(to, amount);
            toast.success('Transferencia exitosa');
        } catch (error) {
            // Errors específicos del contexto
            if (error.message.includes('Invalid recipient')) {
                toast.error('La dirección del destinatario no es válida');
            } else if (error.message.includes('Cannot transfer to yourself')) {
                toast.error('No puedes transferir a ti mismo');
            } else if (error.message.includes('Insufficient balance')) {
                toast.error('Balance insuficiente');
            } else if (error.code === 'ACTION_REJECTED') {
                toast.error('Transacción rechazada en wallet');
            } else {
                toast.error('Error desconocido: ' + error.message);
            }
            
            console.error('Transfer error:', error);
        }
    };

    return <button onClick={() => handleTransfer('0x...', '10')}>Transfer</button>;
}
```

### Pattern: Error Boundary Component
```jsx
class BezCoinErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('BezCoin Error:', error, errorInfo);
        
        // Log a analytics
        logErrorToAnalytics(error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-container">
                    <h2>Oops! Algo salió mal</h2>
                    <p>{this.state.error?.message}</p>
                    <button onClick={() => this.setState({ hasError: false })}>
                        Reintentar
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

// Uso:
<BezCoinErrorBoundary>
    <BuyTokensComponent />
</BezCoinErrorBoundary>
```

---

## 🎨 Componentes UI

### Balance Display con Loading State
```jsx
function BalanceCard() {
    const { balance, loading, contractsInitialized } = useBezCoin();

    if (!contractsInitialized) {
        return (
            <div className="balance-card skeleton">
                <div className="skeleton-text"></div>
                <div className="skeleton-number"></div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="balance-card"
        >
            <div className="icon">💰</div>
            <div className="content">
                <p className="label">Mi Balance</p>
                {loading ? (
                    <Spinner size="sm" />
                ) : (
                    <motion.p
                        key={balance}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="balance"
                    >
                        {parseFloat(balance).toFixed(2)} BEZ
                    </motion.p>
                )}
            </div>
        </motion.div>
    );
}
```

### Transaction History List
```jsx
function TransactionHistory() {
    const { transactions, loading } = useBezCoin();

    if (loading) return <Spinner />;
    if (transactions.length === 0) {
        return <p>No hay transacciones aún</p>;
    }

    return (
        <div className="transaction-history">
            {transactions.map((tx, index) => (
                <TransactionItem key={tx.txHash || index} transaction={tx} />
            ))}
        </div>
    );
}

function TransactionItem({ transaction }) {
    const getIcon = (type) => {
        switch(type) {
            case 'buy': return '🛒';
            case 'transfer': return '📤';
            case 'donate': return '💝';
            default: return '💰';
        }
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="transaction-item">
            <div className="icon">{getIcon(transaction.type)}</div>
            <div className="details">
                <p className="type">{transaction.type}</p>
                <p className="date">{formatDate(transaction.timestamp)}</p>
                {transaction.message && (
                    <p className="message">"{transaction.message}"</p>
                )}
            </div>
            <div className="amount">
                {transaction.amount} BEZ
            </div>
            {transaction.txHash && (
                <a 
                    href={`https://etherscan.io/tx/${transaction.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-tx"
                >
                    Ver TX ↗
                </a>
            )}
        </div>
    );
}
```

---

## 🧩 Patrones Avanzados

### Pattern 1: Debounced Balance Check
```jsx
function DebouncedAmountInput({ onValidAmountChange }) {
    const { checkBalance } = useBezCoin();
    const [amount, setAmount] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [checking, setChecking] = useState(false);

    // Debounce para no verificar en cada keystroke
    const debouncedCheck = useMemo(
        () => debounce(async (amt) => {
            if (!amt || parseFloat(amt) <= 0) {
                setIsValid(false);
                return;
            }

            setChecking(true);
            const valid = await checkBalance(amt);
            setIsValid(valid);
            setChecking(false);
            
            if (valid) {
                onValidAmountChange(amt);
            }
        }, 500),
        [checkBalance, onValidAmountChange]
    );

    useEffect(() => {
        debouncedCheck(amount);
    }, [amount, debouncedCheck]);

    return (
        <div className="input-with-validation">
            <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={isValid ? 'valid' : 'invalid'}
            />
            {checking && <Spinner size="xs" />}
            {!checking && amount && (
                <span className={`indicator ${isValid ? 'valid' : 'invalid'}`}>
                    {isValid ? '✓' : '✗'}
                </span>
            )}
        </div>
    );
}
```

### Pattern 2: Multi-Step Transaction
```jsx
function MultiStepPurchase() {
    const { buyWithETH, transfer, donate } = useBezCoin();
    const [currentStep, setCurrentStep] = useState(1);
    const [purchaseData, setPurchaseData] = useState({});

    const steps = [
        { id: 1, title: 'Comprar Tokens', action: buyWithETH },
        { id: 2, title: 'Transferir a Pool', action: transfer },
        { id: 3, title: 'Confirmar Participación', action: donate }
    ];

    const executeStep = async (stepId) => {
        const step = steps.find(s => s.id === stepId);
        
        try {
            toast.loading(`Ejecutando: ${step.title}...`);
            
            // Ejecutar acción según el step
            if (stepId === 1) {
                await step.action(purchaseData.ethAmount);
            } else if (stepId === 2) {
                await step.action(purchaseData.poolAddress, purchaseData.tokenAmount);
            } else if (stepId === 3) {
                await step.action(purchaseData.adminAddress, purchaseData.confirmAmount, 'Confirmación');
            }

            toast.success(`${step.title} completado`);
            setCurrentStep(stepId + 1);
        } catch (error) {
            toast.error(`Error en ${step.title}: ${error.message}`);
        }
    };

    return (
        <div className="multi-step">
            {steps.map(step => (
                <div 
                    key={step.id}
                    className={`step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
                >
                    <div className="step-number">{step.id}</div>
                    <p>{step.title}</p>
                    {currentStep === step.id && (
                        <button onClick={() => executeStep(step.id)}>
                            Ejecutar
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
```

### Pattern 3: Optimistic UI Updates
```jsx
function OptimisticTransferButton() {
    const { transfer, balance, setBalance } = useBezCoin(); // Nota: setBalance no está exportado, esto es ejemplo
    const [localBalance, setLocalBalance] = useState(balance);

    const handleTransfer = async (to, amount) => {
        // Actualizar UI inmediatamente (optimistic)
        const previousBalance = localBalance;
        setLocalBalance(prev => (parseFloat(prev) - parseFloat(amount)).toString());
        
        toast.success('Transferencia enviada...', { id: 'transfer' });

        try {
            // Enviar transacción real
            await transfer(to, amount);
            
            // Si tuvo éxito, la UI ya está correcta
            toast.success('¡Transferencia confirmada!', { id: 'transfer' });
        } catch (error) {
            // Si falla, revertir UI
            setLocalBalance(previousBalance);
            toast.error('Error: revirtiendo...', { id: 'transfer' });
        }
    };

    useEffect(() => {
        setLocalBalance(balance);
    }, [balance]);

    return (
        <div>
            <p>Balance (optimistic): {localBalance} BEZ</p>
            <button onClick={() => handleTransfer('0x...', '10')}>
                Transferir 10 BEZ
            </button>
        </div>
    );
}
```

---

## 🎯 Resumen de Best Practices

### DO ✅
- Usar `verifyAndProceed()` para acciones que requieren tokens
- Manejar errores específicos con try-catch
- Mostrar loading states durante transacciones
- Deshabilitar botones durante `loading || pendingTx`
- Validar inputs antes de enviar transacciones
- Usar event listeners para actualizaciones en tiempo real
- Proporcionar feedback visual (toasts, spinners, indicadores)
- Limpiar event listeners al desmontar componentes

### DON'T ❌
- No llamar funciones blockchain sin validar primero
- No asumir que balance siempre está actualizado (usar fetchBalance si es crítico)
- No ignorar errores de transacción
- No permitir múltiples transacciones simultáneas
- No olvidar manejar el caso de wallet desconectado
- No hacer polling excesivo (event listeners son mejores)
- No exponer private keys o sensitive data en logs

---

**Fin de la guía de código. ¡Feliz desarrollo! 🚀**

