/**
 * Real Polygon E2E for BeZhas crypto payments.
 *
 * Flow:
 * 1. Uses a funded buyer wallet to sign ERC-20 approve on Polygon.
 * 2. Calls the live backend /api/crypto/initiate endpoint.
 * 3. Backend pulls USDT/USDC via transferFrom and sends BEZ to buyer.
 * 4. Verifies stablecoin and BEZ balance deltas on Polygon.
 *
 * Required env:
 * - POLYGON_RPC_URL
 * - E2E_BUYER_PRIVATE_KEY
 * - E2E_AUTH_TOKEN, unless backend is running with AUTH_BYPASS_ENABLED=true
 * - E2E_HOT_WALLET_ADDRESS, HOT_WALLET_ADDRESS, or NEXT_PUBLIC_HOT_WALLET_ADDRESS
 *
 * Optional env:
 * - E2E_BACKEND_URL=http://127.0.0.1:8080
 * - E2E_CURRENCY=USDC
 * - E2E_AMOUNT=0.1
 * - BEZ_TOKEN_ADDRESS=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 */

const assert = require('node:assert/strict');
const { ethers } = require('ethers');
require('dotenv').config();

const BEZ_TOKEN_ADDRESS = process.env.BEZ_TOKEN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const TOKEN_ADDRESSES = {
    USDT: process.env.USDT_POLYGON_ADDRESS || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDC: process.env.USDC_POLYGON_ADDRESS || '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
};

const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
];

function required(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env ${name}`);
    return value;
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
            ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
        const error = new Error(data.error || data.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

async function main() {
    const backendUrl = (process.env.E2E_BACKEND_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
    const rpcUrl = required('POLYGON_RPC_URL');
    const privateKey = required('E2E_BUYER_PRIVATE_KEY');
    const authToken = process.env.E2E_AUTH_TOKEN || '';
    const currency = (process.env.E2E_CURRENCY || 'USDC').toUpperCase();
    const amount = process.env.E2E_AMOUNT || '0.1';
    const spender = process.env.E2E_HOT_WALLET_ADDRESS ||
        process.env.HOT_WALLET_ADDRESS ||
        process.env.NEXT_PUBLIC_HOT_WALLET_ADDRESS;

    assert.ok(['USDT', 'USDC'].includes(currency), 'E2E_CURRENCY must be USDT or USDC');
    assert.ok(spender && ethers.isAddress(spender), 'Missing valid hot wallet spender address');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();
    assert.equal(Number(network.chainId), 137, `Expected Polygon mainnet chainId 137, got ${network.chainId}`);

    const buyer = new ethers.Wallet(privateKey, provider);
    const stablecoin = new ethers.Contract(TOKEN_ADDRESSES[currency], ERC20_ABI, buyer);
    const bez = new ethers.Contract(BEZ_TOKEN_ADDRESS, ERC20_ABI, provider);
    const stableDecimals = await stablecoin.decimals();
    const bezDecimals = await bez.decimals();
    const paymentAmount = ethers.parseUnits(amount, stableDecimals);

    console.log(`Backend: ${backendUrl}`);
    console.log(`Buyer:   ${buyer.address}`);
    console.log(`Token:   ${currency} ${TOKEN_ADDRESSES[currency]}`);
    console.log(`BEZ:     ${BEZ_TOKEN_ADDRESS}`);
    console.log(`Spender: ${spender}`);

    await requestJson(`${backendUrl}/healthz`).catch(async () => requestJson(`${backendUrl}/`));

    const quote = await requestJson(`${backendUrl}/api/crypto/quote`, {
        method: 'POST',
        body: { amount: Number(amount), currency },
    });
    assert.equal(quote.success, true);
    assert.ok(Number(quote.quote.toAmount) > 0, 'Quote must return BEZ amount');

    const stableBefore = await stablecoin.balanceOf(buyer.address);
    const spenderStableBefore = await stablecoin.balanceOf(spender);
    const bezBefore = await bez.balanceOf(buyer.address);
    assert.ok(stableBefore >= paymentAmount, `Insufficient ${currency} balance in buyer wallet`);

    const currentAllowance = await stablecoin.allowance(buyer.address, spender);
    if (currentAllowance < paymentAmount) {
        console.log(`Approving ${amount} ${currency}...`);
        const approveTx = await stablecoin.approve(spender, paymentAmount);
        console.log(`Approve tx: ${approveTx.hash}`);
        const approveReceipt = await approveTx.wait();
        assert.equal(approveReceipt.status, 1, 'Approve transaction failed');
    } else {
        console.log(`Allowance already enough: ${ethers.formatUnits(currentAllowance, stableDecimals)} ${currency}`);
    }

    console.log('Calling backend /api/crypto/initiate...');
    const initiate = await requestJson(`${backendUrl}/api/crypto/initiate`, {
        method: 'POST',
        token: authToken,
        body: { walletAddress: buyer.address, amount: Number(amount), currency },
    });

    assert.equal(initiate.success, true);
    assert.ok(initiate.transactionHash, 'Backend must return BEZ transfer hash');
    assert.ok(initiate.stablecoinTransferHash, 'Backend must return stablecoin transfer hash');

    const status = await requestJson(`${backendUrl}/api/crypto/status/${initiate.transactionHash}`);
    assert.equal(status.status, 'success');

    const stableAfter = await stablecoin.balanceOf(buyer.address);
    const spenderStableAfter = await stablecoin.balanceOf(spender);
    const bezAfter = await bez.balanceOf(buyer.address);

    assert.equal(stableBefore - stableAfter, paymentAmount, `${currency} buyer delta mismatch`);
    assert.equal(spenderStableAfter - spenderStableBefore, paymentAmount, `${currency} treasury delta mismatch`);
    assert.ok(bezAfter > bezBefore, 'Buyer BEZ balance did not increase');

    const report = {
        ok: true,
        backendUrl,
        chainId: Number(network.chainId),
        buyer: buyer.address,
        currency,
        amount,
        quoteBEZ: quote.quote.toAmount,
        stablecoinTransferHash: initiate.stablecoinTransferHash,
        bezTransferHash: initiate.transactionHash,
        stableDelta: ethers.formatUnits(stableBefore - stableAfter, stableDecimals),
        bezDelta: ethers.formatUnits(bezAfter - bezBefore, bezDecimals),
    };

    console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
    console.error(error?.data || error);
    process.exit(1);
});
