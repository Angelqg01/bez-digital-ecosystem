const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { ethers } = require('ethers');

const ROOT = path.resolve(__dirname, '..');
const execute = process.argv.includes('--execute');

const envFiles = [
    path.resolve(ROOT, '..', '..', '.env'),
    path.join(ROOT, '.env'),
    path.join(ROOT, 'backend', '.env'),
].filter((file) => fs.existsSync(file));

for (const file of envFiles) {
    dotenv.config({ path: file, override: false });
}

const ADMIN_REGISTRY_ABI = [
    'function owner() view returns (address)',
    'function addAdmin(address account) external',
    'function isAdmin(address account) view returns (bool)',
];

const USER_PROFILE_ABI = [
    'function profiles(address user) view returns (string username,string bio,string profilePictureUri,string publicKey,bool isCreated)',
    'function createProfile(string username,string bio,string profilePictureUri,string publicKey) external',
];

function collectAddresses(...values) {
    const found = new Set();
    for (const value of values.filter(Boolean)) {
        for (const match of String(value).matchAll(/0x[a-fA-F0-9]{40}/g)) {
            found.add(ethers.getAddress(match[0]));
        }
    }
    return [...found];
}

function collectPrivateKeys() {
    const keys = new Map();
    const envText = envFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    const keyPattern = /(?:^|\n)\s*([A-Z0-9_]*PRIVATE_KEY[A-Z0-9_]*)\s*=\s*["']?(0x[a-fA-F0-9]{64})["']?/g;
    for (const match of envText.matchAll(keyPattern)) {
        try {
            const wallet = new ethers.Wallet(match[2]);
            if (!keys.has(wallet.address)) {
                keys.set(wallet.address, { name: match[1], privateKey: match[2] });
            }
        } catch {
            // Ignore malformed private keys.
        }
    }
    return keys;
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

function resolveAdminRegistryAddress() {
    const fromEnv = process.env.ADMIN_REGISTRY_ADDRESS || process.env.BEZHAS_ADMIN_REGISTRY_ADDRESS;
    if (fromEnv && ethers.isAddress(fromEnv)) return ethers.getAddress(fromEnv);

    const deployment = readJson(path.join(ROOT, 'admin-registry-deployment.json'));
    const deployed = deployment?.contracts?.beZhasAdminRegistry?.address;
    if (deployed && ethers.isAddress(deployed)) return ethers.getAddress(deployed);

    return null;
}

function resolveUserProfileAddress() {
    const fromEnv = process.env.USERPROFILE_CONTRACT_ADDRESS || process.env.USER_PROFILE_ADDRESS;
    if (fromEnv && ethers.isAddress(fromEnv)) return ethers.getAddress(fromEnv);

    const candidates = [
        path.join(ROOT, 'frontend', 'src', 'contract-addresses.json'),
        path.join(ROOT, 'backend', 'config.json'),
        path.join(ROOT, 'backend', 'contract-addresses.json'),
    ];

    for (const file of candidates) {
        const data = readJson(file);
        const address = data?.UserProfileAddress || data?.UserProfile;
        if (address && ethers.isAddress(address)) return ethers.getAddress(address);
    }

    return null;
}

function makeProfile(address, role) {
    const short = address.slice(2, 8).toUpperCase();
    return {
        username: `bezhas_${role.toLowerCase()}_${short}`,
        bio: `${role} wallet activated for BeZhas Core operations.`,
        profilePictureUri: '',
        publicKey: address,
    };
}

async function wait(tx) {
    console.log(`      tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`      confirmed in block ${receipt.blockNumber}`);
}

async function main() {
    const rpcUrl = process.env.POLYGON_MAINNET_RPC || process.env.POLYGON_RPC_URL || process.env.RPC_URL || 'https://polygon-bor.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminRegistryAddress = resolveAdminRegistryAddress();
    const userProfileAddress = resolveUserProfileAddress();
    const privateKeys = collectPrivateKeys();

    const superAdmins = collectAddresses(process.env.SUPER_ADMIN_WALLETS, process.env.ADMIN_WALLET_ADDRESS);
    const admins = collectAddresses(process.env.ADMIN_WALLETS);
    const roleByAddress = new Map();
    for (const address of admins) roleByAddress.set(address, 'ADMIN');
    for (const address of superAdmins) roleByAddress.set(address, 'SUPER_ADMIN');

    const adminWallets = [...roleByAddress.keys()];

    console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY_RUN'}`);
    console.log(`RPC: ${new URL(rpcUrl).origin}`);
    console.log(`AdminRegistry: ${adminRegistryAddress || 'NOT_FOUND'}`);
    console.log(`UserProfile: ${userProfileAddress || 'NOT_FOUND'}`);
    console.log(`Admin wallets found: ${adminWallets.length}`);

    if (!adminWallets.length) {
        throw new Error('No admin wallets found in env files.');
    }
    if (!adminRegistryAddress) {
        throw new Error('AdminRegistry address not found. Set ADMIN_REGISTRY_ADDRESS or keep admin-registry-deployment.json.');
    }

    const registry = new ethers.Contract(adminRegistryAddress, ADMIN_REGISTRY_ABI, provider);
    const owner = ethers.getAddress(await registry.owner());
    const ownerKey = privateKeys.get(owner);
    console.log(`Registry owner key available: ${ownerKey ? 'yes' : 'no'} (${owner})`);

    if (execute && !ownerKey) {
        throw new Error('Cannot execute admin activation: owner private key is not available in env files.');
    }

    const registryWriter = ownerKey
        ? registry.connect(new ethers.Wallet(ownerKey.privateKey, provider))
        : registry;

    console.log('\nAdmin activation:');
    for (const address of adminWallets) {
        const role = roleByAddress.get(address);
        const active = await registry.isAdmin(address);
        if (active) {
            console.log(`  OK  ${role.padEnd(11)} ${address} already admin`);
            continue;
        }
        if (!execute) {
            console.log(`  ADD ${role.padEnd(11)} ${address} would be activated`);
            continue;
        }
        console.log(`  ADD ${role.padEnd(11)} ${address}`);
        await wait(await registryWriter.addAdmin(address));
    }

    if (!userProfileAddress) {
        console.log('\nProfile activation skipped: UserProfile address not found.');
        return;
    }

    const userProfile = new ethers.Contract(userProfileAddress, USER_PROFILE_ABI, provider);
    console.log('\nProfile activation:');
    for (const address of adminWallets) {
        const role = roleByAddress.get(address);
        let profile;
        try {
            profile = await userProfile.profiles(address);
        } catch (error) {
            console.log(`  SKIP ${role.padEnd(11)} ${address} profile contract read failed: ${error.shortMessage || error.message}`);
            continue;
        }

        if (profile.isCreated) {
            console.log(`  OK  ${role.padEnd(11)} ${address} profile exists (${profile.username})`);
            continue;
        }

        const key = privateKeys.get(address);
        if (!key) {
            console.log(`  MISS ${role.padEnd(11)} ${address} no matching private key for self-profile creation`);
            continue;
        }

        const payload = makeProfile(address, role);
        if (!execute) {
            console.log(`  NEW ${role.padEnd(11)} ${address} would create profile ${payload.username}`);
            continue;
        }

        console.log(`  NEW ${role.padEnd(11)} ${address} creating profile ${payload.username}`);
        const profileWriter = userProfile.connect(new ethers.Wallet(key.privateKey, provider));
        await wait(await profileWriter.createProfile(
            payload.username,
            payload.bio,
            payload.profilePictureUri,
            payload.publicKey
        ));
    }
}

main().catch((error) => {
    console.error(`\nERROR: ${error.shortMessage || error.message}`);
    process.exit(1);
});
