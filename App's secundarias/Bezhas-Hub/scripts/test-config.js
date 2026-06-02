console.log('Testing config load...');
try {
    const config = require('../backend/config');
    console.log('Config loaded:', config);
} catch (e) {
    console.error('Error loading config:', e);
}
