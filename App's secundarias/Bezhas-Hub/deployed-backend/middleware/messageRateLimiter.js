/**
 * ============================================================================
 * MESSAGE RATE LIMITER - Per-user Chat Message Limiting
 * ============================================================================
 * 
 * Rate limiting específico para mensajes de chat con:
 * - Límite por usuario (5 msg/sec)
 * - Límite por modelo de AI (consumo de créditos)
 * - Burst allowance (permite ráfagas cortas)
 * - Penalties por spam
 */

const Redis = require('ioredis');
const { audit } = require('./auditLogger');
const { notifyPenalty, notifySuspiciousActivity } = require('./discordNotifier');

class MessageRateLimiter {
    constructor(options = {}) {
        this.useMemory = false;
        this.memoryStore = new Map();

        try {
            // Use REDIS_URL if available (Upstash, cloud Redis)
            if (options.redis) {
                this.redis = options.redis;
            } else if (process.env.REDIS_URL) {
                const redisUrl = process.env.REDIS_URL;
                const connectionOptions = {
                    lazyConnect: true,
                    connectTimeout: 5000,
                    maxRetriesPerRequest: 1,
                    family: 0,
                    retryStrategy: (times) => {
                        if (times > 3) {
                            console.warn('⚠️ Redis connection failed too many times (MessageLimiter). Switching to memory mode.');
                            this.useMemory = true;
                            return null;
                        }
                        return Math.min(times * 50, 2000);
                    }
                };

                // Enable TLS for rediss:// protocol
                if (redisUrl.startsWith('rediss://')) {
                    connectionOptions.tls = { rejectUnauthorized: false };
                }

                this.redis = new Redis(redisUrl, connectionOptions);
            } else {
                this.redis = new Redis({
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379,
                    password: process.env.REDIS_PASSWORD || undefined,
                    db: process.env.REDIS_DB || 0,
                    lazyConnect: true,
                    connectTimeout: 3000,
                    maxRetriesPerRequest: 1,
                    retryStrategy: (times) => {
                        if (times > 3) {
                            console.warn('⚠️ Redis connection failed too many times (MessageLimiter). Switching to memory mode.');
                            this.useMemory = true;
                            return null;
                        }
                        return Math.min(times * 50, 2000);
                    }
                });
            }

            this.redis.on('error', (err) => {
                if (!this.useMemory) {
                    console.warn('⚠️ Redis error in MessageLimiter (switching to memory):', err.message);
                    this.useMemory = true;
                }
            });

            // Attempt to connect non-blocking
            if (!options.redis) {
                this.redis.connect().catch(err => {
                    console.warn('⚠️ Could not connect to Redis for MessageLimiter. Using memory mode.');
                    this.useMemory = true;
                });
            }
        } catch (error) {
            console.warn('⚠️ Failed to initialize Redis for MessageLimiter. Using memory mode.');
            this.useMemory = true;
        }

        this.config = {
            // Límite base: 5 mensajes por segundo
            baseLimit: options.baseLimit || 5,
            baseWindow: options.baseWindow || 1000, // 1 segundo

            // Límite de ráfaga: 15 mensajes en 10 segundos
            burstLimit: options.burstLimit || 15,
            burstWindow: options.burstWindow || 10000, // 10 segundos

            // Límite por hora: 500 mensajes
            hourlyLimit: options.hourlyLimit || 500,
            hourlyWindow: 3600000, // 1 hora

            // Límites por modelo (créditos por minuto)
            modelLimits: {
                'gpt-4': {
                    creditsPerMinute: 50,
                    cooldown: 60000 // 1 minuto
                },
                'gpt-3.5-turbo': {
                    creditsPerMinute: 100,
                    cooldown: 30000 // 30 segundos
                },
                'claude-3-opus': {
                    creditsPerMinute: 40,
                    cooldown: 60000
                },
                'claude-3-sonnet': {
                    creditsPerMinute: 80,
                    cooldown: 30000
                },
                'gemini-pro': {
                    creditsPerMinute: 100,
                    cooldown: 30000
                }
            },

            // Sistema de penalización
            penalties: {
                enabled: options.penalties !== false,
                threshold: 10,        // 10 violaciones
                penaltyDuration: 300000, // 5 minutos bloqueado
                maxPenalties: 3       // Después de 3 penalties, ban temporal
            },

            keyPrefix: options.keyPrefix || 'msglimit:',
            enabled: options.enabled !== false
        };

        this.redis.on('error', (err) => {
            console.error('Redis Message Limiter Error:', err);
        });
    }

    /**
     * Verificar si un usuario puede enviar un mensaje
     */
    async canSendMessage(userId, modelName = 'default', creditsUsed = 1) {
        if (!this.config.enabled) {
            return { allowed: true };
        }

        try {
            // 1. Verificar si está penalizado
            const penaltyCheck = await this.checkPenalty(userId);
            if (!penaltyCheck.allowed) {
                return penaltyCheck;
            }

            // 2. Verificar límite base (mensajes por segundo)
            const baseCheck = await this.checkBaseLimit(userId);
            if (!baseCheck.allowed) {
                await this.recordViolation(userId, 'base');
                return baseCheck;
            }

            // 3. Verificar límite de ráfaga
            const burstCheck = await this.checkBurstLimit(userId);
            if (!burstCheck.allowed) {
                await this.recordViolation(userId, 'burst');
                return burstCheck;
            }

            // 4. Verificar límite por hora
            const hourlyCheck = await this.checkHourlyLimit(userId);
            if (!hourlyCheck.allowed) {
                await this.recordViolation(userId, 'hourly');
                return hourlyCheck;
            }

            // 5. Verificar límite por modelo (créditos)
            if (modelName !== 'default') {
                const modelCheck = await this.checkModelLimit(userId, modelName, creditsUsed);
                if (!modelCheck.allowed) {
                    await this.recordViolation(userId, 'model');
                    return modelCheck;
                }
            }

            // Registrar mensaje exitoso
            await this.recordMessage(userId, modelName, creditsUsed);

            return {
                allowed: true,
                remaining: await this.getRemainingMessages(userId)
            };

        } catch (error) {
            console.error('Error checking message rate limit:', error);
            // En caso de error, permitir el mensaje
            return { allowed: true };
        }
    }

    /**
     * Verificar límite base (5 msg/sec)
     */
    async checkBaseLimit(userId) {
        const key = `${this.config.keyPrefix}base:${userId}`;
        const now = Date.now();
        const windowStart = now - this.config.baseWindow;

        try {
            let count;

            if (this.useMemory) {
                if (!this.memoryStore.has(key)) {
                    this.memoryStore.set(key, []);
                }
                const requests = this.memoryStore.get(key);
                const validRequests = requests.filter(time => time > windowStart);
                validRequests.push(now);
                this.memoryStore.set(key, validRequests);

                count = validRequests.length;

                // Limpieza periódica
                if (this.memoryStore.size > 10000) {
                    this.memoryStore.clear();
                }
            } else {
                await this.redis.zadd(key, now, `${now}-${Math.random()}`);
                await this.redis.zremrangebyscore(key, 0, windowStart);
                await this.redis.expire(key, 2);
                count = await this.redis.zcard(key);
            }

            if (count > this.config.baseLimit) {
                return {
                    allowed: false,
                    reason: 'base_limit',
                    message: 'Estás enviando mensajes demasiado rápido. Espera 1 segundo.',
                    retryAfter: 1
                };
            }

            return { allowed: true };
        } catch (error) {
            console.error('Error checking base limit:', error);
            return { allowed: true };
        }
    }

    /**
     * Verificar límite de ráfaga (15 msg/10sec)
     */
    async checkBurstLimit(userId) {
        const key = `${this.config.keyPrefix}burst:${userId}`;
        const now = Date.now();
        const windowStart = now - this.config.burstWindow;

        try {
            let count;

            if (this.useMemory) {
                if (!this.memoryStore.has(key)) {
                    this.memoryStore.set(key, []);
                }
                const requests = this.memoryStore.get(key);
                const validRequests = requests.filter(time => time > windowStart);
                validRequests.push(now);
                this.memoryStore.set(key, validRequests);
                count = validRequests.length;
            } else {
                await this.redis.zadd(key, now, `${now}-${Math.random()}`);
                await this.redis.zremrangebyscore(key, 0, windowStart);
                await this.redis.expire(key, 15);
                count = await this.redis.zcard(key);
            }

            if (count > this.config.burstLimit) {
                return {
                    allowed: false,
                    reason: 'burst_limit',
                    message: 'Demasiados mensajes en un período corto. Espera 10 segundos.',
                    retryAfter: 10
                };
            }

            return { allowed: true };
        } catch (error) {
            console.error('Error checking burst limit:', error);
            return { allowed: true };
        }
    }

    /**
     * Verificar límite por hora (500 msg/hour)
     */
    async checkHourlyLimit(userId) {
        const key = `${this.config.keyPrefix}hourly:${userId}`;
        const now = Date.now();
        const windowStart = now - this.config.hourlyWindow;

        try {
            let count;

            if (this.useMemory) {
                if (!this.memoryStore.has(key)) {
                    this.memoryStore.set(key, []);
                }
                const requests = this.memoryStore.get(key);
                const validRequests = requests.filter(time => time > windowStart);
                validRequests.push(now);
                this.memoryStore.set(key, validRequests);
                count = validRequests.length;
            } else {
                await this.redis.zadd(key, now, `${now}-${Math.random()}`);
                await this.redis.zremrangebyscore(key, 0, windowStart);
                await this.redis.expire(key, 3700);
                count = await this.redis.zcard(key);
            }

            if (count > this.config.hourlyLimit) {
                return {
                    allowed: false,
                    reason: 'hourly_limit',
                    message: 'Has alcanzado tu límite de mensajes por hora (500). Espera un momento.',
                    retryAfter: 3600
                };
            }

            return { allowed: true };
        } catch (error) {
            console.error('Error checking hourly limit:', error);
            return { allowed: true };
        }
    }

    /**
     * Verificar límite por modelo (créditos por minuto)
     */
    async checkModelLimit(userId, modelName, creditsUsed) {
        const modelConfig = this.config.modelLimits[modelName];
        if (!modelConfig) {
            return { allowed: true }; // Sin límite para modelos no configurados
        }

        const key = `${this.config.keyPrefix}model:${modelName}:${userId}`;
        const now = Date.now();
        const windowStart = now - 60000; // 1 minuto

        // Obtener créditos usados en el último minuto
        const entries = await this.redis.zrangebyscore(key, windowStart, now);
        const totalCredits = entries.reduce((sum, entry) => {
            const credits = parseFloat(entry.split(':')[1]) || 0;
            return sum + credits;
        }, 0);

        if (totalCredits + creditsUsed > modelConfig.creditsPerMinute) {
            return {
                allowed: false,
                reason: 'model_limit',
                message: `Límite de créditos para ${modelName} alcanzado. Espera ${Math.ceil(modelConfig.cooldown / 1000)} segundos.`,
                retryAfter: Math.ceil(modelConfig.cooldown / 1000)
            };
        }

        return { allowed: true };
    }

    /**
     * Verificar si el usuario está penalizado
     */
    async checkPenalty(userId) {
        if (!this.config.penalties.enabled) {
            return { allowed: true };
        }

        const key = `${this.config.keyPrefix}penalty:${userId}`;
        const penaltyEnd = await this.redis.get(key);

        if (penaltyEnd) {
            const remaining = parseInt(penaltyEnd) - Date.now();
            if (remaining > 0) {
                return {
                    allowed: false,
                    reason: 'penalty',
                    message: 'Has sido penalizado por spam. Espera antes de enviar más mensajes.',
                    retryAfter: Math.ceil(remaining / 1000)
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Registrar mensaje exitoso
     */
    async recordMessage(userId, modelName, creditsUsed) {
        const now = Date.now();

        // Registrar en límite de modelo si aplica
        if (modelName !== 'default' && this.config.modelLimits[modelName]) {
            const key = `${this.config.keyPrefix}model:${modelName}:${userId}`;
            await this.redis.zadd(key, now, `${now}:${creditsUsed}`);
            await this.redis.expire(key, 120);
        }
    }

    /**
     * Registrar violación de límite
     */
    async recordViolation(userId, type) {
        if (!this.config.penalties.enabled) return;

        const key = `${this.config.keyPrefix}violations:${userId}`;
        const now = Date.now();

        await this.redis.zadd(key, now, `${now}-${type}`);
        await this.redis.zremrangebyscore(key, 0, now - 3600000); // Limpiar violaciones > 1 hora
        await this.redis.expire(key, 3700);

        const count = await this.redis.zcard(key);

        // Si alcanza el threshold, aplicar penalización
        if (count >= this.config.penalties.threshold) {
            await this.applyPenalty(userId);

            audit.security('SPAM_PENALTY_APPLIED', 'high', {
                userId,
                violations: count,
                type,
                duration: this.config.penalties.penaltyDuration
            });

            // Notificar actividad sospechosa
            notifySuspiciousActivity(userId, 'SPAM_THRESHOLD_REACHED', {
                violations: count,
                threshold: this.config.penalties.threshold,
                violationType: type
            }).catch(err => console.error('Discord notification error:', err.message));
        }
    }

    /**
     * Aplicar penalización
     */
    async applyPenalty(userId) {
        const key = `${this.config.keyPrefix}penalty:${userId}`;
        const penaltyEnd = Date.now() + this.config.penalties.penaltyDuration;

        await this.redis.set(key, penaltyEnd, 'PX', this.config.penalties.penaltyDuration);

        // Limpiar violaciones después de aplicar penalty
        const violationsKey = `${this.config.keyPrefix}violations:${userId}`;
        await this.redis.del(violationsKey);

        // Notificar a Discord
        notifyPenalty(userId, 'SPAM_VIOLATION', Math.ceil(this.config.penalties.penaltyDuration / 1000))
            .catch(err => console.error('Discord notification error:', err.message));
    }

    /**
     * Obtener mensajes restantes
     */
    async getRemainingMessages(userId) {
        const now = Date.now();

        // Restante en base limit
        const baseKey = `${this.config.keyPrefix}base:${userId}`;
        const baseCount = await this.redis.zcard(baseKey);
        const baseRemaining = Math.max(0, this.config.baseLimit - baseCount);

        // Restante en hourly limit
        const hourlyKey = `${this.config.keyPrefix}hourly:${userId}`;
        const hourlyCount = await this.redis.zcard(hourlyKey);
        const hourlyRemaining = Math.max(0, this.config.hourlyLimit - hourlyCount);

        return {
            base: baseRemaining,
            hourly: hourlyRemaining
        };
    }

    /**
     * Resetear límites de un usuario (admin)
     */
    async resetUserLimits(userId, adminId) {
        const pattern = `${this.config.keyPrefix}*:${userId}`;
        const keys = await this.redis.keys(pattern);

        if (keys.length > 0) {
            await this.redis.del(...keys);
        }

        audit.admin('RATE_LIMIT_RESET', adminId, userId, {
            keysDeleted: keys.length
        });

        return keys.length;
    }

    /**
     * Obtener estadísticas de usuario
     */
    async getUserStats(userId) {
        const now = Date.now();

        const stats = {
            lastHour: 0,
            violations: 0,
            isPenalized: false,
            models: {}
        };

        // Mensajes última hora
        const hourlyKey = `${this.config.keyPrefix}hourly:${userId}`;
        stats.lastHour = await this.redis.zcard(hourlyKey);

        // Violaciones
        const violationsKey = `${this.config.keyPrefix}violations:${userId}`;
        stats.violations = await this.redis.zcard(violationsKey);

        // Penalización activa
        const penaltyKey = `${this.config.keyPrefix}penalty:${userId}`;
        const penaltyEnd = await this.redis.get(penaltyKey);
        stats.isPenalized = penaltyEnd && parseInt(penaltyEnd) > now;

        // Créditos por modelo
        for (const modelName of Object.keys(this.config.modelLimits)) {
            const key = `${this.config.keyPrefix}model:${modelName}:${userId}`;
            const entries = await this.redis.zrangebyscore(key, now - 60000, now);
            const credits = entries.reduce((sum, entry) => {
                const c = parseFloat(entry.split(':')[1]) || 0;
                return sum + c;
            }, 0);
            stats.models[modelName] = credits;
        }

        return stats;
    }

    /**
     * Cerrar conexión Redis
     */
    async disconnect() {
        await this.redis.quit();
    }
}

module.exports = MessageRateLimiter;
