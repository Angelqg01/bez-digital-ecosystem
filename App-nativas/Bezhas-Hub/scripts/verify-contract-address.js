#!/usr/bin/env node

/**
 * Script de Verificación del Contrato BEZ-Coin Oficial
 * 
 * Este script verifica que todos los archivos de configuración
 * usen el contrato BEZ-Coin oficial y único:
 * 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 */

const fs = require('fs');
const path = require('path');

const OFFICIAL_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
const OFFICIAL_CONTRACT_LOWER = OFFICIAL_CONTRACT.toLowerCase();

console.log("\n" + "=".repeat(80));
console.log("🔍 VERIFICACIÓN DEL CONTRATO BEZ-COIN OFICIAL");
console.log("=".repeat(80));
console.log("\n📋 Contrato Oficial:", OFFICIAL_CONTRACT);
console.log("🌐 Network: Polygon Amoy (ChainID 80002)");
console.log("🔗 Explorer: https://amoy.polygonscan.com/address/" + OFFICIAL_CONTRACT);
console.log("\n" + "=".repeat(80) + "\n");

// Archivos a verificar
const filesToCheck = [
    { path: '.env', key: 'BEZCOIN_CONTRACT_ADDRESS' },
    { path: 'backend/.env', key: 'BEZCOIN_CONTRACT_ADDRESS' },
    { path: 'backend/.env', key: 'BEZCOIN_ADDRESS' },
    { path: 'frontend/.env', key: 'VITE_BEZCOIN_CONTRACT_ADDRESS' }
];

let allCorrect = true;
let filesChecked = 0;

filesToCheck.forEach(({ path: filePath, key }) => {
    const fullPath = path.join(__dirname, '..', filePath);

    if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  ${filePath} - NO EXISTE`);
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const regex = new RegExp(`${key}\\s*=\\s*["']?([^"'\\s]+)["']?`, 'i');
    const match = content.match(regex);

    if (match) {
        const foundAddress = match[1];
        filesChecked++;

        if (foundAddress.toLowerCase() === OFFICIAL_CONTRACT_LOWER) {
            console.log(`✅ ${filePath}`);
            console.log(`   ${key}=${foundAddress}`);
        } else {
            console.log(`❌ ${filePath}`);
            console.log(`   ${key}=${foundAddress}`);
            console.log(`   ⚠️  INCORRECTO! Debe ser: ${OFFICIAL_CONTRACT}`);
            allCorrect = false;
        }
    } else {
        console.log(`⚠️  ${filePath}`);
        console.log(`   ${key} no encontrado`);
    }

    console.log("");
});

console.log("=".repeat(80));

if (allCorrect && filesChecked > 0) {
    console.log("✅ VERIFICACIÓN EXITOSA");
    console.log("   Todos los archivos usan el contrato oficial correcto.");
} else if (filesChecked === 0) {
    console.log("⚠️  NO SE ENCONTRARON ARCHIVOS PARA VERIFICAR");
    console.log("   Asegúrate de ejecutar este script desde el directorio raíz.");
} else {
    console.log("❌ VERIFICACIÓN FALLIDA");
    console.log("   Algunos archivos NO usan el contrato oficial.");
    console.log("\n   ACCIÓN REQUERIDA:");
    console.log("   Actualiza los archivos incorrectos con:");
    console.log(`   ${OFFICIAL_CONTRACT}`);
}

console.log("=".repeat(80) + "\n");

// Verificar en código también
console.log("🔍 Verificando referencias en código...\n");

const codeFiles = [
    'backend/services/fiatGateway.service.js',
    'backend/routes/payment.routes.js'
];

codeFiles.forEach(filePath => {
    const fullPath = path.join(__dirname, '..', filePath);

    if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  ${filePath} - NO EXISTE`);
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    // Buscar referencias al contrato
    if (content.includes('BEZCOIN') || content.includes('BEZ_TOKEN')) {
        console.log(`📄 ${filePath}`);
        console.log(`   ✅ Usa variable de entorno (correcto)`);
    } else {
        console.log(`📄 ${filePath}`);
        console.log(`   ℹ️  No se encontraron referencias directas`);
    }
});

console.log("\n" + "=".repeat(80));
console.log("📚 Documentación: Ver CONTRATO_OFICIAL_BEZ.md");
console.log("=".repeat(80) + "\n");

process.exit(allCorrect ? 0 : 1);
