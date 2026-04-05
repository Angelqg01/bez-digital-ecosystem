# 🔧 Guía: Configurar Usuario como Administrador

## Método 1: Usando el Selector Visual (MÁS FÁCIL) 🎨

1. Ve a http://localhost:5173/ad-center
2. En la esquina inferior derecha verás un botón flotante morado con "🔧 DEV"
3. Haz clic en el botón
4. Selecciona "👑 Administrador" de la lista
5. ¡Listo! El panel de administración aparecerá automáticamente

**Nota:** El selector de rol solo está disponible en modo desarrollo.

---

## Método 2: Usando la Consola del Navegador 💻

### Paso 1: Abrir la consola
- **Chrome/Edge**: Presiona `F12` o `Ctrl+Shift+J` (Windows) / `Cmd+Option+J` (Mac)
- **Firefox**: Presiona `F12` o `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)

### Paso 2: Ver ayuda de comandos
```javascript
bezhasDevTools.help()
```

### Paso 3: Cambiar rol a admin
```javascript
bezhasDevTools.setRole('admin')
```

### Paso 4: Verificar cambios
```javascript
bezhasDevTools.getUser()
```

---

## Método 3: Simular Usuario Admin Completo 🎭

Si quieres crear un usuario admin desde cero con todos los datos:

```javascript
bezhasDevTools.mockUser('admin')
```

Esto creará un usuario administrador con:
- Username: "Admin"
- Bio: "Administrador del sistema"
- Avatar: Imagen de prueba
- Balance: 1000 tokens

---

## Roles Disponibles 📋

Puedes cambiar entre estos roles:

| Rol | Comando | Descripción |
|-----|---------|-------------|
| 👤 Usuario | `bezhasDevTools.setRole('user')` | Usuario regular |
| 👑 Admin | `bezhasDevTools.setRole('admin')` | Administrador completo |
| 👨‍🏫 Catedrático | `bezhasDevTools.setRole('professor')` | Acceso educativo |
| 🏢 Empresa | `bezhasDevTools.setRole('company')` | Publicidad y campañas |
| 🏛️ Institución | `bezhasDevTools.setRole('institution')` | Educación y publicidad |

---

## Funcionalidades del Panel Admin 🛠️

Una vez que tengas rol de admin, verás:

### 1. Panel de Administración (fondo rojo)
- **Ver todas las campañas**: Lista completa de campañas activas
- **Eliminar campañas**: Botón rojo para eliminar cualquier campaña
- **Gestionar usuarios**: Acceso a la administración de usuarios

### 2. Paneles Adicionales
- Panel de notificaciones
- Panel de historial de eventos

---

## Método 4: Configuración Permanente (Avanzado) ⚙️

Si quieres que tu usuario conectado con wallet sea admin permanentemente:

### Opción A: Ser el owner del contrato
El usuario que desplegó el contrato `UserProfile` automáticamente es admin.

### Opción B: Modificar el store temporalmente
En `frontend/src/stores/userStore.js`, puedes forzar el rol:

```javascript
// En fetchUserData, después de obtener el perfil:
role = 'admin'; // Forzar rol admin
```

**⚠️ Advertencia:** Esto es solo para desarrollo. En producción, la lógica de roles debe estar en el smart contract.

---

## Troubleshooting 🔍

### El panel admin no aparece
1. Verifica que el rol sea 'admin':
   ```javascript
   bezhasDevTools.getUser()
   ```
2. Recarga la página: `Ctrl+R` o `Cmd+R`
3. Limpia la caché del navegador: `Ctrl+Shift+R` o `Cmd+Shift+R`

### Las devTools no están disponibles
1. Verifica que estés en modo desarrollo (puerto 5173)
2. Abre la consola y busca el mensaje de bienvenida de BeZhas Dev Tools
3. Si no aparece, reinicia el servidor frontend

### Los cambios no se guardan
Los cambios de rol se pierden al recargar la página. Usa `bezhasDevTools.mockUser('admin')` después de cada recarga, o implementa persistencia en localStorage.

---

## Comandos Rápidos ⚡

```javascript
// Ver todos los roles disponibles
bezhasDevTools.listRoles()

// Cambiar a admin
bezhasDevTools.setRole('admin')

// Simular usuario admin completo
bezhasDevTools.mockUser('admin')

// Ver estado actual
bezhasDevTools.getUser()
```

---

## Ejemplo de Flujo Completo 🎯

```javascript
// 1. Listar roles disponibles
bezhasDevTools.listRoles()

// 2. Simular un usuario admin
bezhasDevTools.mockUser('admin')

// 3. Verificar que funcionó
bezhasDevTools.getUser()
// Debería mostrar: role: 'admin', isAdmin: true

// 4. Navega a /ad-center y verás el panel admin en color rojo
```

---

## Próximos Pasos 🚀

Una vez que tengas acceso admin:

1. **Prueba eliminar campañas** desde el panel rojo
2. **Gestiona usuarios** con el botón azul
3. **Crea nuevas campañas** con el botón morado
4. **Monitorea eventos** en tiempo real en los paneles inferiores

---

## Notas Importantes ⚠️

- Las herramientas de desarrollo **solo funcionan en modo desarrollo**
- Los cambios de rol **no se persisten** al recargar la página
- Para producción, implementa la lógica de roles en el **smart contract**
- El panel admin tiene borde y fondo **rojo** para identificarlo fácilmente

---

## Soporte 💬

Si tienes problemas:
1. Revisa la consola del navegador (`F12`)
2. Verifica que los servidores estén corriendo (backend y frontend)
3. Prueba limpiar la caché del navegador
4. Reinicia los servidores si es necesario
