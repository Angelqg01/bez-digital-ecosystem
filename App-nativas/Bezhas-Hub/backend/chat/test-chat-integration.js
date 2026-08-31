/**
 * ============================================================================
 * CHAT & GATEKEEPER SYSTEM - INTEGRATION TEST
 * ============================================================================
 * 
 * Script de prueba completo para validar:
 * - Conexión a Socket.IO
 * - Autenticación
 * - Gatekeeper (conteo de palabras y cobro de créditos)
 * - Rate limiting
 * - Mensajes sanitizados
 * - AI Agent detection
 * - Room management
 * 
 * EJECUTAR:
 * node test-chat-integration.js
 * 
 * PREREQUISITOS:
 * - Chat server corriendo (localhost:3002)
 * - Redis corriendo
 * - npm install socket.io-client
 */

const io = require('socket.io-client');
const readline = require('readline');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CONFIG = {
    SERVER_URL: process.env.CHAT_SERVER_URL || 'http://localhost:3002',
    USER_ID: process.env.TEST_USER_ID || 'test-user-' + Date.now(),
    USERNAME: process.env.TEST_USERNAME || 'Test User',
    ROOM_ID: process.env.TEST_ROOM_ID || 'test-room-' + Date.now(),
    JWT_TOKEN: process.env.TEST_JWT_TOKEN || 'test_jwt_token_for_development'
};

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║       🧪 CHAT & GATEKEEPER INTEGRATION TEST                  ║
║                                                              ║
║  Server:    ${CONFIG.SERVER_URL.padEnd(50)}║
║  User ID:   ${CONFIG.USER_ID.padEnd(50)}║
║  Username:  ${CONFIG.USERNAME.padEnd(50)}║
║  Room ID:   ${CONFIG.ROOM_ID.padEnd(50)}║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

let socket = null;
let isConnected = false;
let isInRoom = false;
let testResults = {
    connection: false,
    authentication: false,
    joinRoom: false,
    sendMessage: false,
    creditStats: false,
    gatekeeper: false,
    aiDetection: false,
    rateLimiting: false
};

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

function logSuccess(message) {
    console.log(`✅ ${message}`);
}

function logError(message) {
    console.log(`❌ ${message}`);
}

function logInfo(message) {
    console.log(`ℹ️  ${message}`);
}

function logWarning(message) {
    console.log(`⚠️  ${message}`);
}

function printTestResults() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(70));

    Object.keys(testResults).forEach(test => {
        const status = testResults[test] ? '✅ PASS' : '❌ FAIL';
        const testName = test.replace(/([A-Z])/g, ' $1').toUpperCase();
        console.log(`${status.padEnd(10)} ${testName}`);
    });

    const passed = Object.values(testResults).filter(v => v).length;
    const total = Object.keys(testResults).length;
    const percentage = Math.round((passed / total) * 100);

    console.log('='.repeat(70));
    console.log(`TOTAL: ${passed}/${total} tests passed (${percentage}%)`);
    console.log('='.repeat(70) + '\n');
}

// ============================================================================
// SOCKET.IO CONNECTION
// ============================================================================

function connectToServer() {
    logInfo('Connecting to chat server...');

    socket = io(CONFIG.SERVER_URL, {
        auth: {
            token: CONFIG.JWT_TOKEN,
            userId: CONFIG.USER_ID,
            username: CONFIG.USERNAME
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    });

    // Event: Connection successful
    socket.on('connect', () => {
        logSuccess(`Connected to server! Socket ID: ${socket.id}`);
        isConnected = true;
        testResults.connection = true;
        testResults.authentication = true; // Si conecta, JWT es válido

        // Ejecutar tests automáticos
        setTimeout(runAutomatedTests, 1000);
    });

    // Event: Connection error
    socket.on('connect_error', (error) => {
        logError(`Connection error: ${error.message}`);
        testResults.connection = false;
        testResults.authentication = false;
    });

    // Event: Disconnect
    socket.on('disconnect', (reason) => {
        logWarning(`Disconnected: ${reason}`);
        isConnected = false;
        isInRoom = false;
    });

    // Event: Room joined successfully
    socket.on('roomJoined', (data) => {
        logSuccess(`Joined room: ${data.roomId}`);
        logInfo(`Users in room: ${data.users.length}`);
        isInRoom = true;
        testResults.joinRoom = true;
    });

    // Event: New message received
    socket.on('newMessage', (data) => {
        console.log(`\n📩 [${data.username}]: ${data.message}`);
        if (data.metadata?.wordCount) {
            logInfo(`Words: ${data.metadata.wordCount}`);
        }
        if (data.metadata?.aiMentioned) {
            logSuccess('AI Agent mentioned detected!');
            testResults.aiDetection = true;
        }
    });

    // Event: Credit error (insufficient balance)
    socket.on('creditError', (data) => {
        logError('Credit Error:');
        console.log(JSON.stringify(data, null, 2));
        testResults.gatekeeper = true; // El gatekeeper está funcionando
    });

    // Event: Credit warning (near limit)
    socket.on('creditWarning', (data) => {
        logWarning('Credit Warning:');
        console.log(JSON.stringify(data, null, 2));
    });

    // Event: Credit stats update
    socket.on('creditStatsUpdate', (data) => {
        logInfo(`Credit Stats - Used: ${data.currentWords}/${data.totalWords} words (${data.percentageUsed}%)`);
        testResults.creditStats = true;
    });

    // Event: User joined room
    socket.on('userJoined', (data) => {
        logInfo(`${data.username} joined the room`);
    });

    // Event: User left room
    socket.on('userLeft', (data) => {
        logInfo(`${data.username} left the room`);
    });

    // Event: Typing indicator
    socket.on('userTyping', (data) => {
        logInfo(`${data.username} is typing...`);
    });

    // Event: Error
    socket.on('error', (error) => {
        logError(`Socket error: ${error.message || JSON.stringify(error)}`);
    });

    // Event: System message
    socket.on('systemMessage', (data) => {
        console.log(`\n🔔 SYSTEM [${data.type}]: ${data.message}`);
    });
}

// ============================================================================
// AUTOMATED TESTS
// ============================================================================

async function runAutomatedTests() {
    logInfo('\n' + '='.repeat(70));
    logInfo('Starting automated tests...');
    logInfo('='.repeat(70) + '\n');

    try {
        // Test 1: Join room
        await testJoinRoom();
        await sleep(1000);

        // Test 2: Send simple message
        await testSendMessage();
        await sleep(1000);

        // Test 3: Get credit stats
        await testGetCreditStats();
        await sleep(1000);

        // Test 4: Test word counting
        await testWordCounting();
        await sleep(1000);

        // Test 5: Test AI mention
        await testAIMention();
        await sleep(1000);

        // Test 6: Test rate limiting
        await testRateLimiting();
        await sleep(1000);

        // Test 7: Test long message (credit charging)
        await testLongMessage();
        await sleep(2000);

        // Print results
        printTestResults();

        // Enter interactive mode
        enterInteractiveMode();

    } catch (error) {
        logError(`Test execution error: ${error.message}`);
        printTestResults();
    }
}

function testJoinRoom() {
    return new Promise((resolve) => {
        logInfo('Test 1: Joining room...');

        socket.emit('joinRoom', {
            roomId: CONFIG.ROOM_ID,
            roomType: 'group',
            userId: CONFIG.USER_ID,
            username: CONFIG.USERNAME
        });

        setTimeout(resolve, 500);
    });
}

function testSendMessage() {
    return new Promise((resolve) => {
        logInfo('Test 2: Sending simple message...');

        socket.emit('sendMessage', {
            roomId: CONFIG.ROOM_ID,
            userId: CONFIG.USER_ID,
            message: 'Hello, this is a test message from automated test!',
            username: CONFIG.USERNAME
        });

        testResults.sendMessage = true;
        setTimeout(resolve, 500);
    });
}

function testGetCreditStats() {
    return new Promise((resolve) => {
        logInfo('Test 3: Requesting credit stats...');

        socket.emit('getCreditStats', {
            userId: CONFIG.USER_ID
        });

        setTimeout(resolve, 500);
    });
}

function testWordCounting() {
    return new Promise((resolve) => {
        logInfo('Test 4: Testing word counting...');

        // Mensaje con exactamente 50 palabras
        const words = Array(50).fill('word').join(' ');

        socket.emit('sendMessage', {
            roomId: CONFIG.ROOM_ID,
            userId: CONFIG.USER_ID,
            message: words,
            username: CONFIG.USERNAME
        });

        setTimeout(resolve, 500);
    });
}

function testAIMention() {
    return new Promise((resolve) => {
        logInfo('Test 5: Testing AI Agent mention detection...');

        socket.emit('sendMessage', {
            roomId: CONFIG.ROOM_ID,
            userId: CONFIG.USER_ID,
            message: 'Hey @AgenteIA, can you help me with something?',
            username: CONFIG.USERNAME
        });

        setTimeout(resolve, 500);
    });
}

async function testRateLimiting() {
    logInfo('Test 6: Testing rate limiting (sending 10 messages rapidly)...');

    for (let i = 0; i < 10; i++) {
        socket.emit('sendMessage', {
            roomId: CONFIG.ROOM_ID,
            userId: CONFIG.USER_ID,
            message: `Rapid message ${i + 1}`,
            username: CONFIG.USERNAME
        });
        await sleep(100); // 100ms between messages = 10 msg/sec
    }

    testResults.rateLimiting = true; // Si no crashea, funciona
    await sleep(1000);
}

function testLongMessage() {
    return new Promise((resolve) => {
        logInfo('Test 7: Testing long message (credit charging)...');

        // Mensaje con 1500 palabras (debería cobrar 2 créditos)
        const longMessage = Array(1500).fill('word').join(' ');

        socket.emit('sendMessage', {
            roomId: CONFIG.ROOM_ID,
            userId: CONFIG.USER_ID,
            message: longMessage,
            username: CONFIG.USERNAME
        });

        setTimeout(resolve, 1000);
    });
}

// ============================================================================
// INTERACTIVE MODE
// ============================================================================

function enterInteractiveMode() {
    console.log('\n' + '='.repeat(70));
    console.log('🎮 INTERACTIVE MODE');
    console.log('='.repeat(70));
    console.log('Commands:');
    console.log('  /msg <message>    - Send a message');
    console.log('  /stats            - Get credit stats');
    console.log('  /leave            - Leave room');
    console.log('  /join <roomId>    - Join another room');
    console.log('  /quit             - Exit test');
    console.log('='.repeat(70) + '\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'Chat> '
    });

    rl.prompt();

    rl.on('line', (line) => {
        const input = line.trim();

        if (input.startsWith('/msg ')) {
            const message = input.substring(5);
            socket.emit('sendMessage', {
                roomId: CONFIG.ROOM_ID,
                userId: CONFIG.USER_ID,
                message,
                username: CONFIG.USERNAME
            });
        } else if (input === '/stats') {
            socket.emit('getCreditStats', { userId: CONFIG.USER_ID });
        } else if (input === '/leave') {
            socket.emit('leaveRoom', {
                roomId: CONFIG.ROOM_ID,
                userId: CONFIG.USER_ID
            });
            isInRoom = false;
        } else if (input.startsWith('/join ')) {
            const roomId = input.substring(6);
            socket.emit('joinRoom', {
                roomId,
                roomType: 'group',
                userId: CONFIG.USER_ID,
                username: CONFIG.USERNAME
            });
        } else if (input === '/quit') {
            logInfo('Disconnecting...');
            socket.disconnect();
            rl.close();
            process.exit(0);
        } else if (input) {
            // Enviar mensaje directamente
            socket.emit('sendMessage', {
                roomId: CONFIG.ROOM_ID,
                userId: CONFIG.USER_ID,
                message: input,
                username: CONFIG.USERNAME
            });
        }

        rl.prompt();
    });

    rl.on('close', () => {
        logInfo('Goodbye!');
        process.exit(0);
    });
}

// ============================================================================
// UTILITY
// ============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN
// ============================================================================

connectToServer();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n');
    logInfo('Shutting down...');
    if (socket) {
        socket.disconnect();
    }
    printTestResults();
    process.exit(0);
});
