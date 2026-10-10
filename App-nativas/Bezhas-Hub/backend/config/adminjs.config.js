/**
 * AdminJS Configuration
 * 
 * Este archivo configura el panel de administración AdminJS para BeZhas.
 * Incluye autenticación segura y configuración personalizada de la UI.
 * 
 * NOTA: Actualmente sin recursos de Mongoose, usando recursos personalizados
 * para la base de datos en memoria.
 */

const AdminJS = require('adminjs');
const { buildAuthenticatedRouter } = require('@adminjs/express');

/**
 * Configuración de autenticación para el panel de administración
 * Las credenciales se almacenan de forma segura en variables de entorno
 */
const authenticate = async (email, password) => {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bezhas.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'BeZhas2024!Secure';

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return {
            email: ADMIN_EMAIL,
            role: 'admin',
            title: 'Administrador Principal'
        };
    }
    return null;
};

/**
 * Crea y configura la instancia de AdminJS
 * @returns {Object} Router de Express configurado con AdminJS
 */
const createAdminPanel = () => {
    // Configuración principal de AdminJS
    const adminOptions = {
        resources: [],
        rootPath: '/admin',
        branding: {
            companyName: 'BeZhas Admin Panel',
            logo: false,
            softwareBrothers: false,
            theme: {
                colors: {
                    primary100: '#6366f1', // Indigo-500 (color primario de BeZhas)
                    primary80: '#818cf8',
                    primary60: '#a5b4fc',
                    primary40: '#c7d2fe',
                    primary20: '#e0e7ff',
                    grey100: '#151515',
                    grey80: '#1f1f1f',
                    grey60: '#2a2a2a',
                    grey40: '#3d3d3d',
                    grey20: '#525252',
                    filterBg: '#1f1f1f',
                    accent: '#ec4899', // Pink-500 (acento)
                    hoverBg: '#2a2a2a',
                },
            },
        },
        locale: {
            language: 'es',
            translations: {
                es: {
                    labels: {
                        loginWelcome: 'Bienvenido al Panel de Administración de BeZhas',
                    },
                    messages: {
                        loginWelcome: 'Ingresa tus credenciales para acceder al panel de control'
                    },
                    actions: {
                        list: 'Lista',
                        new: 'Crear Nuevo',
                        edit: 'Editar',
                        show: 'Ver Detalles',
                        delete: 'Eliminar',
                        bulkDelete: 'Eliminar Seleccionados',
                        search: 'Buscar...',
                    },
                },
            },
        },
    };

    // Crear instancia de AdminJS
    const admin = new AdminJS(adminOptions);

    // Configurar el router de Express con autenticación
    const COOKIE_SECRET = process.env.COOKIE_SECRET || 'bezhas-super-secret-cookie-key-change-in-production';

    const adminRouter = buildAuthenticatedRouter(
        admin,
        {
            authenticate,
            cookiePassword: COOKIE_SECRET,
            cookieName: 'adminjs',
        },
        null,
        {
            secret: COOKIE_SECRET,
            resave: false,
            saveUninitialized: true,
            cookie: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // HTTPS en producción
                maxAge: 1000 * 60 * 60 * 24, // 24 horas
            },
            name: 'adminjs.sid',
        }
    );

    return { admin, router: adminRouter };
};

module.exports = { createAdminPanel };
