console.log('Start');
try {
    const config = require('./config');
    console.log('Config loaded successfully');
} catch (e) {
    console.error('Error loading config:', e);
}
console.log('End');
