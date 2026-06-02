/**
 * MongoDB Atlas Connection Setup & Test
 * 
 * Usage:
 *   node scripts/setup-mongodb.js YOUR_PASSWORD
 * 
 * This script:
 * 1. Updates backend/.env with the password
 * 2. Tests the connection to MongoDB Atlas
 * 3. Creates the 'bezhas' database with initial SDK config
 */

const fs = require('fs');
const path = require('path');

const ATLAS_USER = 'bezhas-admin';
const ATLAS_HOST = 'bezhas-cluster.gnoalda.mongodb.net';
const DB_NAME = 'bezhas';

async function main() {
    const password = process.argv[2];

    if (!password) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('  MongoDB Atlas Connection Setup for BeZhas');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        console.log('  Usage: node scripts/setup-mongodb.js YOUR_PASSWORD');
        console.log('');
        console.log('  To get your password:');
        console.log('  1. Go to https://cloud.mongodb.com/');
        console.log('  2. Left sidebar → Security → Database Access');
        console.log('  3. If user "bezhas-admin" exists → Edit → Edit Password');
        console.log('  4. If no user exists → Add New Database User:');
        console.log('     - Auth Method: Password');
        console.log('     - Username: bezhas-admin');
        console.log('     - Password: (auto-generate or type one)');
        console.log('     - Role: Atlas Admin');
        console.log('     - Click "Add User"');
        console.log('  5. Copy the password and run this script again');
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        process.exit(0);
    }

    const encodedPassword = encodeURIComponent(password);
    const uri = `mongodb+srv://${ATLAS_USER}:${encodedPassword}@${ATLAS_HOST}/${DB_NAME}?retryWrites=true&w=majority&appName=bezhas-cluster`;

    console.log('');
    console.log('🔧 Step 1: Updating .env files...');

    // Update backend/.env
    const backendEnvPath = path.resolve(__dirname, '..', 'backend', '.env');
    if (fs.existsSync(backendEnvPath)) {
        let content = fs.readFileSync(backendEnvPath, 'utf8');
        content = content.replace(
            /MONGODB_URI=.*/,
            `MONGODB_URI=${uri}`
        );
        fs.writeFileSync(backendEnvPath, content);
        console.log('   ✅ backend/.env updated');
    }

    // Update packages/mcp-server/.env
    const mcpEnvPath = path.resolve(__dirname, '..', 'packages', 'mcp-server', '.env');
    if (fs.existsSync(mcpEnvPath)) {
        let content = fs.readFileSync(mcpEnvPath, 'utf8');
        content = content.replace(
            /MONGODB_URI=.*/,
            `MONGODB_URI=${uri}`
        );
        fs.writeFileSync(mcpEnvPath, content);
        console.log('   ✅ packages/mcp-server/.env updated');
    }

    console.log('');
    console.log('🔌 Step 2: Testing MongoDB Atlas connection...');

    try {
        const mongoose = require('mongoose');
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 30000,
        });

        console.log('   ✅ Connected to MongoDB Atlas!');
        console.log(`   📍 Database: ${mongoose.connection.db.databaseName}`);
        console.log(`   🏠 Host: ${mongoose.connection.host}`);

        // List existing collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`   📦 Collections: ${collections.length > 0 ? collections.map(c => c.name).join(', ') : '(none yet - will be created on first use)'}`);

        await mongoose.connection.close();

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('  ✅ SUCCESS! MongoDB Atlas is configured and working.');
        console.log('');
        console.log('  Next steps:');
        console.log('  1. Start the backend: cd backend && node server.js');
        console.log('  2. SDK Admin will auto-create its config on first access');
        console.log('');
        console.log('  For GCP deployment, update the secret:');
        console.log(`  echo "${uri}" | gcloud secrets versions add MONGODB_URI --data-file=- --project=totemic-bonus-479312-c6`);
        console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
        console.error('   ❌ Connection failed:', error.message);
        console.log('');
        console.log('   Common issues:');
        console.log('   - Wrong password → Edit user in Atlas Database Access');
        console.log('   - Network blocked → Atlas Network Access → Add 0.0.0.0/0');
        console.log('   - User does not exist → Create in Atlas Database Access');
        process.exit(1);
    }
}

main();
