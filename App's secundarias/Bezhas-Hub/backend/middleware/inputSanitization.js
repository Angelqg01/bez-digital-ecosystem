/**
 * ============================================================================
 * INPUT SANITIZATION MIDDLEWARE
 * ============================================================================
 * 
 * Sanitiza y valida todos los inputs para prevenir inyecciones
 */

const validator = require('validator');

/**
 * Sanitiza un string removiendo caracteres peligrosos
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return str;

    // Escapar HTML
    let sanitized = validator.escape(str);

    // Remover caracteres de control
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    return sanitized;
}

/**
 * Sanitiza recursivamente un objeto
 */
function sanitizeObject(obj) {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
    }

    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    return obj;
}

/**
 * Middleware para sanitizar body, query y params
 */
function sanitizeInput(req, res, next) {
    // Sanitizar body
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }

    // Sanitizar query
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }

    // Sanitizar params
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
    }

    next();
}

/**
 * Validar direcciones Ethereum
 */
function validateEthereumAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validar transaction hash
 */
function validateTxHash(hash) {
    if (!hash || typeof hash !== 'string') return false;
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Validar email
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return validator.isEmail(email);
}

/**
 * Validar URL
 */
function validateUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return validator.isURL(url, {
        protocols: ['http', 'https'],
        require_protocol: true
    });
}

/**
 * Validar cantidad numérica
 */
function validateAmount(amount) {
    if (amount === null || amount === undefined) return false;
    const num = Number(amount);
    return !isNaN(num) && num >= 0 && isFinite(num);
}

/**
 * Limitar longitud de string
 */
function limitLength(str, maxLength = 1000) {
    if (typeof str !== 'string') return str;
    return str.substring(0, maxLength);
}

/**
 * Middleware para validar campos requeridos
 */
function requireFields(fields) {
    return (req, res, next) => {
        const missing = [];

        for (const field of fields) {
            const value = req.body?.[field];
            if (value === undefined || value === null || value === '') {
                missing.push(field);
            }
        }

        if (missing.length > 0) {
            return res.status(400).json({
                error: 'Missing required fields',
                fields: missing
            });
        }

        next();
    };
}

/**
 * Prevenir SQL injection (aunque usamos MongoDB)
 */
function preventSqlInjection(req, res, next) {
    const checkValue = (value) => {
        if (typeof value !== 'string') return false;

        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
            /(;|\-\-|\/\*|\*\/|xp_)/gi,
            /(UNION|OR|AND)\s+\d+\s*=\s*\d+/gi
        ];

        return sqlPatterns.some(pattern => pattern.test(value));
    };

    const checkObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return false;

        for (const value of Object.values(obj)) {
            if (Array.isArray(value)) {
                if (value.some(v => checkValue(v) || checkObject(v))) return true;
            } else if (typeof value === 'object') {
                if (checkObject(value)) return true;
            } else if (checkValue(value)) {
                return true;
            }
        }
        return false;
    };

    if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
        return res.status(400).json({
            error: 'Invalid input detected',
            message: 'Your request contains potentially malicious content'
        });
    }

    next();
}

/**
 * Prevenir NoSQL injection
 */
function preventNoSqlInjection(req, res, next) {
    const checkValue = (value) => {
        if (typeof value !== 'object' || value === null) return false;

        const dangerousKeys = ['$where', '$ne', '$gt', '$lt', '$regex', '$expr'];
        const keys = Object.keys(value);

        return keys.some(key => dangerousKeys.includes(key));
    };

    const checkObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return false;

        if (checkValue(obj)) return true;

        for (const value of Object.values(obj)) {
            if (Array.isArray(value)) {
                if (value.some(v => checkObject(v))) return true;
            } else if (typeof value === 'object') {
                if (checkObject(value)) return true;
            }
        }
        return false;
    };

    if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
        return res.status(400).json({
            error: 'Invalid input detected',
            message: 'Your request contains potentially malicious MongoDB operators'
        });
    }

    next();
}

module.exports = {
    sanitizeInput,
    sanitizeString,
    sanitizeObject,
    validateEthereumAddress,
    validateTxHash,
    validateEmail,
    validateUrl,
    validateAmount,
    limitLength,
    requireFields,
    preventSqlInjection,
    preventNoSqlInjection
};
