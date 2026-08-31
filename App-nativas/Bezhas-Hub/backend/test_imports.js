
try {
    console.log('Test 1');
    const express = require('express');
    console.log('Test 2');
    const fs = require('fs').promises;
    console.log('Test 3');
    const path = require('path');
    console.log('Test 4');
    const cors = require('cors');
    console.log('Test 5');
    const rateLimit = require('express-rate-limit');
    console.log('Test 6');
    const helmet = require('helmet');
    console.log('Test 7');
    const validator = require('validator');
    console.log('Test 8');
    const http = require('http');
    console.log('Test 9');
    const { ethers } = require('ethers');
    console.log('Test 10');
    const jwt = require('jsonwebtoken');
    console.log('Test 11');
    const User = require('./models/user.model');
    console.log('Test 12');
    const config = require('./config');
    console.log('Test 13');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    console.log('Test 14');
    const { WebSocketServer } = require('./websocket-server');
    console.log('Test 15');
    const pino = require('pino');
    console.log('Test 16');
    const { z } = require('zod');
    console.log('Test 17');
    const { v4: uuidv4 } = require('uuid');
    console.log('✅ All imports passed');
} catch (e) {
    console.error('❌ Import failed:', e);
}
