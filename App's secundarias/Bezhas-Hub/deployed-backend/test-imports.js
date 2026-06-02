console.log('Step 1: Starting...');

console.log('Step 2: Loading express...');
const express = require('express');
console.log('✅ express loaded');

console.log('Step 3: Loading config...');
const config = require('./config');
console.log('✅ config loaded');

console.log('Step 4: Loading GoogleGenerativeAI...');
const { GoogleGenerativeAI } = require('@google/generative-ai');
console.log('✅ GoogleGenerativeAI loaded');

console.log('Step 5: Loading websocket-server...');
const { WebSocketServer } = require('./websocket-server');
console.log('✅ WebSocketServer loaded');

console.log('✅ All imports successful!');
process.exit(0);
