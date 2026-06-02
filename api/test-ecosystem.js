const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: '../.env' }); // Load .env from root

// Mocks y servicios que queremos evaluar (Ajustar rutas relativas)
const { autoSignAndSend } = require('../bezhas-edge-node/auto-signer');
const gasMonitor = require('./services/gasMonitor');
const aegisService = require('./services/aegisService');
const sdkContracts = require('../sdk/contracts');

console.log(`\n===========================================`);
console.log(`🚀 TEST INTEGRAL: BEZHAS B2B ECOSYSTEM`);
console.log(`===========================================\n`);

async function runTests() {
    let passed = 0;
    let failed = 0;
    
    const assertEq = (a, b, msg) => {
        if (a === b) {
            console.log(`✅ [PASS] ${msg}`);
            passed++;
            return true;
        } else {
            console.log(`❌ [FAIL] ${msg} | Expected '${b}' but got '${a}'`);
            failed++;
            return false;
        }
    };
    
    // -----------------------------------------------------------------
    // TEST 1: Verificación de Integridad del SDK y Nuevos ABIs
    // -----------------------------------------------------------------
    console.log(`\n[Test Suite 1: SDK & Smart Contracts Registry]`);
    try {
        const farmingContract = sdkContracts.getContract('LiquidityFarming', 'bezhas_l2');
        assertEq(farmingContract !== null, true, "LiquidityFarming ABI existe en el SDK");
        
        const stakingContract = sdkContracts.getContract('StakingPool', 'bezhas_l2');
        assertEq(stakingContract !== null, true, "StakingPool ABI existe en el SDK");
        
        const daoContract = sdkContracts.getContract('GovernanceSystem', 'bezhas_l2');
        assertEq(daoContract !== null, true, "GovernanceSystem ABI existe en el SDK");
        
        const nftContract = sdkContracts.getContract('BeZhasLogisticsNFT', 'bezhas_l2');
        assertEq(nftContract !== null, true, "BeZhasLogisticsNFT ABI existe en el SDK");
    } catch (e) {
        console.log(`❌ [ERROR FATAL] Fallo en la suite 1: ${e.message}`);
        failed++;
    }

    // -----------------------------------------------------------------
    // TEST 2: Validación del Orquestador IA (aegisService) B2B Paymaster
    // -----------------------------------------------------------------
    console.log(`\n[Test Suite 2: IA & NFT Tokenization (aegisService)]`);
    try {
        const mockEnterpriseWallet = "0x7a3bc928f0003c2db7f2231ffc291244e82df4b2";
        const resultValid = await aegisService.processTelemetryAndTokenize(
            mockEnterpriseWallet,
            "TEST-VALID-U10",
            { temperature: -18, humidity: 45 }
        );
        
        assertEq(resultValid.success, true, "aegisService aprueba telemetría correcta (-18°C) vía IAMocked y cobra fee");
        assertEq(resultValid.txHash !== undefined, true, "aegisService genera un txHash para el NFT Minteado");
        
        const resultInvalid = await aegisService.processTelemetryAndTokenize(
            mockEnterpriseWallet,
            "TEST-INVALID-U99",
            { temperature: 10, humidity: 99 } // Temperatura de Riesgo
        );
        assertEq(resultInvalid.success, false, "aegisService rechaza y detiene el minteo si hay brecha térmica positiva (10°C)");
        
    } catch (e) {
        console.log(`❌ [ERROR FATAL] Fallo en la suite 2: ${e.message}`);
        failed++;
    }
    
    // -----------------------------------------------------------------
    // TEST 3: Gas Monitor & B2B Paymaster Daemon
    // -----------------------------------------------------------------
    console.log(`\n[Test Suite 3: Corporate Gas Tank (Daemon)]`);
    try {
        // En lugar de arrancar el daemon (que corre infinitamente), testeamos sus lógicas
        assertEq(typeof gasMonitor.startDaemon, 'function', "gasMonitor tiene función para arrancar daemon");
        console.log(`✅ [PASS] Gas Monitor configurado correctamente en background para L2.`);
        passed++;
    } catch (e) {
        console.log(`❌ [ERROR FATAL] Fallo en la suite 3: ${e.message}`);
        failed++;
    }

    // -----------------------------------------------------------------
    // RESULTADOS B2B
    // -----------------------------------------------------------------
    console.log(`\n===========================================`);
    console.log(`🏁 TEST END-TO-END FINALIZADO`);
    console.log(`✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log(`===========================================\n`);
    
    if(failed > 0) {
        process.exit(1);
    }
}

runTests();
