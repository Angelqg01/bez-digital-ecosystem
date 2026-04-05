# 🔐 Sistema Inteligente de Conexión de Wallet

## 📋 Resumen

BeZhas ahora cuenta con un **sistema unificado e inteligente** de conexión/desconexión de wallet que:

✅ **Auto-detecta** el estado de la wallet  
✅ **Cambia automáticamente** entre "Conectar" y "Desconectar"  
✅ **Sincronización global** - todos los botones comparten el mismo estado  
✅ **Diseño adaptativo** - múltiples variantes según el contexto  
✅ **Sin sobrecarga visual** - botones optimizados para cada espacio  

---

## 🎯 Componentes Disponibles

### 1. **ConnectWalletButton** (Componente Principal)

Botón inteligente que cambia entre conectar/desconectar automáticamente.

```jsx
import ConnectWalletButton from '../components/common/ConnectWalletButton';

// Uso básico
<ConnectWalletButton />

// Con variantes
<ConnectWalletButton variant="primary" size="lg" />
<ConnectWalletButton variant="secondary" />
<ConnectWalletButton variant="outline" />
<ConnectWalletButton variant="minimal" />
<ConnectWalletButton variant="danger" />

// Con callbacks
<ConnectWalletButton 
  onConnect={(address) => console.log('Conectado:', address)}
  onDisconnect={() => console.log('Desconectado')}
/>

// Mostrar dirección cuando está conectado
<ConnectWalletButton showAddress={true} />

// Textos personalizados
<ConnectWalletButton 
  connectText="Iniciar Sesión"
  disconnectText="Cerrar Sesión"
/>

// Ancho completo
<ConnectWalletButton fullWidth={true} />

// Sin ícono
<ConnectWalletButton showIcon={false} />
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'outline' | 'minimal' | 'danger'
- `size`: 'sm' | 'md' | 'lg'
- `showAddress`: boolean - Muestra dirección corta cuando está conectado
- `showIcon`: boolean - Muestra ícono (default: true)
- `connectText`: string - Texto personalizado para estado desconectado
- `disconnectText`: string - Texto personalizado para estado conectado
- `fullWidth`: boolean - Botón de ancho completo
- `onConnect`: (address) => void - Callback al conectar
- `onDisconnect`: () => void - Callback al desconectar
- `className`: string - Clases CSS adicionales

---

### 2. **Variantes Predefinidas** (Uso Rápido)

```jsx
import { 
  WalletButtonPrimary,
  WalletButtonSecondary,
  WalletButtonOutline,
  WalletButtonMinimal,
  WalletButtonDanger,
  WalletButtonIcon,
  WalletAddressButton,
  WalletButtonFull
} from '../components/common/ConnectWalletButton';

// Botón principal (morado/rosa)
<WalletButtonPrimary />

// Botón secundario (cyan/azul)
<WalletButtonSecondary />

// Botón con borde
<WalletButtonOutline />

// Botón minimalista
<WalletButtonMinimal />

// Botón de peligro (para desconectar)
<WalletButtonDanger disconnectText="Cerrar Sesión" />

// Solo ícono (compacto)
<WalletButtonIcon size={24} />

// Con dirección visible
<WalletAddressButton />

// Ancho completo
<WalletButtonFull variant="primary" />
```

---

### 3. **WalletHeaderButton** (Para Headers/Navbars)

Componente optimizado para headers con dropdown de opciones.

```jsx
import WalletHeaderButton from '../components/common/WalletHeaderButton';

// En el Header
<WalletHeaderButton />
```

**Características:**
- ✅ Compacto y optimizado para espacios reducidos
- ✅ Dropdown con opciones al hacer click
- ✅ Muestra dirección corta + ícono de verificación
- ✅ Opciones: Copiar dirección, Ver en Explorer, Desconectar
- ✅ Responsive (oculta dirección en móvil)

---

## 💻 Ejemplos de Uso en Diferentes Contextos

### En una Página de Login/Register

```jsx
import ConnectWalletButton from '../components/common/ConnectWalletButton';

function LoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2>Iniciar Sesión</h2>
      
      {/* Botón grande y llamativo */}
      <ConnectWalletButton 
        variant="primary"
        size="lg"
        fullWidth={true}
        connectText="Conectar con Web3"
      />
      
      <p className="text-sm text-gray-500">
        Conecta tu wallet MetaMask o WalletConnect
      </p>
    </div>
  );
}
```

### En el Header/Navbar

```jsx
import WalletHeaderButton from '../components/common/WalletHeaderButton';

function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      <Logo />
      <Navigation />
      
      {/* Botón compacto con dropdown */}
      <WalletHeaderButton />
    </header>
  );
}
```

### En un Dashboard

```jsx
import { WalletButtonOutline, WalletAddressButton } from '../components/common/ConnectWalletButton';

function Dashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Card de perfil */}
      <div className="card">
        <h3>Mi Wallet</h3>
        {/* Mostrar dirección con estilo outline */}
        <WalletAddressButton className="mt-4" />
      </div>
      
      {/* Acciones rápidas */}
      <div className="card">
        <h3>Acciones</h3>
        <WalletButtonOutline size="sm" />
      </div>
    </div>
  );
}
```

### En un Modal

```jsx
import { WalletButtonFull } from '../components/common/ConnectWalletButton';

function BuyModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2>Comprar NFT</h2>
      <p>Precio: 100 BEZ</p>
      
      {/* Botón de ancho completo */}
      <WalletButtonFull 
        variant="primary"
        onConnect={() => console.log('Listo para comprar')}
      />
    </Modal>
  );
}
```

### En un Marketplace

```jsx
import ConnectWalletButton from '../components/common/ConnectWalletButton';
import { useWalletConnect } from '../hooks/useWalletConnect';

function NFTCard({ nft }) {
  const { isConnected } = useWalletConnect();
  
  return (
    <div className="nft-card">
      <img src={nft.image} />
      <h3>{nft.name}</h3>
      
      {isConnected ? (
        <button className="btn-buy">Comprar {nft.price} BEZ</button>
      ) : (
        // Solo muestra el botón si NO está conectado
        <ConnectWalletButton 
          variant="primary"
          size="md"
          fullWidth={true}
          connectText="Conectar para Comprar"
        />
      )}
    </div>
  );
}
```

### En Sidebar/Menu Lateral

```jsx
import { WalletButtonIcon } from '../components/common/ConnectWalletButton';

function Sidebar() {
  return (
    <aside className="sidebar">
      <nav>
        <MenuItem icon={<Home />} text="Inicio" />
        <MenuItem icon={<User />} text="Perfil" />
      </nav>
      
      {/* Botón solo con ícono al final */}
      <div className="mt-auto">
        <WalletButtonIcon size={20} />
      </div>
    </aside>
  );
}
```

---

## 🎨 Guía de Diseño

### Cuándo Usar Cada Variante

| Variante | Contexto | Ejemplo |
|----------|----------|---------|
| **primary** | Acción principal, CTAs | Páginas de login, modales de compra |
| **secondary** | Acciones secundarias | Dashboards, settings |
| **outline** | Estilo minimalista | Cards de perfil, sidebars |
| **minimal** | Integración sutil | Footers, menús compactos |
| **danger** | Desconexión explícita | Configuración de seguridad |
| **icon** | Espacios muy reducidos | Mobile navbars, tooltips |

### Tamaños Recomendados

- **sm**: Mobile navbars, chips, badges
- **md**: Uso general en escritorio (default)
- **lg**: Páginas de landing, CTAs principales

---

## 🔧 Estado Compartido

Todos los botones **comparten el mismo estado** gracias al hook `useWalletConnect`:

```jsx
// Ejemplo: Múltiples botones sincronizados
<div>
  {/* Header */}
  <WalletHeaderButton />
  
  {/* Sidebar */}
  <WalletButtonIcon />
  
  {/* Content */}
  <ConnectWalletButton variant="primary" />
</div>

// Si el usuario conecta desde CUALQUIERA, 
// TODOS los botones se actualizan automáticamente
```

---

## ✅ Ventajas del Sistema

1. **Un Solo Componente**: No necesitas crear botones personalizados
2. **Auto-actualización**: Detecta el estado automáticamente
3. **Sincronización Global**: Todos los botones se sincronizan
4. **Responsive**: Se adapta a móvil y escritorio
5. **Accesible**: Títulos y aria-labels correctos
6. **Callbacks**: Ejecuta código al conectar/desconectar
7. **Customizable**: Props flexibles para cualquier caso de uso

---

## 📍 Dónde Están los Botones Actualmente

Ya se están usando en:
- ✅ `Header.jsx` - Header principal
- ✅ `AboutPage.jsx` - Página About
- ✅ `BeVIP.jsx` - Página VIP
- ✅ `LoginPage.jsx` - Login
- ✅ `DAOPage.jsx` - DAO
- ✅ `BusinessDashboard.jsx` - Dashboard de negocios
- ✅ Y más...

**Todos se actualizaron para usar el sistema unificado.**

---

## 🚀 Próximos Pasos

1. ✅ Componente inteligente creado
2. ✅ Variantes predefinidas
3. ✅ WalletHeaderButton para navbars
4. ✅ Documentación completa
5. ⏳ Reemplazar botones antiguos en toda la plataforma
6. ⏳ Agregar animaciones al conectar/desconectar
7. ⏳ Notificaciones toast al conectar/desconectar

---

**¡El sistema está listo para usar en toda la plataforma! 🎉**

Simplemente importa `ConnectWalletButton` o alguna de sus variantes y el botón se comportará inteligentemente según el estado de la wallet.
