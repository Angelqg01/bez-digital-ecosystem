/**
 * Admin Setup Utility
 * Ejecuta este script en la consola del navegador para configurar el acceso admin
 */

(() => {
    console.log('🔧 BeZhas Admin Setup Utility');
    console.log('================================');

    // Configuración por defecto
    const defaultConfig = {
        adminToken: 'admin-dev-token-2025',
        role: 'admin',
        userId: 'admin-001',
        userName: 'Admin User',
        userEmail: 'admin@bez.digital',
    };

    // Función para configurar admin
    function setupAdmin(config = defaultConfig) {
        try {
            // 1. Configurar token de administración
            localStorage.setItem('adminToken', config.adminToken);
            console.log('✅ Admin token configurado');

            // 2. Configurar rol
            localStorage.setItem('role', config.role);
            console.log('✅ Rol configurado');

            // 3. Configurar perfil de usuario
            const userProfile = {
                id: config.userId,
                name: config.userName,
                email: config.userEmail,
                role: config.role,
                address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
                createdAt: new Date().toISOString(),
            };

            localStorage.setItem('userProfile', JSON.stringify(userProfile));
            console.log('✅ Perfil de usuario configurado');

            // 4. Marcar como logueado
            localStorage.setItem('isLoggedIn', 'true');
            console.log('✅ Estado de login configurado');

            console.log('\n📊 Configuración actual:');
            console.table({
                'Admin Token': localStorage.getItem('adminToken'),
                'Role': localStorage.getItem('role'),
                'User': config.userName,
                'Email': config.userEmail,
            });

            console.log('\n🎉 ¡Configuración completada!');
            console.log('📝 Puedes acceder al panel en: /admin/panel');
            console.log('🔄 Recarga la página para aplicar los cambios');

            // Preguntar si quiere recargar
            const shouldReload = confirm('¿Deseas recargar la página ahora?');
            if (shouldReload) {
                window.location.reload();
            }

            return true;
        } catch (error) {
            console.error('❌ Error al configurar admin:', error);
            return false;
        }
    }

    // Función para verificar configuración actual
    function checkAdminSetup() {
        console.log('\n🔍 Verificando configuración actual...\n');

        const checks = {
            'Admin Token': {
                value: localStorage.getItem('adminToken'),
                status: localStorage.getItem('adminToken') ? '✅' : '❌',
            },
            'Role': {
                value: localStorage.getItem('role'),
                status: localStorage.getItem('role') === 'admin' ? '✅' : '❌',
            },
            'User Profile': {
                value: localStorage.getItem('userProfile') ? 'Configurado' : 'No configurado',
                status: localStorage.getItem('userProfile') ? '✅' : '❌',
            },
            'Login Status': {
                value: localStorage.getItem('isLoggedIn'),
                status: localStorage.getItem('isLoggedIn') === 'true' ? '✅' : '❌',
            },
        };

        console.table(checks);

        const isFullyConfigured = Object.values(checks).every(check => check.status === '✅');

        if (isFullyConfigured) {
            console.log('\n✅ Todo configurado correctamente');
            console.log('🚀 Puedes acceder al panel admin');
        } else {
            console.log('\n⚠️ Configuración incompleta');
            console.log('💡 Ejecuta setupAdmin() para configurar');
        }

        return isFullyConfigured;
    }

    // Función para limpiar configuración
    function clearAdminSetup() {
        const confirm = window.confirm('¿Estás seguro de que deseas limpiar la configuración admin?');
        if (!confirm) return false;

        localStorage.removeItem('adminToken');
        localStorage.removeItem('role');
        localStorage.removeItem('userProfile');
        localStorage.removeItem('isLoggedIn');

        console.log('🧹 Configuración limpiada');
        console.log('🔄 Recarga la página para aplicar los cambios');

        return true;
    }

    // Función para testear acceso
    async function testAdminAccess() {
        console.log('\n🧪 Testeando acceso al panel admin...\n');

        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
            console.error('❌ No hay admin token configurado');
            console.log('💡 Ejecuta setupAdmin() primero');
            return false;
        }

        try {
            // Test 1: Health endpoint
            console.log('📡 Test 1: System Health...');
            const healthRes = await fetch('http://localhost:3001/api/admin-panel/system/health', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (healthRes.ok) {
                const healthData = await healthRes.json();
                console.log('✅ System Health:', healthData);
            } else {
                console.error('❌ Health check failed:', healthRes.status);
            }

            // Test 2: Analytics overview
            console.log('\n📡 Test 2: Analytics Overview...');
            const analyticsRes = await fetch('http://localhost:3001/api/admin-panel/analytics/overview', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (analyticsRes.ok) {
                const analyticsData = await analyticsRes.json();
                console.log('✅ Analytics:', analyticsData);
            } else {
                console.error('❌ Analytics check failed:', analyticsRes.status);
            }

            console.log('\n✅ Tests completados');
            return true;

        } catch (error) {
            console.error('❌ Error en los tests:', error);
            console.log('💡 Asegúrate de que el backend esté corriendo en localhost:3001');
            return false;
        }
    }

    // Exponer funciones globalmente
    window.setupAdmin = setupAdmin;
    window.checkAdminSetup = checkAdminSetup;
    window.clearAdminSetup = clearAdminSetup;
    window.testAdminAccess = testAdminAccess;

    // Mostrar ayuda
    console.log('\n📚 Funciones disponibles:');
    console.log('  - setupAdmin()        : Configura el acceso admin');
    console.log('  - checkAdminSetup()   : Verifica la configuración actual');
    console.log('  - clearAdminSetup()   : Limpia la configuración admin');
    console.log('  - testAdminAccess()   : Testea el acceso al backend');
    console.log('\n💡 Ejemplo de uso:');
    console.log('  setupAdmin()');
    console.log('================================\n');

    // Auto-check si se ejecuta
    checkAdminSetup();
})();
