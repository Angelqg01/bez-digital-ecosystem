# 🎨 Mapeo de Colores - Light Mode BeZhas
## Basado en imagen de referencia (SkillSet Design)

### 📋 Paleta Principal

#### Fondo General
```css
/* OLD */
bg-dark-background → bg-light-bg (#F5F3FF - lavanda muy claro)
bg-dark-surface → bg-white (#FFFFFF)

/* NEW */
background: bg-light-bg o bg-primary-50
cards: bg-white
```

#### Cards y Superficies
```css
/* OLD */
bg-dark-surface/20 → bg-white
bg-dark-surface/80 → bg-white/95
bg-dark-background/50 → bg-white/90

/* NEW */
Cards principales: bg-white
Cards con glassmorphism: bg-white/95
Inputs: bg-primary-50
```

#### Bordes
```css
/* OLD */
border-cyan-500/10 → border-light-border (# E2E8F0)
border-cyan-500/30 → border-primary-300 (#C7B7FF)

/* NEW */
Bordes normales: border-light-border
Bordes activos: border-primary-500
Bordes hover: border-primary-400
```

### 🎯 Colores de Acción

#### Primary (Violeta #9F87FF)
```css
/* Botones principales */
bg-gradient-to-r from-cyan-500 to-blue-600 
→ bg-gradient-primary (from-primary-500 to-primary-600)

/* Texto y iconos principales */
text-cyan-400 → text-primary-500
text-cyan-500 → text-primary-600
```

#### Accent (Rosa #FFC4D0)
```css
/* Elementos secundarios importantes */
from-yellow-500/20 to-orange-500/20 
→ from-accent-100 to-accent-200

text-yellow-400 → text-accent-500
bg-yellow-500/20 → bg-accent-100
```

#### Otros Acentos Pastel
```css
/* Naranja Coral */
bg-orange-300 (#FFB088)

/* Amarillo Pastel */
bg-yellow-300 (#FFE4A3)

/* Verde Menta */
bg-green-200 (#A8E6CF)

/* Azul Cielo */
bg-sky-300 (#B4D4FF)
```

### 📝 Texto

```css
/* OLD → NEW */
text-white/90 → text-text-primary (#2D3748)
text-white/70 → text-text-secondary (#718096)
text-gray-500 → text-text-muted (#A0AEC0)
placeholder-gray-500 → placeholder:text-text-muted
```

### ✨ Estados Interactivos

```css
/* Hover */
hover:bg-dark-background/30 → hover:bg-primary-50
hover:bg-dark-background/50 → hover:bg-primary-100
hover:text-cyan-400 → hover:text-primary-500

/* Focus */
focus:border-cyan-500/30 → focus:border-primary-400
focus:ring-cyan-500 → focus:ring-primary-500

/* Active/Selected */
bg-cyan-500/20 → bg-gradient-primary
text-cyan-400 → text-white (en elementos con gradient)
```

### 🎨 Gradientes

```css
/* Hero/Headers */
gradient-hero: from-primary-500 (9F87FF) to-sky-300 (B4D4FF)

/* Botones primarios */
gradient-primary: from-primary-500 to-primary-600

/* Acentos */
gradient-accent: from-accent-200 to-accent-500

/* Especiales */
gradient-orange: from-orange-300 to-orange-400
gradient-sky: from-sky-300 to-sky-400
```

### 💫 Sombras

```css
/* OLD → NEW */
shadow-cyan-500/20 → shadow-soft
shadow-lg shadow-cyan-500/20 → shadow-button
[sin shadow] → shadow-card (para todas las cards)

/* Sombras disponibles */
shadow-soft: sombra suave general
shadow-card: sombra para cards
shadow-button: sombra para botones
shadow-glow: efecto glow en hover
```

### 🎪 Componentes Específicos

#### Spinner/Loading
```css
border-4 border-cyan-500/20 border-t-cyan-500 
→ border-4 border-primary-200 border-t-primary-500
```

#### Badges/Pills
```css
bg-cyan-500/20 text-cyan-400 
→ bg-primary-100 text-primary-600
```

#### Donaciones/Rewards
```css
from-yellow-500/10 to-orange-500/10 
→ from-accent-100 to-accent-200

border-yellow-500/30 → border-accent-300
text-yellow-400 → text-accent-600
```

### 📱 Sidebar
```css
/* Fondo sidebar */
bg-dark-surface/80 → bg-white/95

/* Items sidebar */
hover:bg-dark-background/30 → hover:bg-primary-50

/* Iconos sidebar */
text-cyan-400 → text-primary-500
```

### 🔄 Patrón de Conversión Sistemático

1. **Fondos**: Oscuros → Blancos/Lavanda claro
2. **Bordes**: Cyan transparente → Gris claro sólido  
3. **Textos**: Blancos → Grises oscuros
4. **Acentos**: Cyan/Blue → Violeta/Morado
5. **Secundarios**: Yellow/Orange → Rosa pastel
6. **Shadows**: Agregar a todos los elementos card
7. **Hovers**: Oscuros → Primary-50/100

### ✅ Checklist por Página

- [ ] Fondo general (bg-light-bg)
- [ ] Cards (bg-white + border-light-border)
- [ ] Textos (text-text-primary/secondary/muted)
- [ ] Botones primarios (gradient-primary)
- [ ] Botones secundarios (colores pastel)
- [ ] Inputs (bg-primary-50)
- [ ] Hovers (primary-50/100)
- [ ] Shadows (card/soft/button)
- [ ] Bordes redondeados (rounded-xl/2xl)
- [ ] Dark mode variants (dark:)
