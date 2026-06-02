# 🎯 BezCoin - Ejemplos de Integración en Páginas Específicas

Esta guía te muestra **exactamente** cómo integrar el sistema de BezCoin en tus páginas existentes con ejemplos completos y funcionales.

---

## 📋 Tabla de Contenidos

1. [Ejemplo 1: BeVIP Page - Suscripción Premium](#ejemplo-1-bevip-page)
2. [Ejemplo 2: ProfileView - Sistema de Donaciones](#ejemplo-2-profileview-donations)
3. [Ejemplo 3: Header - Mostrar Balance](#ejemplo-3-header-balance)
4. [Ejemplo 4: Marketplace - Compra de Items](#ejemplo-4-marketplace)
5. [Ejemplo 5: RewardsPage - Historial de Transacciones](#ejemplo-5-rewardspage)
6. [Patrón General de Integración](#patrón-general)

---

## Ejemplo 1: BeVIP Page - Suscripción Premium

**Ubicación**: `frontend/src/pages/BeVIP.jsx`

### 📝 Código Completo con Integración

```jsx
import { useState } from 'react';
import { useBezCoin } from '../context/BezCoinContext';
import BuyBezCoinModal from '../components/modals/BuyBezCoinModal';
import InsufficientFundsModal from '../components/modals/InsufficientFundsModal';
import { FaCrown, FaCheck, FaCoins, FaStar } from 'react-icons/fa';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const BeVIP = () => {
  // 🔥 1. Importar el hook de BezCoin
  const { 
    balance, 
    verifyAndProceed, 
    showBuyModal, 
    setShowBuyModal,
    insufficientFundsModal,
    setInsufficientFundsModal
  } = useBezCoin();

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  // Planes VIP con precios en BEZ
  const vipPlans = [
    {
      id: 'monthly',
      name: 'VIP Mensual',
      price: '50', // 50 BEZ
      duration: '30 días',
      features: [
        'Badge exclusivo VIP',
        'Acceso a contenido premium',
        'Sin anuncios',
        '2x recompensas en posts',
        'Soporte prioritario'
      ]
    },
    {
      id: 'yearly',
      name: 'VIP Anual',
      price: '500', // 500 BEZ (ahorro de 100 BEZ)
      duration: '365 días',
      features: [
        'Todo lo de VIP Mensual',
        'Badge VIP Gold',
        '3x recompensas en posts',
        'Acceso anticipado a features',
        'NFT exclusivo de miembro',
        'Ahorro de 100 BEZ'
      ],
      popular: true
    },
    {
      id: 'lifetime',
      name: 'VIP de Por Vida',
      price: '2000', // 2000 BEZ
      duration: 'Para siempre',
      features: [
        'Todo lo de VIP Anual',
        'Badge VIP Platinum',
        '5x recompensas en posts',
        'Nombre en Hall of Fame',
        'NFT coleccionable único',
        'Acceso a eventos exclusivos'
      ]
    }
  ];

  // 🔥 2. Función para suscribirse usando verifyAndProceed
  const handleSubscribe = async (plan) => {
    setSelectedPlan(plan);
    setLoading(true);

    try {
      // Verificar balance y mostrar modal de compra si es necesario
      await verifyAndProceed(
        plan.price, 
        `Suscripción ${plan.name}`,
        async () => {
          // Esta función solo se ejecuta si hay suficiente balance
          // o después de que el usuario compre tokens
          
          // Aquí iría la lógica real de suscripción
          // Por ejemplo, llamar a un smart contract o backend
          
          // Simulación:
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          toast.success(`¡Te has suscrito a ${plan.name}!`);
          console.log('Suscripción procesada:', plan);
          
          // Aquí podrías actualizar el estado del usuario, etc.
        }
      );
    } catch (error) {
      console.error('Error en suscripción:', error);
      toast.error('Error al procesar la suscripción');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block"
        >
          <FaCrown className="text-yellow-400 text-6xl mx-auto mb-4" />
        </motion.div>
        
        <h1 className="text-5xl font-bold text-white mb-4">
          Hazte Miembro VIP
        </h1>
        
        <p className="text-xl text-purple-200 mb-6">
          Desbloquea beneficios exclusivos y apoya la plataforma
        </p>

        {/* 🔥 3. Mostrar balance actual */}
        <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full">
          <FaCoins className="text-yellow-400 text-2xl" />
          <span className="text-white text-lg font-semibold">
            Tu balance: {parseFloat(balance).toFixed(2)} BEZ
          </span>
          <button
            onClick={() => setShowBuyModal(true)}
            className="bg-yellow-400 text-purple-900 px-4 py-1 rounded-full font-bold hover:bg-yellow-300 transition-colors text-sm"
          >
            Comprar más
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {vipPlans.map((plan) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            className={`relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 border-2 ${
              plan.popular 
                ? 'border-yellow-400 shadow-2xl shadow-yellow-400/50' 
                : 'border-purple-400'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-purple-900 px-6 py-1 rounded-full font-bold text-sm">
                🔥 MÁS POPULAR
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">
                {plan.name}
              </h3>
              <div className="flex items-center justify-center gap-2 mb-2">
                <FaCoins className="text-yellow-400 text-3xl" />
                <span className="text-4xl font-bold text-white">
                  {plan.price}
                </span>
                <span className="text-purple-200">BEZ</span>
              </div>
              <p className="text-purple-200">{plan.duration}</p>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-white">
                  <FaCheck className="text-green-400 mt-1 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* 🔥 4. Botón que usa verifyAndProceed */}
            <button
              onClick={() => handleSubscribe(plan)}
              disabled={loading && selectedPlan?.id === plan.id}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                plan.popular
                  ? 'bg-yellow-400 text-purple-900 hover:bg-yellow-300 shadow-lg hover:shadow-xl'
                  : 'bg-purple-600 text-white hover:bg-purple-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading && selectedPlan?.id === plan.id ? (
                <span className="flex items-center justify-center gap-2">
                  <FaStar className="animate-spin" />
                  Procesando...
                </span>
              ) : (
                'Suscribirme Ahora'
              )}
            </button>
          </motion.div>
        ))}
      </div>

      {/* 🔥 5. Modales necesarios */}
      <BuyBezCoinModal 
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />

      <InsufficientFundsModal
        isOpen={insufficientFundsModal.show}
        onClose={() => setInsufficientFundsModal({ show: false })}
        requiredAmount={insufficientFundsModal.requiredAmount}
        currentBalance={balance}
        actionName={insufficientFundsModal.actionName}
        onPurchaseComplete={insufficientFundsModal.callback}
      />
    </div>
  );
};

export default BeVIP;
```

### 🎯 Puntos Clave:

1. **Importar hook**: `useBezCoin()`
2. **Usar `verifyAndProceed()`**: Automáticamente verifica balance y ejecuta callback
3. **Mostrar balance**: Para que el usuario sepa cuánto tiene
4. **Botón de comprar más**: Por si necesita tokens adicionales
5. **Incluir modales**: `BuyBezCoinModal` y `InsufficientFundsModal`

---

## Ejemplo 2: ProfileView - Sistema de Donaciones

**Ubicación**: `frontend/src/pages/ProfileView.jsx`

### 📝 Código de Integración

```jsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useBezCoin } from '../context/BezCoinContext';
import BuyBezCoinModal from '../components/modals/BuyBezCoinModal';
import { FaCoins, FaHeart, FaGift } from 'react-icons/fa';
import toast from 'react-hot-toast';

const ProfileView = () => {
  const { address } = useParams(); // Dirección del perfil que estamos viendo
  const { donate, balance, showBuyModal, setShowBuyModal } = useBezCoin();

  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donationAmount, setDonationAmount] = useState('');
  const [donationMessage, setDonationMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // 🔥 Función para donar con verificación automática de balance
  const handleDonate = async () => {
    if (!donationAmount || parseFloat(donationAmount) <= 0) {
      toast.error('Ingresa una cantidad válida');
      return;
    }

    setLoading(true);

    try {
      // El hook donate() ya incluye verificación de balance
      const result = await donate(
        address, // Dirección del destinatario
        donationAmount,
        donationMessage
      );

      if (result.success) {
        toast.success(`¡Has donado ${donationAmount} BEZ! 🎉`);
        toast.success('Has ganado 1% de recompensa por tu donación! 🎁');
        
        // Limpiar formulario
        setDonationAmount('');
        setDonationMessage('');
        setShowDonateModal(false);
      }
    } catch (error) {
      console.error('Error donando:', error);
      toast.error('Error al procesar la donación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* ... resto del perfil ... */}

      {/* 🔥 Sección de Donaciones */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <FaGift className="text-pink-500 text-2xl" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Apoya a este creador
          </h3>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Envía BEZ tokens para mostrar tu aprecio. ¡Recibirás 1% de recompensa!
        </p>

        <button
          onClick={() => setShowDonateModal(true)}
          className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
        >
          <FaHeart />
          Donar BEZ
        </button>
      </div>

      {/* 🔥 Modal de Donación */}
      {showDonateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Donar a este creador
            </h3>

            {/* Balance actual */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Tu balance:
                </span>
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                  <FaCoins />
                  {parseFloat(balance).toFixed(2)} BEZ
                </span>
              </div>
            </div>

            {/* Input cantidad */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cantidad a donar
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  BEZ
                </span>
              </div>
              
              {/* Botones rápidos */}
              <div className="flex gap-2 mt-2">
                {['10', '50', '100'].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setDonationAmount(amount)}
                    className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    {amount} BEZ
                  </button>
                ))}
              </div>
            </div>

            {/* Mensaje opcional */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mensaje (opcional)
              </label>
              <textarea
                value={donationMessage}
                onChange={(e) => setDonationMessage(e.target.value)}
                placeholder="Escribe un mensaje de apoyo..."
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDonateModal(false)}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDonate}
                disabled={loading || !donationAmount}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Procesando...' : 'Donar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de compra */}
      <BuyBezCoinModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />
    </div>
  );
};

export default ProfileView;
```

---

## Ejemplo 3: Header - Mostrar Balance

**Ubicación**: `frontend/src/components/layout/Header.jsx`

### 📝 Integración en Header

```jsx
import { useBezCoin } from '../../context/BezCoinContext';
import BuyBezCoinModal from '../modals/BuyBezCoinModal';
import { FaCoins, FaPlus } from 'react-icons/fa';

const Header = () => {
  // 🔥 Obtener balance y función para abrir modal
  const { balance, setShowBuyModal, showBuyModal } = useBezCoin();

  return (
    <header className="bg-white dark:bg-gray-800 shadow-lg">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo y navegación ... */}
          
          {/* 🔥 Balance de BEZ en el Header */}
          <div className="flex items-center gap-4">
            
            {/* Balance Display */}
            <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 rounded-full shadow-lg">
              <FaCoins className="text-yellow-300 text-xl" />
              <span className="text-white font-bold">
                {parseFloat(balance).toFixed(2)}
              </span>
              <span className="text-white/80 text-sm">BEZ</span>
              
              {/* Botón de comprar */}
              <button
                onClick={() => setShowBuyModal(true)}
                className="ml-2 bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors"
                title="Comprar más BEZ"
              >
                <FaPlus className="text-white text-sm" />
              </button>
            </div>

            {/* Otras acciones del header (notificaciones, perfil, etc.) */}
          </div>
        </div>
      </nav>

      {/* 🔥 Modal de compra */}
      <BuyBezCoinModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />
    </header>
  );
};

export default Header;
```

---

## Ejemplo 4: Marketplace - Compra de Items

**Ubicación**: `frontend/src/pages/ShopPage.jsx` o `MarketplaceUnified.jsx`

```jsx
import { useBezCoin } from '../context/BezCoinContext';
import { FaShoppingCart, FaCoins } from 'react-icons/fa';
import toast from 'react-hot-toast';

const ShopPage = () => {
  const { verifyAndProceed, balance } = useBezCoin();
  const [loading, setLoading] = useState(false);

  const items = [
    {
      id: 1,
      name: 'NFT Exclusivo',
      price: '100',
      image: '/nft1.jpg'
    },
    {
      id: 2,
      name: 'Badge Premium',
      price: '25',
      image: '/badge1.jpg'
    }
  ];

  // 🔥 Función para comprar con verificación de balance
  const handlePurchase = async (item) => {
    setLoading(true);

    try {
      await verifyAndProceed(
        item.price,
        `Comprar ${item.name}`,
        async () => {
          // Lógica de compra real aquí
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          toast.success(`¡Has comprado ${item.name}!`);
          
          // Actualizar inventario, etc.
        }
      );
    } catch (error) {
      toast.error('Error en la compra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {items.map((item) => (
        <div key={item.id} className="bg-white rounded-lg shadow-lg p-6">
          <img src={item.image} alt={item.name} className="w-full h-48 object-cover rounded-lg mb-4" />
          
          <h3 className="text-xl font-bold mb-2">{item.name}</h3>
          
          <div className="flex items-center gap-2 mb-4">
            <FaCoins className="text-yellow-500" />
            <span className="text-2xl font-bold">{item.price}</span>
            <span className="text-gray-500">BEZ</span>
          </div>

          {/* 🔥 Botón de compra con verificación */}
          <button
            onClick={() => handlePurchase(item)}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <FaShoppingCart className="inline mr-2" />
            {loading ? 'Procesando...' : 'Comprar'}
          </button>
        </div>
      ))}
    </div>
  );
};
```

---

## Ejemplo 5: RewardsPage - Historial de Transacciones

**Ubicación**: `frontend/src/pages/RewardsPage.jsx`

```jsx
import { useBezCoin } from '../context/BezCoinContext';
import TransactionHistory from '../components/bezcoin/TransactionHistory';
import BuyBezCoinModal from '../components/modals/BuyBezCoinModal';
import { FaCoins, FaTrophy, FaChartLine } from 'react-icons/fa';

const RewardsPage = () => {
  const { balance, showBuyModal, setShowBuyModal } = useBezCoin();

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header con balance */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              <FaTrophy className="inline mr-3" />
              Mis Recompensas
            </h1>
            <p className="text-purple-100">
              Gana BEZ tokens participando en la comunidad
            </p>
          </div>
          
          {/* 🔥 Balance destacado */}
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-center">
            <p className="text-sm text-purple-100 mb-1">Balance Total</p>
            <div className="flex items-center gap-2 justify-center">
              <FaCoins className="text-yellow-300 text-3xl" />
              <span className="text-4xl font-bold">
                {parseFloat(balance).toFixed(2)}
              </span>
              <span className="text-2xl text-purple-100">BEZ</span>
            </div>
            <button
              onClick={() => setShowBuyModal(true)}
              className="mt-3 bg-yellow-400 text-purple-900 px-4 py-2 rounded-lg font-semibold hover:bg-yellow-300 transition-colors text-sm"
            >
              Comprar más
            </button>
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <FaChartLine className="text-green-500 text-3xl mb-3" />
          <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">
            Ganado este mes
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            125 BEZ
          </p>
        </div>
        
        {/* Más estadísticas... */}
      </div>

      {/* 🔥 Historial completo de transacciones */}
      <TransactionHistory />

      {/* Modal de compra */}
      <BuyBezCoinModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />
    </div>
  );
};

export default RewardsPage;
```

---

## 🎯 Patrón General de Integración

### Para CUALQUIER página que necesite tokens:

```jsx
// 1️⃣ Imports necesarios
import { useBezCoin } from '../context/BezCoinContext';
import BuyBezCoinModal from '../components/modals/BuyBezCoinModal';
import InsufficientFundsModal from '../components/modals/InsufficientFundsModal';

const MyPage = () => {
  // 2️⃣ Usar el hook
  const { 
    balance,                    // Balance actual del usuario
    verifyAndProceed,           // Función para verificar balance y ejecutar acción
    donate,                     // Función para donar (ya incluye verificación)
    transfer,                   // Función para transferir
    showBuyModal,               // Estado del modal de compra
    setShowBuyModal,            // Función para abrir/cerrar modal
    insufficientFundsModal,     // Estado del modal de fondos insuficientes
    setInsufficientFundsModal   // Función para controlar modal
  } = useBezCoin();

  // 3️⃣ Función que requiere tokens
  const handleActionThatCostsTokens = async () => {
    await verifyAndProceed(
      '100',              // Cantidad requerida
      'Mi Acción',        // Nombre de la acción
      async () => {       // Callback que se ejecuta si hay balance
        // Tu lógica aquí
        await doSomething();
      }
    );
  };

  return (
    <div>
      {/* 4️⃣ Mostrar balance (opcional) */}
      <div>Balance: {balance} BEZ</div>

      {/* 5️⃣ Botón que ejecuta la acción */}
      <button onClick={handleActionThatCostsTokens}>
        Ejecutar Acción
      </button>

      {/* 6️⃣ Modales necesarios */}
      <BuyBezCoinModal 
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />
      
      <InsufficientFundsModal
        isOpen={insufficientFundsModal.show}
        onClose={() => setInsufficientFundsModal({ show: false })}
        requiredAmount={insufficientFundsModal.requiredAmount}
        currentBalance={balance}
        actionName={insufficientFundsModal.actionName}
        onPurchaseComplete={insufficientFundsModal.callback}
      />
    </div>
  );
};
```

---

## 📋 Checklist de Integración

Al integrar en una página nueva, asegúrate de:

- [ ] Importar `useBezCoin` hook
- [ ] Importar `BuyBezCoinModal`
- [ ] Importar `InsufficientFundsModal` (si usas `verifyAndProceed`)
- [ ] Usar `verifyAndProceed()` para acciones que cuestan tokens
- [ ] Mostrar balance (opcional pero recomendado)
- [ ] Incluir los modales al final del JSX
- [ ] Manejar estados de loading
- [ ] Mostrar mensajes de éxito/error con toast

---

## 🚀 Tips Avanzados

### 1. Validación antes de mostrar botón

```jsx
const canAfford = parseFloat(balance) >= parseFloat(requiredAmount);

<button 
  disabled={!canAfford}
  className={canAfford ? 'bg-green-500' : 'bg-gray-400'}
>
  {canAfford ? 'Comprar' : `Necesitas ${requiredAmount} BEZ`}
</button>
```

### 2. Mostrar diferencia de balance

```jsx
const shortfall = parseFloat(requiredAmount) - parseFloat(balance);

{shortfall > 0 && (
  <p className="text-red-500">
    Te faltan {shortfall.toFixed(2)} BEZ
  </p>
)}
```

### 3. Botón de compra rápida

```jsx
<button 
  onClick={() => setShowBuyModal(true)}
  className="text-purple-600 underline"
>
  Comprar BEZ ahora
</button>
```

---

## ❓ ¿Qué página quieres integrar primero?

Te puedo ayudar específicamente con:
- BeVIP Page (suscripciones)
- ProfileView (donaciones)
- Marketplace (compras)
- DAOs Page (crear DAOs)
- Cualquier otra página específica

Solo dime cuál y te genero el código completo adaptado a tu estructura actual! 🚀
