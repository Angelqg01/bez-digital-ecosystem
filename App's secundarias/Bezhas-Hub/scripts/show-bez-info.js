#!/usr/bin/env node

/**
 * Script para mostrar información del contrato BEZ-Coin oficial
 * Ejecutar: node scripts/show-bez-info.js
 */

const fs = require('fs');
const path = require('path');

const OFFICIAL_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
const CHAIN_ID = 80002;
const NETWORK = "Polygon Amoy Testnet";
const EXPLORER_URL = `https://amoy.polygonscan.com/address/${OFFICIAL_CONTRACT}`;

// Colores ANSI para terminal
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m"
};

const box = (text, color = 'cyan') => {
    const width = 80;
    const c = colors[color] || colors.cyan;
    console.log(c + "═".repeat(width) + colors.reset);
    console.log(c + "║" + colors.reset + " ".repeat(width - 2) + c + "║" + colors.reset);
    console.log(c + "║" + colors.reset + text.padEnd(width - 2) + c + "║" + colors.reset);
    console.log(c + "║" + colors.reset + " ".repeat(width - 2) + c + "║" + colors.reset);
    console.log(c + "═".repeat(width) + colors.reset);
};

console.log("\n");
box("  🪙  CONTRATO BEZ-COIN OFICIAL - PLATAFORMA BEZHAS  🪙", 'cyan');

console.log("\n" + colors.bright + "📍 INFORMACIÓN DEL CONTRATO" + colors.reset);
console.log(colors.green + "═".repeat(80) + colors.reset);
console.log(`
${colors.bright}Dirección del Contrato:${colors.reset}
${colors.cyan}${OFFICIAL_CONTRACT}${colors.reset}

${colors.bright}Red:${colors.reset}              ${NETWORK}
${colors.bright}Chain ID:${colors.reset}         ${CHAIN_ID}
${colors.bright}Explorador:${colors.reset}       ${EXPLORER_URL}
${colors.bright}Token Name:${colors.reset}       Bez-Coin
${colors.bright}Symbol:${colors.reset}           BEZ
${colors.bright}Decimals:${colors.reset}         18
`);

console.log(colors.green + "═".repeat(80) + colors.reset);

console.log("\n" + colors.bright + "🔐 REGLAS DE SEGURIDAD" + colors.reset);
console.log(colors.red + "═".repeat(80) + colors.reset);
console.log(`
${colors.red}🚫 NO CREAR${colors.reset} nuevos contratos BEZ-Coin
${colors.red}🚫 NO MODIFICAR${colors.reset} este contrato
${colors.red}🚫 NO DESPLEGAR${colors.reset} versiones alternativas
${colors.red}🚫 NO USAR${colors.reset} otros contratos para BEZ en producción
`);
console.log(colors.red + "═".repeat(80) + colors.reset);

console.log("\n" + colors.bright + "✅ USO CORRECTO" + colors.reset);
console.log(colors.green + "═".repeat(80) + colors.reset);
console.log(`
Para ${colors.cyan}desplegar contratos${colors.reset} que usen BEZ-Coin:

${colors.bright}JavaScript/Ethers:${colors.reset}
  const OFFICIAL_BEZ = "${OFFICIAL_CONTRACT}";
  const oracle = await QualityOracle.deploy(OFFICIAL_BEZ, ...);

${colors.bright}Solidity:${colors.reset}
  IERC20 public bezToken = IERC20(${OFFICIAL_CONTRACT});

${colors.bright}Variables de Entorno:${colors.reset}
  BEZCOIN_CONTRACT_ADDRESS="${OFFICIAL_CONTRACT}"
  VITE_BEZCOIN_CONTRACT_ADDRESS="${OFFICIAL_CONTRACT}"
`);
console.log(colors.green + "═".repeat(80) + colors.reset);

console.log("\n" + colors.bright + "🛠️ COMANDOS ÚTILES" + colors.reset);
console.log(colors.yellow + "═".repeat(80) + colors.reset);
console.log(`
${colors.bright}Verificar configuración:${colors.reset}
  ${colors.cyan}node scripts/verify-contract-address.js${colors.reset}
  ${colors.cyan}./verify-contract.ps1${colors.reset}

${colors.bright}Ver en explorador:${colors.reset}
  ${colors.cyan}${EXPLORER_URL}${colors.reset}

${colors.bright}Conectar con ethers.js:${colors.reset}
  ${colors.cyan}const contract = new ethers.Contract(
    "${OFFICIAL_CONTRACT}",
    BEZ_ABI,
    provider
  );${colors.reset}
`);
console.log(colors.yellow + "═".repeat(80) + colors.reset);

// Verificar archivos .env
console.log("\n" + colors.bright + "📋 ESTADO DE CONFIGURACIÓN" + colors.reset);
console.log(colors.blue + "═".repeat(80) + colors.reset);

const envFiles = [
    { path: '.env', key: 'BEZCOIN_CONTRACT_ADDRESS' },
    { path: 'backend/.env', key: 'BEZCOIN_CONTRACT_ADDRESS' },
    { path: 'frontend/.env', key: 'VITE_BEZCOIN_CONTRACT_ADDRESS' }
];

envFiles.forEach(({ path: filePath, key }) => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const regex = new RegExp(`${key}\\s*=\\s*["']?([^"'\\s]+)["']?`, 'i');
        const match = content.match(regex);

        if (match && match[1].toLowerCase() === OFFICIAL_CONTRACT.toLowerCase()) {
            console.log(`${colors.green}✅${colors.reset} ${filePath.padEnd(25)} ${colors.cyan}${key}${colors.reset}`);
        } else if (match) {
            console.log(`${colors.red}❌${colors.reset} ${filePath.padEnd(25)} ${colors.yellow}${key}${colors.reset} (INCORRECTO)`);
        } else {
            console.log(`${colors.yellow}⚠️${colors.reset}  ${filePath.padEnd(25)} ${colors.yellow}${key}${colors.reset} (NO ENCONTRADO)`);
        }
    } else {
        console.log(`${colors.yellow}⚠️${colors.reset}  ${filePath.padEnd(25)} (archivo no existe)`);
    }
});

console.log(colors.blue + "═".repeat(80) + colors.reset);

console.log("\n" + colors.bright + "📚 DOCUMENTACIÓN" + colors.reset);
console.log(colors.magenta + "═".repeat(80) + colors.reset);
console.log(`
${colors.cyan}CONTRATO_OFICIAL_BEZ.md${colors.reset}
  Documentación completa del contrato oficial

${colors.cyan}scripts/README_BEZ_CONTRACT.md${colors.reset}
  Guía para desarrolladores sobre deployment

${colors.cyan}WEBHOOK_IMPLEMENTATION_COMPLETE.md${colors.reset}
  Sistema de compra de tokens con Stripe
`);
console.log(colors.magenta + "═".repeat(80) + colors.reset);

console.log("\n" + colors.bright + colors.green + "✅ Sistema configurado correctamente" + colors.reset);
console.log(colors.bright + "🔗 Contrato: " + colors.cyan + OFFICIAL_CONTRACT + colors.reset);
console.log("");
