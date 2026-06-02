const { verifyMessage } = require('ethers');
const User = require('../models/user.model');
const { UserRole } = require('../models/mockModels');

// Load Super Admin Wallets from environment
const SUPER_ADMIN_WALLETS = (process.env.SUPER_ADMIN_WALLETS || '')
    .split(',')
    .map(addr => addr.trim().toLowerCase())
    .filter(Boolean);

// Load Admin Wallets from environment (additional admins)
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map(addr => addr.trim().toLowerCase())
    .filter(Boolean);

/**
 * Middleware to validate admin signature and permissions
 * Only allows Super Admins, Admins, and Developers
 */
const validateAdminSignature = async (req, res, next) => {
    const { signature, message, address } = req.headers;

    if (!signature || !message || !address) {
        return res.status(401).json({
            error: "Autenticación Web3 requerida",
            message: "Se requiere firma de wallet para acceder al panel admin"
        });
    }

    try {
        // 1. Recuperar la dirección de la wallet que firmó el mensaje
        const recoveredAddress = verifyMessage(message, signature);

        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return res.status(401).json({ error: "Firma inválida" });
        }

        // 2. Verificar si es Super Admin (desde variable de entorno)
        const isSuperAdmin = SUPER_ADMIN_WALLETS.includes(recoveredAddress.toLowerCase());

        if (isSuperAdmin) {
            console.log(`🔐 Super Admin accediendo: ${recoveredAddress}`);
            req.user = {
                walletAddress: recoveredAddress,
                role: UserRole.ADMIN,
                isSuperAdmin: true
            };
            return next();
        }

        // 3. Verificar si está en la lista de admins adicionales
        const isAdminWallet = ADMIN_WALLETS.includes(recoveredAddress.toLowerCase());

        if (isAdminWallet) {
            console.log(`👨‍💼 Admin accediendo: ${recoveredAddress}`);
            req.user = {
                walletAddress: recoveredAddress,
                role: UserRole.ADMIN,
                isSuperAdmin: false
            };
            return next();
        }

        // 4. Verificar en base de datos si tiene rol de Admin o Developer
        const user = await User.findOne({
            walletAddress: recoveredAddress.toLowerCase()
        });

        if (!user) {
            return res.status(403).json({
                error: "Acceso denegado",
                message: "No tienes permisos para acceder al panel admin"
            });
        }

        // 5. Verificar que tenga rol de Admin o Developer
        const allowedRoles = [UserRole.ADMIN, UserRole.DEVELOPER];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                error: "Permisos insuficientes",
                message: `Se requiere rol de Admin o Developer. Tu rol actual: ${user.role}`
            });
        }

        // 6. Usuario autorizado
        console.log(`✅ Acceso autorizado - ${user.role}: ${recoveredAddress}`);
        req.user = user;
        next();

    } catch (err) {
        console.error("Error validando firma admin:", err);
        res.status(500).json({
            error: "Error en la validación de seguridad",
            message: err.message
        });
    }
};

module.exports = { validateAdminSignature };