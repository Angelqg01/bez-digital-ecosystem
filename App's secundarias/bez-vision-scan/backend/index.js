// Integración QualityEscrow
const qualityEscrowAddress = process.env.QUALITY_ESCROW_ADDRESS || '0x0000000000000000000000000000000000000000';
let qualityEscrow;
let qualityEscrowWithSigner;
if (ethers.isAddress(qualityEscrowAddress) && privateKey) {
    qualityEscrow = new ethers.Contract(qualityEscrowAddress, qualityEscrowAbi, provider);
    const wallet = new ethers.Wallet(privateKey, provider);
    qualityEscrowWithSigner = qualityEscrow.connect(wallet);
} else {
    qualityEscrow = new ethers.Contract(qualityEscrowAddress, qualityEscrowAbi, provider);
}

// Consultar datos de sensores
async function getLatestSensorData(containerId) {
    try {
        const data = await qualityEscrow.getLatestData(containerId);
        console.log('Último dato de sensor para', containerId, ':', data);
    } catch (err) {
        console.error('Error al consultar datos de sensor:', err);
    }
}

// Registrar datos de sensores
async function registerSensorData(containerId, temperature, status) {
    if (!qualityEscrowWithSigner) {
        console.log('No hay signer configurado para registrar datos de sensor.');
        return;
    }
    try {
        const tx = await qualityEscrowWithSigner.registerSensorData(containerId, temperature, status);
        console.log('Registro de sensor enviado:', tx.hash);
        await tx.wait();
        console.log('Registro de sensor completado.');
    } catch (err) {
        console.error('Error al registrar datos de sensor:', err);
    }
}

// Ejemplo de uso de QualityEscrow (descomentar para probar)
// await getLatestSensorData('CONTAINER-001');
// await registerSensorData('CONTAINER-001', 22, 'OK');
// Función para transferir un NFT logístico
async function transferNFT(tokenId, toAddress) {
    if (!logisticsNFTWithSigner) {
        console.log('No hay signer configurado para transferir NFT.');
        return;
    }
    if (!ethers.isAddress(toAddress)) {
        console.log('Dirección de destino inválida.');
        return;
    }
    try {
        const tx = await logisticsNFTWithSigner.transferFrom(await logisticsNFTWithSigner.signer.getAddress(), toAddress, tokenId);
        console.log('Transferencia enviada:', tx.hash);
        const receipt = await tx.wait();
        console.log('Transferencia completada. Gas usado:', receipt.gasUsed.toString());
    } catch (err) {
        console.error('Error al transferir NFT:', err);
    }
}

// Función para otorgar un rol a una cuenta
async function grantRole(role, account) {
    if (!logisticsNFTWithSigner) {
        console.log('No hay signer configurado para otorgar roles.');
        return;
    }
    if (!ethers.isAddress(account)) {
        console.log('Dirección de cuenta inválida.');
        return;
    }
    try {
        const tx = await logisticsNFTWithSigner.grantRole(role, account);
        console.log('Rol otorgado. Tx:', tx.hash);
        await tx.wait();
    } catch (err) {
        console.error('Error al otorgar rol:', err);
    }
}

// Ejemplo de uso de las nuevas funciones (descomentar para probar)
// await transferNFT(1, '0x...');
// await grantRole(await logisticsNFT.MINTER_ROLE(), '0x...');
require('dotenv').config();
const { ethers } = require('ethers');
const { logisticsNFTAbi, qualityEscrowAbi } = require('./contracts');


// Dirección real de contrato logístico (ejemplo, reemplazar por la real si la tienes)

const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
const logisticsNFTAddress = process.env.LOGISTICS_NFT_ADDRESS || '0x0000000000000000000000000000000000000000';
const privateKey = process.env.PRIVATE_KEY || '';
let logisticsNFT;
let logisticsNFTWithSigner;
if (ethers.isAddress(logisticsNFTAddress) && privateKey) {
    logisticsNFT = new ethers.Contract(logisticsNFTAddress, logisticsNFTAbi, provider);
    const wallet = new ethers.Wallet(privateKey, provider);
    logisticsNFTWithSigner = logisticsNFT.connect(wallet);
} else {
    logisticsNFT = new ethers.Contract(logisticsNFTAddress, logisticsNFTAbi, provider);
}

async function main() {
    try {
        const network = await provider.getNetwork();
        console.log('Conectado a la red:', network.name, network.chainId);
        const code = await provider.getCode(logisticsNFTAddress);
        if (code === '0x') {
            console.error('No se encontró contrato en la dirección:', logisticsNFTAddress);
            return;
        }
        const name = await logisticsNFT.name();
        console.log('Nombre del contrato:', name);

        // Mint de NFT logístico (ejemplo)
        if (logisticsNFTWithSigner) {
            const to = process.env.MINT_TO_ADDRESS || '';
            const uri = process.env.MINT_URI || 'https://example.com/metadata.json';
            const containerId = process.env.MINT_CONTAINER_ID || 'CONTAINER-001';
            if (ethers.isAddress(to)) {
                console.log('Minting NFT logístico...');
                const tx = await logisticsNFTWithSigner.safeMint(to, uri, containerId);
                console.log('Transacción enviada:', tx.hash);
                const receipt = await tx.wait();
                console.log('Mint completado. Gas usado:', receipt.gasUsed.toString());
            } else {
                console.log('Dirección de destino para mint no válida. Define MINT_TO_ADDRESS en .env');
            }
        } else {
            console.log('No se configuró PRIVATE_KEY o dirección de contrato válida para mint. Solo lectura.');
        }
    } catch (err) {
        console.error('Error al conectar con el contrato o al hacer mint:', err);
    }
}

main();
