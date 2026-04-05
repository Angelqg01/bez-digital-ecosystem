# 📤 Sistema de Compartir en Redes Sociales - BeZhas

## 🎯 Descripción

Sistema completo de compartir contenido en redes sociales con tracking, analytics y sistema de recompensas integrado.

## ✨ Características

### Redes Sociales Soportadas
- ✅ **Twitter/X** - Tweet con hashtags y menciones
- ✅ **Facebook** - Compartir en timeline
- ✅ **LinkedIn** - Compartir profesional
- ✅ **WhatsApp** - Compartir en chats
- ✅ **Telegram** - Enviar a canales
- ✅ **Reddit** - Publicar en subreddits
- ✅ **Email** - Enviar por correo
- ✅ **Discord** - Copiar para Discord
- ✅ **Copy Link** - Copiar al portapapeles
- ✅ **Native Share** - API nativa del navegador

### Funcionalidades Avanzadas
- 🎁 **Sistema de Recompensas**: 5 BEZ por compartir (máx 20/día)
- 📊 **Analytics Completo**: Tracking por plataforma
- 🔥 **Trending Posts**: Identifica contenido viral
- 📈 **Growth Metrics**: Tasas de crecimiento
- 👥 **User Engagement**: Métricas de alcance
- ⏰ **Time Analytics**: Actividad por hora
- 🎯 **Share Limits**: Control de spam

## 🚀 Uso Rápido

### Componente Principal

```jsx
import SocialShareSystem from '@/components/social/SocialShareSystem';

function MyPost() {
  return (
    <SocialShareSystem
      url="https://bezhas.com/post/123"
      title="Título del Post"
      description="Descripción del contenido"
      hashtags={['BeZhas', 'Web3', 'NFT']}
      postId="post-123"
      onShare={(data) => console.log('Compartido en:', data.platform)}
    />
  );
}
```

### Botones Compactos

```jsx
import { CompactShareButtons } from '@/components/social/SocialShareSystem';

function QuickShare() {
  return (
    <CompactShareButtons
      url="https://bezhas.com"
      title="BeZhas Platform"
      onShare={(data) => console.log(data)}
      showLabel={true}
    />
  );
}
```

### Hook Personalizado

```jsx
import { useSocialShare } from '@/hooks/useSocialShare';

function MyComponent() {
  const {
    shareCount,
    handleShare,
    loadShareHistory,
    getShareStats
  } = useSocialShare({
    postId: 'post-123',
    userId: 'user-456',
    onRewardEarned: (reward) => {
      console.log('Ganaste:', reward.tokens, 'BEZ');
    }
  });

  const share = async (platform) => {
    await handleShare({
      platform,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <button onClick={() => share('twitter')}>
      Compartir ({shareCount})
    </button>
  );
}
```

## 📊 Panel de Analytics (Admin)

```jsx
import ShareAnalyticsPanel from '@/components/admin/ShareAnalyticsPanel';

function AdminDashboard() {
  return (
    <div>
      <h1>Dashboard de Compartidos</h1>
      <ShareAnalyticsPanel />
    </div>
  );
}
```

## 🔌 API Endpoints

### Registrar Compartido
```http
POST /api/social/share
Content-Type: application/json
Authorization: Bearer {token}

{
  "postId": "post-123",
  "platform": "twitter",
  "url": "https://bezhas.com/post/123",
  "comment": "Check this out!"
}

Response:
{
  "success": true,
  "share": { ... },
  "reward": {
    "tokens": 5,
    "exp": 10,
    "reason": "Compartir contenido"
  },
  "totalShares": 125,
  "todayShares": 3,
  "limitReached": false
}
```

### Obtener Estadísticas
```http
GET /api/social/share/:postId

Response:
{
  "success": true,
  "total": 125,
  "shares": [ ... ],
  "byPlatform": {
    "twitter": 45,
    "facebook": 32,
    "whatsapp": 28,
    ...
  }
}
```

### Analytics (Admin)
```http
GET /api/social/share/analytics
Authorization: Bearer {admin-token}

Response:
{
  "success": true,
  "analytics": {
    "totalShares": 8534,
    "lastMonthShares": 2145,
    "growthRate": "23.5",
    "byPlatform": [ ... ],
    "topSharedPosts": [ ... ],
    "sharesByHour": [ ... ]
  }
}
```

## 🎁 Sistema de Recompensas

### Reglas
- **5 BEZ** por cada compartido
- **Máximo 20 compartidos** por día = 100 BEZ/día
- **10 EXP** adicionales por compartido
- Límites se resetean a las 00:00 UTC

### Tracking Automático
- Cada compartido se registra en la base de datos
- Se actualiza el balance del usuario automáticamente
- Se envía notificación al autor del post
- Analytics en tiempo real

## 🎨 Personalización

### Colores por Plataforma
```javascript
const platformColors = {
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  whatsapp: '#25D366',
  telegram: '#0088cc',
  reddit: '#FF4500'
};
```

### Iconos Personalizados
```jsx
import { FaWhatsapp, FaTelegram } from 'react-icons/fa';
import { Twitter, Facebook } from 'lucide-react';
```

## 📱 Responsive Design
- ✅ Mobile-first approach
- ✅ Touch-friendly buttons
- ✅ Modal adaptivo
- ✅ Grid responsive (2-4 columnas)

## 🔒 Seguridad
- ✅ Autenticación requerida
- ✅ Rate limiting (20/día)
- ✅ Validación de URLs
- ✅ Sanitización de inputs
- ✅ CSRF protection

## 📈 Métricas Tracked
- Total de compartidos
- Compartidos por plataforma
- Compartidos por hora/día
- Posts más compartidos
- Usuarios más activos
- Tasa de crecimiento
- Alcance estimado
- Engagement rate

## 🧪 Testing

```javascript
// Test básico de compartir
const shareData = {
  platform: 'twitter',
  postId: 'test-123',
  url: 'https://test.com'
};

const result = await handleShare(shareData);
expect(result.success).toBe(true);
expect(result.reward.tokens).toBe(5);
```

## 🚀 Deployment

1. Asegurar que las rutas estén registradas en `server.js`
2. Modelo `Share` debe estar en MongoDB
3. Frontend debe tener acceso a los componentes
4. Variables de entorno configuradas

## 📝 Changelog

### v1.0.0 (2025-01-13)
- ✅ Sistema completo de compartir
- ✅ 10 plataformas sociales
- ✅ Sistema de recompensas
- ✅ Analytics dashboard
- ✅ Tracking completo
- ✅ API REST completa
- ✅ Componentes React
- ✅ Hooks personalizados

## 🤝 Contribuir
Reporta bugs o sugiere mejoras en GitHub Issues

## 📄 Licencia
MIT License - BeZhas Platform

---

**Made with ❤️ by BeZhas Team**
