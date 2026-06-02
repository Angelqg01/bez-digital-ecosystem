/**
 * BEZPAY v2.0 - DEMO TEST SCRIPT
 * This script demonstrates how the unified payment system works
 * without requiring a full integration test environment.
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m'
};

// 1. MOCK MODELS (to avoid DB connection issues)
const mockModel = (name) => {
  console.log(`${colors.magenta}[MOCK] Initializing mock for ${name} model${colors.reset}`);
  function Mock() {
    this.save = async () => {
      // console.log(`${colors.magenta}[MOCK] ${name}.save() called${colors.reset}`);
      return this;
    };
  }
  Mock.findOneAndUpdate = async () => {
    // console.log(`${colors.magenta}[MOCK] ${name}.findOneAndUpdate() called${colors.reset}`);
    return {};
  };
  Mock.findOne = async () => {
    // console.log(`${colors.magenta}[MOCK] ${name}.findOne() called${colors.reset}`);
    return { _id: 'mock-user-id', walletAddress: '0x123...', save: async () => {} };
  };
  Mock.findById = async () => ({ _id: 'mock-user-id', walletAddress: '0x123...', save: async () => {} });
  return Mock;
};

// Override require for models
const originalRequire = require;
const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  if (request.includes('../models/Payment.model')) return mockModel('Payment');
  if (request.includes('../models/user.model')) return mockModel('User');
  if (request.includes('../models/FarmingDeposit.model')) return mockModel('FarmingDeposit');
  return originalLoad.apply(this, arguments);
};

// 2. LOAD SERVICE
const bezpay = require('../services/bezpay.service');

// 3. SIMULATE RESPONSE OBJECT
const createMockRes = (resolve) => ({
  status: (code) => {
    // console.log(`${colors.yellow}Response Status: ${code}${colors.reset}`);
    return createMockRes(resolve);
  },
  json: (data) => {
    resolve(data);
    return createMockRes(resolve);
  }
});

// 4. TEST FLOWS
async function runDemo() {
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}  💳 BEZPAY v2.0 - SISTEMA DE PAGOS UNIFICADO${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);

  // --- ESCENARIO 1: COMPRA DE BEZ CON USDT ---
  console.log(`\n${colors.bright}${colors.blue}ESCENARIO 1: Compra de BEZ con USDT (100 USD)${colors.reset}`);
  
  const req1 = {
    body: {
      payToken: 'USDT',
      amountUSD: 100,
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
      type: 'buy_bez'
    }
  };
  
  const res1 = await new Promise(resolve => bezpay.createPayment(req1, createMockRes(resolve)));
  
  if (res1.success) {
    console.log(`${colors.green}✓ Pago de Crypto Creado:${colors.reset}`);
    console.log(`  - ID Pago:      ${colors.bright}${res1.paymentId}${colors.reset}`);
    console.log(`  - Enviar:       ${colors.bright}${res1.amountToSend} ${req1.body.payToken}${colors.reset}`);
    console.log(`  - Recibirás:    ${colors.bright}${res1.bezAmount} BEZ${colors.reset}`);
    console.log(`  - Destino:      ${res1.paymentAddress}`);
  }

  // --- ESCENARIO 2: SUSCRIPCIÓN VIP (PLAN CREATOR) ---
  console.log(`\n${colors.bright}${colors.blue}ESCENARIO 2: Suscripción VIP (Plan Creator)${colors.reset}`);
  
  const req2 = {
    body: {
      payToken: 'USDC',
      type: 'subscription',
      planId: 'creator',
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4'
    }
  };
  
  const res2 = await new Promise(resolve => bezpay.createPayment(req2, createMockRes(resolve)));
  
  if (res2.success) {
    console.log(`${colors.green}✓ Suscripción Creada:${colors.reset}`);
    console.log(`  - ID Pago:      ${colors.bright}${res2.paymentId}${colors.reset}`);
    console.log(`  - Enviar:       ${colors.bright}${res2.amountToSend} ${req2.body.payToken}${colors.reset}`);
    console.log(`  - Precio Plan:  $${res2.amountUSD}`);
    console.log(`  - BEZ Locked:   ${res2.bezAmount} BEZ`);
  }

  // --- ESCENARIO 3: PAGO POR TRANSFERENCIA BANCARIA (IBAN) ---
  console.log(`\n${colors.bright}${colors.blue}ESCENARIO 3: Pago por Transferencia Bancaria (EUR)${colors.reset}`);
  
  const req3 = {
    body: {
      payToken: 'EUR',
      amountUSD: 50,
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4'
    }
  };
  
  const res3 = await new Promise(resolve => bezpay.createPayment(req3, createMockRes(resolve)));
  
  if (res3.success && res3.fiat) {
    console.log(`${colors.green}✓ Transferencia Bancaria Generada:${colors.reset}`);
    console.log(`  - ID Pago:      ${colors.bright}${res3.paymentId}${colors.reset}`);
    console.log(`  - Monto:        ${colors.bright}${res3.amount} ${res3.currency}${colors.reset}`);
    console.log(`  - IBAN:         ${res3.bankDetails.iban}`);
    console.log(`  - Concepto:     ${colors.bright}${res3.refCode}${colors.reset}`);
    console.log(`  - Beneficiario: ${res3.bankDetails.beneficiary}`);
  }

  // --- ESCENARIO 4: WEBHOOK DE CONFIRMACIÓN (SIMULADO) ---
  console.log(`\n${colors.bright}${colors.magenta}SIMULANDO WEBHOOK DE CONFIRMACIÓN ON-CHAIN...${colors.reset}`);
  
  const req4 = {
    body: {
      type: 'buy_bez',
      paymentId: res1.paymentId,
      txHash: '0x9957778931234567890abcdef1234567890abcdef1234567890abcdef123456',
      walletAddress: req1.body.walletAddress,
      payToken: 'USDT',
      amountUSD: 100
    }
  };
  
  // Note: handleWebhook is async and calls setImmediate internally in the service
  // so we just call it to see the logs if they were piped.
  console.log(`${colors.yellow}Enviando webhook por ${req4.body.paymentId}...${colors.reset}`);
  const res4 = await new Promise(resolve => bezpay.handleWebhook(req4, createMockRes(resolve)));
  
  console.log(`${colors.green}✓ Webhook procesado exitosamente.${colors.reset}`);
  console.log(`${colors.gray}Nota: El balance de tokens se dispensa automáticamente desde el Hot Wallet.${colors.reset}`);

  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}  ANÁLISIS DE FLUJO:${colors.reset}`);
  console.log(`${colors.gray}  1. El usuario elige método en BezPayModal.jsx${colors.reset}`);
  console.log(`${colors.gray}  2. Se llama a /api/payment/create para registrar${colors.reset}`);
  console.log(`${colors.gray}  3. El usuario paga on-chain o via Stripe/Banco${colors.reset}`);
  console.log(`${colors.gray}  4. El backend recibe confirmación y entrega tokens/VIP${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  process.exit(0);
}

runDemo().catch(err => {
  console.error(`${colors.red}Error en la demo:${colors.reset}`, err);
  process.exit(1);
});
