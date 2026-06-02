/**
 * Ejemplo de Uso del BeZhas SDK - Contratos
 * 
 * Este archivo demuestra cómo usar el SDK para interactuar con contratos desplegados.
 * Ejecutar: node sdk/test-contracts-sdk.js
 */

const {
    getContract,
    getABI,
    getAddresses,
    listContracts,
    isDeployed
} = require('./contracts');

console.log('\n🚀 BeZhas SDK - Test de Contratos\n');
console.log('='.repeat(60));

// 1. Listar todos los contratos disponibles
console.log('\n📋 Contratos disponibles en el SDK:');
const contracts = listContracts();
console.log(`Total: ${contracts.length} contratos`);
console.log(contracts.slice(0, 10).join(', ') + '...\n');

// 2. Verificar qué contratos están desplegados en localhost
console.log('🔍 Estado de despliegue en localhost:');
const criticalContracts = [
    'LiquidityFarming',
    'GovernanceSystem',
    'BeZhasQualityEscrow',
    'BezhasToken',
    'StakingPool'
];

criticalContracts.forEach(name => {
    const deployed = isDeployed(name, 'localhost');
    const status = deployed ? '✅' : '❌';
    console.log(`${status} ${name}: ${deployed ? 'Desplegado' : 'No desplegado'}`);
});

// 3. Obtener configuración completa de un contrato
console.log('\n📝 Ejemplo: LiquidityFarming en localhost');
try {
    const farmingConfig = getContract('LiquidityFarming', 'localhost');

    if (farmingConfig) {
        console.log(`✅ Address: ${farmingConfig.address}`);
        console.log(`✅ ABI Functions: ${farmingConfig.abi.filter(item => item.type === 'function').length}`);
        console.log(`✅ ABI Events: ${farmingConfig.abi.filter(item => item.type === 'event').length}`);

        // Listar algunas funciones principales
        const mainFunctions = farmingConfig.abi
            .filter(item => item.type === 'function')
            .slice(0, 5)
            .map(f => f.name);
        console.log(`   Funciones: ${mainFunctions.join(', ')}`);
    } else {
        console.log('⚠️  Contrato no desplegado. Ejecuta primero el script de despliegue.');
    }
} catch (error) {
    console.error('❌ Error:', error.message);
}

// 4. Obtener solo el ABI de un contrato
console.log('\n📄 Obtener solo ABI de GovernanceSystem:');
try {
    const governanceABI = getABI('GovernanceSystem');
    const functions = governanceABI.filter(item => item.type === 'function');
    console.log(`✅ Funciones disponibles: ${functions.length}`);
    console.log(`   Ejemplos: ${functions.slice(0, 3).map(f => f.name).join(', ')}`);
} catch (error) {
    console.error('❌ Error:', error.message);
}

// 5. Obtener todas las direcciones de una red
console.log('\n🌐 Direcciones en Amoy Testnet:');
const amoyAddresses = getAddresses('amoy');
const deployedInAmoy = Object.entries(amoyAddresses)
    .filter(([name, addr]) => addr && addr !== '')
    .slice(0, 5);

if (deployedInAmoy.length > 0) {
    console.log(`✅ Contratos desplegados: ${deployedInAmoy.length}`);
    deployedInAmoy.forEach(([name, addr]) => {
        console.log(`   ${name}: ${addr}`);
    });
} else {
    console.log('⚠️  No hay contratos desplegados en Amoy aún.');
    console.log('   Configura las variables de entorno o despliega los contratos.');
}

// 6. Ejemplo de uso con ethers.js (simulado)
console.log('\n💡 Ejemplo de integración con ethers.js:');
console.log(`
const { ethers } = require('ethers');
const { getContract } = require('@bezhas/sdk');

// 1. Configurar provider
const provider = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology/');

// 2. Obtener configuración del contrato
const { address, abi } = getContract('LiquidityFarming', 'amoy');

// 3. Crear instancia del contrato
const contract = new ethers.Contract(address, abi, provider);

// 4. Interactuar con el contrato
const rewardPerBlock = await contract.rewardPerBlock();
console.log('Reward:', ethers.formatEther(rewardPerBlock));
`);

// 7. Resumen final
console.log('\n' + '='.repeat(60));
console.log('✅ Test completado exitosamente');
console.log('\n📚 Para más información, consulta: sdk/USAGE_EXAMPLES.md');
console.log('🔗 Documentación completa: ../COMPLETE_SYSTEM_GUIDE.md\n');
