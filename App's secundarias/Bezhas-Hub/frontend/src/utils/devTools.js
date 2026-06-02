/**
 * Herramientas de desarrollo para BeZhas
 * Estas funciones están disponibles en la consola del navegador para facilitar el testing
 */

import useUserStore from '../stores/userStore';

// Hacer las funciones disponibles globalmente en desarrollo
if (import.meta.env.DEV) {
    window.bezhasDevTools = {

        /**
         * Cambia el rol del usuario actual
         * @param {string} role - 'user' | 'admin' | 'professor' | 'company' | 'institution'
         * @example
         * bezhasDevTools.setRole('admin')
         */
        setRole: (role) => {
            const validRoles = ['user', 'admin', 'professor', 'company', 'institution'];
            if (!validRoles.includes(role)) {
                console.error(`❌ Rol inválido. Usa uno de: ${validRoles.join(', ')}`);
                return;
            }
            useUserStore.getState().setUserRole(role);
            console.log(`✅ Rol cambiado a: ${role}`);
        },

        /**
         * Muestra el estado actual del usuario
         */
        getUser: () => {
            const state = useUserStore.getState();
            console.log('👤 Usuario actual:', {
                username: state.userProfile?.username || 'No conectado',
                role: state.userProfile?.role || 'N/A',
                isAdmin: state.isAdmin,
                isLoggedIn: state.isLoggedIn,
                balance: state.tokenBalance,
            });
            return state.userProfile;
        },

        /**
         * Lista todos los roles disponibles
         */
        listRoles: () => {
            const roles = {
                user: 'Usuario regular',
                admin: 'Administrador (acceso completo)',
                professor: 'Catedrático (acceso educativo)',
                company: 'Empresa (publicidad y campañas)',
                institution: 'Institución (educación y publicidad)',
            };
            console.log('📋 Roles disponibles:');
            Object.entries(roles).forEach(([key, desc]) => {
                console.log(`  - ${key}: ${desc}`);
            });
            return roles;
        },

        /**
         * Simula un perfil de usuario con datos de prueba
         */
        mockUser: (role = 'user') => {
            const mockProfiles = {
                admin: {
                    username: 'Admin',
                    bio: 'Administrador del sistema',
                    avatarUrl: 'https://i.pravatar.cc/150?img=1',
                    role: 'admin',
                },
                professor: {
                    username: 'Prof. García',
                    bio: 'Catedrático de Blockchain',
                    avatarUrl: 'https://i.pravatar.cc/150?img=2',
                    role: 'professor',
                },
                company: {
                    username: 'TechCorp',
                    bio: 'Empresa de tecnología',
                    avatarUrl: 'https://i.pravatar.cc/150?img=3',
                    role: 'company',
                },
                institution: {
                    username: 'Universidad XYZ',
                    bio: 'Institución educativa',
                    avatarUrl: 'https://i.pravatar.cc/150?img=4',
                    role: 'institution',
                },
                user: {
                    username: 'Usuario Demo',
                    bio: 'Usuario de prueba',
                    avatarUrl: 'https://i.pravatar.cc/150?img=5',
                    role: 'user',
                },
            };

            const profile = mockProfiles[role] || mockProfiles.user;

            useUserStore.setState({
                userProfile: profile,
                tokenBalance: '1000.0',
                isLoggedIn: true,
                isAdmin: role === 'admin',
                isLoading: false,
            });

            console.log(`✅ Usuario simulado creado: ${profile.username} (${role})`);
            return profile;
        },

        /**
         * Muestra ayuda sobre las funciones disponibles
         */
        help: () => {
            console.log(`
🔧 BeZhas Dev Tools
==================

Funciones disponibles:

1. bezhasDevTools.setRole(role)
   - Cambia el rol del usuario actual
   - Roles: 'user', 'admin', 'professor', 'company', 'institution'
   - Ejemplo: bezhasDevTools.setRole('admin')

2. bezhasDevTools.getUser()
   - Muestra información del usuario actual

3. bezhasDevTools.listRoles()
   - Lista todos los roles disponibles

4. bezhasDevTools.mockUser(role)
   - Simula un usuario con datos de prueba
   - Ejemplo: bezhasDevTools.mockUser('admin')

5. bezhasDevTools.help()
   - Muestra esta ayuda
      `);
        },
    };

    // Mensaje de bienvenida en la consola
    console.log(`
%c🚀 BeZhas Dev Tools activadas
%cEscribe %cbezhasDevTools.help()%c para ver las funciones disponibles
  `,
        'color: #6366f1; font-size: 16px; font-weight: bold',
        'color: #64748b',
        'color: #10b981; font-weight: bold',
        'color: #64748b'
    );
}

export default window.bezhasDevTools;
