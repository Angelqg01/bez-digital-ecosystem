/**
 * ============================================================================
 * SOCKET.IO CONNECTION RATE LIMITER
 * ============================================================================
 * 
 * Protege contra ataques de DoS limitando conexiones por IP
 */

const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

class ConnectionRateLimiter {
    constructor(options = {}) {
        this.maxConnections = options.maxConnections || 10;
        this.windowMs = options.windowMs || 60000; // 1 minuto
        this.connections = new Map(); // IP -> { count, resetAt }
        this.enabled = options.enabled !== false;

        // Cleanup cada minuto
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Middleware para Socket.IO
     */
    middleware() {
        return (socket, next) => {
            if (!this.enabled) {
                return next();
            }

            const ip = this.getIp(socket);

            if (this.isRateLimited(ip)) {
                logger.warn({ ip, socketId: socket.id }, 'Connection rate limit exceeded');
                return next(new Error('Too many connection attempts. Please try again later.'));
            }

            this.recordConnection(ip);
            logger.debug({ ip, socketId: socket.id }, 'Connection allowed');
            next();
        };
    }

    /**
     * Obtener IP real del socket
     */
    getIp(socket) {
        // Orden de prioridad para obtener IP real
        return (
            socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            socket.handshake.headers['x-real-ip'] ||
            socket.handshake.address ||
            socket.conn.remoteAddress ||
            'unknown'
        );
    }

    /**
     * Verificar si la IP está rate limited
     */
    isRateLimited(ip) {
        const now = Date.now();
        const record = this.connections.get(ip);

        if (!record) {
            return false;
        }

        // Si expiró la ventana, permitir
        if (now > record.resetAt) {
            this.connections.delete(ip);
            return false;
        }

        // Verificar si excedió el límite
        return record.count >= this.maxConnections;
    }

    /**
     * Registrar nueva conexión
     */
    recordConnection(ip) {
        const now = Date.now();
        const record = this.connections.get(ip);

        if (!record || now > record.resetAt) {
            // Crear nuevo registro
            this.connections.set(ip, {
                count: 1,
                resetAt: now + this.windowMs
            });
        } else {
            // Incrementar contador existente
            record.count++;
        }

        logger.debug({
            ip,
            count: this.connections.get(ip).count,
            maxConnections: this.maxConnections
        }, 'Connection recorded');
    }

    /**
     * Limpiar registros expirados
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [ip, record] of this.connections.entries()) {
            if (now > record.resetAt) {
                this.connections.delete(ip);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug({ cleaned }, 'Cleaned expired rate limit records');
        }
    }

    /**
     * Obtener estadísticas
     */
    getStats() {
        return {
            totalIps: this.connections.size,
            records: Array.from(this.connections.entries()).map(([ip, record]) => ({
                ip,
                count: record.count,
                resetAt: new Date(record.resetAt).toISOString()
            }))
        };
    }

    /**
     * Resetear límite para una IP (admin)
     */
    reset(ip) {
        const deleted = this.connections.delete(ip);
        if (deleted) {
            logger.info({ ip }, 'Rate limit reset for IP');
        }
        return deleted;
    }

    /**
     * Resetear todos los límites (admin)
     */
    resetAll() {
        const size = this.connections.size;
        this.connections.clear();
        logger.info({ cleared: size }, 'All rate limits reset');
        return size;
    }
}

module.exports = ConnectionRateLimiter;
