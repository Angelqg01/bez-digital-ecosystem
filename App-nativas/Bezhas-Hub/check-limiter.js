const rateLimiter = require('./backend/middleware/intelligentRateLimiter');
console.log('rateLimiter:', rateLimiter);
console.log('rateLimiter.read type:', typeof rateLimiter.read);
try {
    const middleware = rateLimiter.read();
    console.log('middleware created successfully');
} catch (error) {
    console.error('Error creating middleware:', error);
}
