# 🔍 Troubleshooting: Página de Perfil No Se Ve

## Problema Reportado
La página de perfil no se visualiza correctamente.

## Diagnóstico

### 1. Verificar en el Navegador
```
1. Abre: http://localhost:5173/profile
2. Presiona F12 (DevTools)
3. Ve a Console
4. Busca errores en rojo
```

### 2. Posibles Causas

#### A. **RightSidebar Tapando el Contenido** ✅ MÁS PROBABLE
**Síntoma**: El contenido está ahí pero no se ve porque el sidebar derecho lo tapa.

**Solución Rápida**:
Reduce el ancho de la ventana del navegador a menos de 1280px. Si aparece el contenido, este es el problema.

**Fix Permanente**:
El sidebar derecho ya está configurado con `w-80` (320px) y el contenido principal con `flex-1`, lo cual debería funcionar. Si sigue tapando:

1. Verifica que el contenido del ProfilePage no tenga `overflow-hidden` o `position: fixed`
2. Asegúrate de que el contenedor principal tiene suficiente espacio

#### B. **Error de JavaScript en ProfilePage**
**Síntoma**: Console del navegador muestra errores en rojo.

**Posibles Errores**:
- `Cannot read property 'map' of undefined` → Datos no cargados
- `useContext must be used within Provider` → Problema de contexto
- `Cannot access before initialization` → Problema de imports

**Fix**: Comparte el error específico de la consola.

#### C. **Problema de Estilos CSS**
**Síntoma**: El contenido existe en el HTML pero no es visible.

**Verificación**:
```
1. En DevTools, ve a Elements
2. Busca el elemento <main> con el ProfilePage
3. Ve a Computed styles
4. Verifica display, visibility, opacity
```

#### D. **Backend No Responde**
**Síntoma**: Página en blanco con spinner infinito.

**Verificación**:
- En Console, busca: `Error loading profile`
- En Network tab, verifica llamadas a `/api/profile/${address}`

**Fix**: El ProfilePage tiene fallback, debería mostrar datos por defecto aunque el backend no responda.

### 3. Fixes Rápidos

#### Fix 1: Forzar Scroll en Main Content
Agrega al `main` en MainLayout:

```jsx
<main className="flex-1 overflow-x-hidden overflow-y-auto min-h-0">
  <HealthStatus />
  {children}
</main>
```

#### Fix 2: Asegurar que ProfilePage tiene Container
Verifica que ProfilePage tenga:

```jsx
<div className="container mx-auto px-4 py-6 max-w-7xl">
  {/* contenido */}
</div>
```

#### Fix 3: Verificar Z-Index
Si el RightSidebar tiene z-index muy alto:

```jsx
// En RightSidebar desktop mode
<div className="h-full overflow-y-auto" style={{ zIndex: 1 }}>
```

### 4. Test de Diagnóstico

Agrega temporalmente al inicio de ProfilePageNew.jsx:

```jsx
const ProfilePage = () => {
    console.log('🎯 ProfilePage RENDERING');
    
    // ... resto del código
    
    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'red', 
            color: 'white', 
            padding: '2rem' 
        }}>
            <h1 style={{ fontSize: '3rem' }}>PROFILE PAGE TEST</h1>
            <p>Si ves esto, el componente está renderizando</p>
        </div>
    );
};
```

Si ves el texto rojo → El problema es de estilos/layout
Si NO ves nada → El problema es que el componente no se renderiza

### 5. Comandos de Ayuda

```powershell
# Limpiar caché y reiniciar
cd frontend
Remove-Item -Path "node_modules\.vite" -Recurse -Force
npm run dev

# Ver todos los errores de compilación
npm run build
```

## Siguiente Paso

**Por favor comparte**:
1. ¿Qué ves en la consola del navegador (F12)?
2. ¿Aparece algo si reduces el ancho de la ventana?
3. ¿Ves el mensaje de test si agregas el código de diagnóstico?

Con esta información podré darte el fix exacto.
