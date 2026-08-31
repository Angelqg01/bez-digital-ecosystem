#!/usr/bin/env node
/**
 * Script para actualizar automáticamente las addresses de contratos en .env
 * Uso: node scripts/update-env-addresses.js <bezCoinAddress> <escrowAddress>
 */

const fs = require('fs');
const path = require('path');

// Colores para console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
};

function updateEnvFile(filePath, updates) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        for (const [key, value] of Object.entries(updates)) {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(content)) {
                content = content.replace(regex, `${key}=${value}`);
                modified = true;
            } else {
                console.log(`${colors.yellow}⚠️  ${key} no encontrada en ${filePath}, agregando...${colors.reset}`);
                content += `\n${key}=${value}`;
                modified = true;
            }
        }

        if (modified) {
            fs.writeFileSync(filePath, content);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`${colors.red}❌ Error actualizando ${filePath}:${colors.reset}`, error.message);
        return false;
    }
}

function main() {
    console.log(`\n${colors.blue}📝 Actualizando variables de entorno...${colors.reset}\n`);

    const args = process.argv.slice(2);
    if (args.length !== 2) {
        console.error(`${colors.red}❌ Uso: node update-env-addresses.js <bezCoinAddress> <escrowAddress>${colors.reset}`);
        process.exit(1);
    }

    const [bezCoinAddress, escrowAddress] = args;

    // Validar formato de addresses
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(bezCoinAddress) || !addressRegex.test(escrowAddress)) {
        console.error(`${colors.red}❌ Formato de address inválido${colors.reset}`);
        console.log('Ejemplo válido: 0x1234567890123456789012345678901234567890');
        process.exit(1);
    }

    // Archivos a actualizar
    const backendEnvPath = path.join(__dirname, '..', 'backend', '.env');
    const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env');

    // Actualizaciones para backend
    const backendUpdates = {
        'BEZCOIN_ADDRESS': bezCoinAddress,
        'QUALITY_ESCROW_ADDRESS': escrowAddress
    };

    // Actualizaciones para frontend
    const frontendUpdates = {
        'VITE_BEZCOIN_ADDRESS': bezCoinAddress,
        'VITE_QUALITY_ESCROW_ADDRESS': escrowAddress
    };

    let success = true;

    // Actualizar backend/.env
    console.log(`${colors.blue}📁 Actualizando backend/.env...${colors.reset}`);
    if (updateEnvFile(backendEnvPath, backendUpdates)) {
        console.log(`${colors.green}✅ Backend actualizado${colors.reset}`);
        Object.entries(backendUpdates).forEach(([key, value]) => {
            console.log(`   ${key}=${value}`);
        });
    } else {
        console.log(`${colors.yellow}⚠️  Backend no modificado (valores ya actualizados)${colors.reset}`);
    }

    console.log('');

    // Actualizar frontend/.env
    console.log(`${colors.blue}📁 Actualizando frontend/.env...${colors.reset}`);
    if (updateEnvFile(frontendEnvPath, frontendUpdates)) {
        console.log(`${colors.green}✅ Frontend actualizado${colors.reset}`);
        Object.entries(frontendUpdates).forEach(([key, value]) => {
            console.log(`   ${key}=${value}`);
        });
    } else {
        console.log(`${colors.yellow}⚠️  Frontend no modificado (valores ya actualizados)${colors.reset}`);
    }

    console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.green}✅ Variables de entorno actualizadas exitosamente!${colors.reset}`);
    console.log(`${colors.green}${'='.repeat(60)}${colors.reset}\n`);

    console.log(`${colors.blue}🔄 Próximos pasos:${colors.reset}`);
    console.log('1. Reiniciar backend: cd backend && npm start');
    console.log('2. Reiniciar frontend: cd frontend && npm run dev');
    console.log('3. Verificar en: http://localhost:5173/admin (tab Quality Oracle)\n');
}

main();
