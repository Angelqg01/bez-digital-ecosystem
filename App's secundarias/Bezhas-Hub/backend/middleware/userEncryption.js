/**
 * ============================================================================
 * USER DATA ENCRYPTION MIDDLEWARE
 * ============================================================================
 * 
 * Cifrado automático de campos sensibles del usuario:
 * - Email (PII)
 * - Phone (PII)
 * - Address (PII)
 * - Date of Birth (PII)
 * - Payment Methods (Financial)
 * - KYC Data (Sensitive)
 */

const { encryptField, decryptField } = require('./fieldEncryption');

// Campos sensibles a cifrar
const SENSITIVE_FIELDS = [
    'email',
    'phone',
    'profile.address',
    'profile.dateOfBirth',
    'profile.fullName',
    'kycData.idNumber',
    'kycData.taxId',
    'kycData.address',
    'paymentMethods'
];

/**
 * Cifrar campos sensibles del usuario antes de guardar
 */
function encryptUserData(userData) {
    try {
        const encrypted = { ...userData };

        // Email
        if (encrypted.email && !encrypted.email.includes(':')) {
            encrypted.email = encryptField(encrypted.email);
            encrypted._emailEncrypted = true;
        }

        // Phone
        if (encrypted.phone && !encrypted.phone.includes(':')) {
            encrypted.phone = encryptField(encrypted.phone);
            encrypted._phoneEncrypted = true;
        }

        // Profile fields
        if (encrypted.profile) {
            if (encrypted.profile.address && !encrypted.profile.address.includes(':')) {
                encrypted.profile.address = encryptField(encrypted.profile.address);
            }
            if (encrypted.profile.dateOfBirth && !encrypted.profile.dateOfBirth.includes(':')) {
                encrypted.profile.dateOfBirth = encryptField(encrypted.profile.dateOfBirth);
            }
            if (encrypted.profile.fullName && !encrypted.profile.fullName.includes(':')) {
                encrypted.profile.fullName = encryptField(encrypted.profile.fullName);
            }
        }

        // KYC Data
        if (encrypted.kycData) {
            if (encrypted.kycData.idNumber && !encrypted.kycData.idNumber.includes(':')) {
                encrypted.kycData.idNumber = encryptField(encrypted.kycData.idNumber);
            }
            if (encrypted.kycData.taxId && !encrypted.kycData.taxId.includes(':')) {
                encrypted.kycData.taxId = encryptField(encrypted.kycData.taxId);
            }
            if (encrypted.kycData.address && !encrypted.kycData.address.includes(':')) {
                encrypted.kycData.address = encryptField(encrypted.kycData.address);
            }
        }

        // Payment Methods (array de objetos)
        if (encrypted.paymentMethods && Array.isArray(encrypted.paymentMethods)) {
            encrypted.paymentMethods = encrypted.paymentMethods.map(method => {
                const encryptedMethod = { ...method };

                if (method.cardNumber && !method.cardNumber.includes(':')) {
                    encryptedMethod.cardNumber = encryptField(method.cardNumber);
                }
                if (method.cvv && !method.cvv.includes(':')) {
                    encryptedMethod.cvv = encryptField(method.cvv);
                }

                return encryptedMethod;
            });
        }

        return encrypted;

    } catch (error) {
        console.error('Error encrypting user data:', error);
        throw error;
    }
}

/**
 * Descifrar campos sensibles del usuario al cargar
 */
function decryptUserData(userData) {
    try {
        if (!userData) return null;

        const decrypted = { ...userData };

        // Email
        if (decrypted.email && decrypted.email.includes(':')) {
            decrypted.email = decryptField(decrypted.email);
        }

        // Phone
        if (decrypted.phone && decrypted.phone.includes(':')) {
            decrypted.phone = decryptField(decrypted.phone);
        }

        // Profile fields
        if (decrypted.profile) {
            if (decrypted.profile.address && decrypted.profile.address.includes(':')) {
                decrypted.profile.address = decryptField(decrypted.profile.address);
            }
            if (decrypted.profile.dateOfBirth && decrypted.profile.dateOfBirth.includes(':')) {
                decrypted.profile.dateOfBirth = decryptField(decrypted.profile.dateOfBirth);
            }
            if (decrypted.profile.fullName && decrypted.profile.fullName.includes(':')) {
                decrypted.profile.fullName = decryptField(decrypted.profile.fullName);
            }
        }

        // KYC Data
        if (decrypted.kycData) {
            if (decrypted.kycData.idNumber && decrypted.kycData.idNumber.includes(':')) {
                decrypted.kycData.idNumber = decryptField(decrypted.kycData.idNumber);
            }
            if (decrypted.kycData.taxId && decrypted.kycData.taxId.includes(':')) {
                decrypted.kycData.taxId = decryptField(decrypted.kycData.taxId);
            }
            if (decrypted.kycData.address && decrypted.kycData.address.includes(':')) {
                decrypted.kycData.address = decryptField(decrypted.kycData.address);
            }
        }

        // Payment Methods
        if (decrypted.paymentMethods && Array.isArray(decrypted.paymentMethods)) {
            decrypted.paymentMethods = decrypted.paymentMethods.map(method => {
                const decryptedMethod = { ...method };

                if (method.cardNumber && method.cardNumber.includes(':')) {
                    decryptedMethod.cardNumber = decryptField(method.cardNumber);
                }
                if (method.cvv && method.cvv.includes(':')) {
                    decryptedMethod.cvv = decryptField(method.cvv);
                }

                return decryptedMethod;
            });
        }

        // Limpiar flags de encriptación
        delete decrypted._emailEncrypted;
        delete decrypted._phoneEncrypted;

        return decrypted;

    } catch (error) {
        console.error('Error decrypting user data:', error);
        return userData; // Return original data if decryption fails
    }
}

/**
 * Wrapper para User.save() con encriptación automática
 */
function wrapUserSave(OriginalUserClass) {
    return class EncryptedUser extends OriginalUserClass {
        async save() {
            // Cifrar antes de guardar
            const encrypted = encryptUserData(this);
            Object.assign(this, encrypted);

            // Llamar al save original
            const result = await super.save();

            // Descifrar después de guardar
            const decrypted = decryptUserData(this);
            Object.assign(this, decrypted);

            return result;
        }
    };
}

/**
 * Wrapper para User.findOne() con desencriptación automática
 */
function wrapUserFindOne(OriginalUserClass) {
    const originalFindOne = OriginalUserClass.findOne;

    OriginalUserClass.findOne = async function (query) {
        const user = await originalFindOne.call(this, query);
        return decryptUserData(user);
    };
}

/**
 * Wrapper para User.findById() con desencriptación automática
 */
function wrapUserFindById(OriginalUserClass) {
    const originalFindById = OriginalUserClass.findById;

    OriginalUserClass.findById = async function (id) {
        const user = await originalFindById.call(this, id);
        return decryptUserData(user);
    };
}

/**
 * Wrapper para User.find() con desencriptación automática
 */
function wrapUserFind(OriginalUserClass) {
    const originalFind = OriginalUserClass.find;

    OriginalUserClass.find = async function (query) {
        const users = await originalFind.call(this, query);
        return users.map(user => decryptUserData(user));
    };
}

/**
 * Aplicar todos los wrappers de encriptación
 */
function applyUserEncryption(UserClass) {
    // Wrap instance methods
    const EncryptedUser = wrapUserSave(UserClass);

    // Wrap static methods
    wrapUserFindOne(EncryptedUser);
    wrapUserFindById(EncryptedUser);
    wrapUserFind(EncryptedUser);

    return EncryptedUser;
}

/**
 * Sanitizar datos de usuario para logs (remover PII)
 */
function sanitizeUserForLog(user) {
    if (!user) return null;

    return {
        _id: user._id,
        walletAddress: user.walletAddress ?
            user.walletAddress.slice(0, 6) + '...' + user.walletAddress.slice(-4) :
            'N/A',
        role: user.role,
        subscription: user.subscription,
        isVerified: user.isVerified,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
        // Campos sensibles ocultos
        email: user.email ? '***@***' : null,
        phone: user.phone ? '***-***-****' : null
    };
}

module.exports = {
    encryptUserData,
    decryptUserData,
    applyUserEncryption,
    wrapUserSave,
    wrapUserFindOne,
    wrapUserFindById,
    wrapUserFind,
    sanitizeUserForLog,
    SENSITIVE_FIELDS
};
