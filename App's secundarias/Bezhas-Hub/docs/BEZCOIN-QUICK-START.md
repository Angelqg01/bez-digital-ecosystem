# 🚀 BezCoin - Guía Rápida de Uso

## 📦 Importaciones Necesarias

```javascript
import { useBezCoin } from '../context/BezCoinContext';
import BuyBezCoinModal from '../components/modals/BuyBezCoinModal';
import InsufficientFundsModal from '../components/modals/InsufficientFundsModal';
import TransactionHistory from '../components/bezcoin/TransactionHistory';
```

---

## 🎯 Ejemplos de Uso

### 1. Mostrar Balance del Usuario

```javascript
function BalanceDisplay() {
  const { balance, tokenPrice, loading } = useBezCoin();

  if (loading) return <Spinner />;

  return (
    <div className="balance-card">
      <h3>Tu Balance</h3>
      <div className="amount">
        <FaCoins className="icon" />
        <span>{parseFloat(balance).toFixed(2)} BEZ</span>
      </div>
      <p className="price">
        1 BEZ = {parseFloat(tokenPrice).toFixed(6)} ETH
      </p>
    </div>
  );
}
```

---

### 2. Botón de Compra Simple

```javascript
function QuickBuyButton() {
  const { setShowBuyModal, showBuyModal } = useBezCoin();

  return (
    <>
      <button 
        onClick={() => setShowBuyModal(true)}
        className="buy-button"
      >
        <FaShoppingCart /> Comprar BEZ
      </button>

      <BuyBezCoinModal 
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />
    </>
  );
}
```

---

### 3. Verificar Balance Antes de Acción (IMPORTANTE)

Este es el patrón más importante. Úsalo antes de cualquier acción que requiera tokens.

```javascript
function CreateDAOButton() {
  const { verifyAndProceed } = useBezCoin();
  const [loading, setLoading] = useState(false);

  const handleCreateDAO = async () => {
    setLoading(true);
    
    // Verificar 100 BEZ antes de crear
    await verifyAndProceed('100', 'Crear DAO', async () => {
      try {
        // Esta función solo se ejecuta si hay balance suficiente
        await daoContract.createDAO(name, description);
        toast.success('DAO creado exitosamente!');
      } catch (error) {
        toast.error('Error: ' + error.message);
      }
    });
    
    setLoading(false);
  };

  return (
    <button onClick={handleCreateDAO} disabled={loading}>
      {loading ? 'Creando...' : 'Crear DAO (100 BEZ)'}
    </button>
  );
}
```

**¿Qué hace `verifyAndProceed`?**
1. Verifica si tienes 100 BEZ
2. Si SÍ → Ejecuta la función inmediatamente
3. Si NO → Muestra modal de fondos insuficientes
4. Usuario compra tokens
5. Automáticamente ejecuta la función después de compra exitosa

---

### 4. Transferir Tokens

```javascript
function TransferForm() {
  const { transfer } = useBezCoin();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await transfer(recipient, amount);
      toast.success('Transferencia exitosa!');
      setRecipient('');
      setAmount('');
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleTransfer}>
      <input
        type="text"
        placeholder="Dirección del destinatario"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        required
      />
      <input
        type="number"
        step="0.01"
        placeholder="Cantidad"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Transfiriendo...' : 'Transferir'}
      </button>
    </form>
  );
}
```

---

### 5. Sistema de Donaciones

```javascript
function DonateButton({ creatorAddress, creatorName }) {
  const { donate } = useBezCoin();
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDonate = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Ingresa una cantidad válida');
      return;
    }

    setLoading(true);
    try {
      await donate(creatorAddress, amount, message);
      toast.success(`¡Donaste ${amount} BEZ a ${creatorName}!`);
      setShowModal(false);
      setAmount('');
      setMessage('');
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        <FaGift /> Donar
      </button>

      {showModal && (
        <div className="modal">
          <h3>Donar a {creatorName}</h3>
          <input
            type="number"
            step="0.01"
            placeholder="Cantidad en BEZ"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <textarea
            placeholder="Mensaje opcional"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button onClick={handleDonate} disabled={loading}>
            {loading ? 'Enviando...' : `Donar ${amount || '0'} BEZ`}
          </button>
          <button onClick={() => setShowModal(false)}>
            Cancelar
          </button>
        </div>
      )}
    </>
  );
}
```

---

### 6. Ver Historial de Transacciones

```javascript
function MyTransactionsPage() {
  return (
    <div className="transactions-page">
      <h1>Mis Transacciones</h1>
      <TransactionHistory />
    </div>
  );
}
```

¡Eso es todo! El componente `TransactionHistory` ya incluye:
- ✅ Filtros por tipo
- ✅ Paginación
- ✅ Exportar a CSV
- ✅ Links a Etherscan

---

### 7. Página de Perfil con Balance

```javascript
function ProfilePage() {
  const { balance, tokenPrice, setShowBuyModal, showBuyModal } = useBezCoin();
  const { address } = useAccount();

  return (
    <div className="profile-page">
      {/* Header con balance */}
      <div className="profile-header">
        <div className="balance-section">
          <h2>Mi Balance</h2>
          <div className="balance-display">
            <FaCoins className="text-yellow-500 text-4xl" />
            <span className="text-5xl font-bold">
              {parseFloat(balance).toFixed(2)} BEZ
            </span>
          </div>
          <p className="text-gray-500">
            ≈ {(parseFloat(balance) * parseFloat(tokenPrice)).toFixed(4)} ETH
          </p>
          <button 
            onClick={() => setShowBuyModal(true)}
            className="buy-more-button"
          >
            <FaShoppingCart /> Comprar más BEZ
          </button>
        </div>
      </div>

      {/* Tabs de perfil */}
      <Tabs>
        <Tab label="Información">
          <UserInfo />
        </Tab>
        <Tab label="Transacciones">
          <TransactionHistory />
        </Tab>
        <Tab label="Estadísticas">
          <UserStats />
        </Tab>
      </Tabs>

      {/* Modal de compra */}
      <BuyBezCoinModal 
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />
    </div>
  );
}
```

---

### 8. Header con Balance (Navbar)

```javascript
function Header() {
  const { balance, setShowBuyModal } = useBezCoin();
  const { isConnected } = useAccount();

  return (
    <header className="navbar">
      <Logo />
      <Navigation />
      
      {isConnected && (
        <div className="wallet-section">
          {/* Balance display */}
          <div className="balance-chip">
            <FaCoins className="text-yellow-500" />
            <span>{parseFloat(balance).toFixed(2)}</span>
            <span className="text-xs text-gray-500">BEZ</span>
            <button 
              onClick={() => setShowBuyModal(true)}
              className="plus-button"
            >
              +
            </button>
          </div>
          
          <WalletConnectButton />
        </div>
      )}
    </header>
  );
}
```

---

### 9. Crear DAO con Verificación de Balance

```javascript
function CreateDAOPage() {
  const { verifyAndProceed } = useBezCoin();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    votingPeriod: 7
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.description) {
      toast.error('Completa todos los campos');
      return;
    }

    setLoading(true);

    // Verificar 100 BEZ antes de crear
    await verifyAndProceed('100', 'Crear DAO', async () => {
      try {
        const tx = await daoContract.createDAO(
          formData.name,
          formData.description,
          formData.votingPeriod
        );
        
        await tx.wait();
        
        toast.success('DAO creado exitosamente!');
        navigate('/daos');
      } catch (error) {
        console.error('Error creating DAO:', error);
        toast.error('Error al crear DAO');
      }
    });

    setLoading(false);
  };

  return (
    <div className="create-dao-page">
      <h1>Crear Nuevo DAO</h1>
      <p className="cost-info">
        Costo de creación: <strong>100 BEZ</strong>
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre del DAO"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
        
        <textarea
          placeholder="Descripción"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          required
        />
        
        <input
          type="number"
          placeholder="Período de votación (días)"
          value={formData.votingPeriod}
          onChange={(e) => setFormData({...formData, votingPeriod: e.target.value})}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? (
            <>
              <FaSpinner className="animate-spin" /> Creando...
            </>
          ) : (
            'Crear DAO (100 BEZ)'
          )}
        </button>
      </form>
    </div>
  );
}
```

---

### 10. Sistema de Recompensas

```javascript
function RewardsButton() {
  const { address } = useAccount();
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkRewards = async () => {
    setLoading(true);
    try {
      const stats = await bezCoinService.getUserStats(address);
      setRewards(stats);
    } catch (error) {
      console.error('Error fetching rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimRewards = async () => {
    setLoading(true);
    try {
      await bezCoinService.claimRewards(address);
      toast.success('¡Recompensas reclamadas!');
      checkRewards(); // Actualizar
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) checkRewards();
  }, [address]);

  if (!rewards) return <Spinner />;

  return (
    <div className="rewards-card">
      <h3>Mis Recompensas</h3>
      
      <div className="stat">
        <span>Recompensas Ganadas:</span>
        <strong>{rewards.rewardsEarned} BEZ</strong>
      </div>
      
      <div className="stat">
        <span>Recompensas Reclamadas:</span>
        <strong>{rewards.rewardsClaimed} BEZ</strong>
      </div>
      
      <div className="stat pending">
        <span>Pendientes de Reclamar:</span>
        <strong>{rewards.rewardsPending} BEZ</strong>
      </div>

      <button 
        onClick={claimRewards}
        disabled={loading || parseFloat(rewards.rewardsPending) === 0}
      >
        {loading ? 'Reclamando...' : 'Reclamar Recompensas'}
      </button>
    </div>
  );
}
```

---

## 🎨 Estilos Recomendados

### Balance Display

```css
.balance-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 999px;
  color: white;
  font-weight: 600;
}

.balance-display .icon {
  font-size: 1.25rem;
  color: #fbbf24;
}

.plus-button {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 1.25rem;
  transition: all 0.2s;
}

.plus-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}
```

### Balance Card

```css
.balance-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 1.5rem;
  padding: 2rem;
  color: white;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
}

.balance-card .amount {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 3rem;
  font-weight: bold;
  margin: 1rem 0;
}

.balance-card .icon {
  font-size: 3rem;
  color: #fbbf24;
}

.balance-card .price {
  opacity: 0.8;
  font-size: 0.875rem;
}
```

---

## 🔥 Casos de Uso Completos

### Caso 1: Sistema de Propinas para Creadores de Contenido

```javascript
function ContentCard({ content, creator }) {
  const { donate } = useBezCoin();
  const [tipAmount, setTipAmount] = useState('');
  const [showTipModal, setShowTipModal] = useState(false);

  const handleTip = async () => {
    try {
      await donate(
        creator.address,
        tipAmount,
        `Propina por: "${content.title}"`
      );
      toast.success(`¡Enviaste ${tipAmount} BEZ a ${creator.name}!`);
      setShowTipModal(false);
    } catch (error) {
      toast.error('Error al enviar propina');
    }
  };

  return (
    <div className="content-card">
      <h3>{content.title}</h3>
      <p>{content.description}</p>
      
      <div className="actions">
        <button onClick={() => setShowTipModal(true)}>
          <FaGift /> Dar Propina
        </button>
      </div>

      {showTipModal && (
        <TipModal
          creator={creator}
          amount={tipAmount}
          setAmount={setTipAmount}
          onConfirm={handleTip}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </div>
  );
}
```

### Caso 2: Marketplace con Precios en BEZ

```javascript
function ProductCard({ product }) {
  const { verifyAndProceed, balance } = useBezCoin();
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    setLoading(true);
    
    await verifyAndProceed(
      product.price,
      `Comprar ${product.name}`,
      async () => {
        try {
          // Transferir BEZ al vendedor
          await transfer(product.seller, product.price);
          
          // Registrar compra
          await marketplaceContract.buyProduct(product.id);
          
          toast.success('¡Compra exitosa!');
        } catch (error) {
          toast.error('Error en la compra');
        }
      }
    );
    
    setLoading(false);
  };

  const canAfford = parseFloat(balance) >= parseFloat(product.price);

  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      
      <div className="price">
        <FaCoins className="text-yellow-500" />
        <span>{product.price} BEZ</span>
      </div>

      <button 
        onClick={handleBuy}
        disabled={loading || !canAfford}
        className={canAfford ? 'can-buy' : 'cannot-buy'}
      >
        {loading ? 'Comprando...' : 
         canAfford ? 'Comprar Ahora' : 
         'Balance Insuficiente'}
      </button>
    </div>
  );
}
```

### Caso 3: Suscripciones Mensuales

```javascript
function SubscriptionCard({ plan }) {
  const { verifyAndProceed } = useBezCoin();
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async () => {
    await verifyAndProceed(
      plan.monthlyPrice,
      `Suscripción ${plan.name}`,
      async () => {
        try {
          // Transferir tokens
          await donate(plan.recipientAddress, plan.monthlyPrice, `Suscripción a ${plan.name}`);
          
          // Registrar suscripción
          await subscriptionContract.subscribe(plan.id);
          
          setSubscribed(true);
          toast.success('¡Suscripción activada!');
        } catch (error) {
          toast.error('Error al suscribirse');
        }
      }
    );
  };

  return (
    <div className={`subscription-card ${plan.tier}`}>
      <h3>{plan.name}</h3>
      <ul>
        {plan.features.map((feature, i) => (
          <li key={i}><FaCheck /> {feature}</li>
        ))}
      </ul>
      
      <div className="price">
        <span className="amount">{plan.monthlyPrice}</span>
        <span className="currency">BEZ/mes</span>
      </div>

      {subscribed ? (
        <button disabled className="subscribed">
          <FaCheckCircle /> Suscrito
        </button>
      ) : (
        <button onClick={handleSubscribe} className="subscribe">
          Suscribirse
        </button>
      )}
    </div>
  );
}
```

---

## ✅ Checklist de Integración

Antes de lanzar a producción, asegúrate de:

- [ ] `BezCoinProvider` está en `App.jsx` dentro de `Web3Provider`
- [ ] Todas las páginas que necesitan BezCoin importan `useBezCoin`
- [ ] Acciones costosas usan `verifyAndProceed()`
- [ ] Balance se muestra en Header/Navbar
- [ ] Modal de compra está disponible globalmente
- [ ] Historial de transacciones es accesible desde perfil
- [ ] Variables de entorno configuradas correctamente
- [ ] Backend endpoints respondiendo correctamente
- [ ] Tokens de prueba disponibles en testnet
- [ ] Pruebas realizadas en todas las funcionalidades

---

**¡Listo para usar! 🚀**

Si necesitas más ejemplos o tienes dudas, consulta `BEZCOIN-INTEGRATION-COMPLETE.md`.
