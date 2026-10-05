/**
 * BeZhas SDK - Real Estate Integration Example
 * Property Tokenization & Fractional Ownership Platform
 */

const BeZhasUniversal = require('@bezhas/universal-sdk');

// Initialize SDK
const bezhas = new BeZhasUniversal({
    apiKey: process.env.BEZHAS_API_KEY,
    endpoint: 'https://api.bezhas.com/v1',
    debug: true
});

// Example 1: Tokenize a residential property
async function tokenizeResidentialProperty() {
    try {
        const property = await bezhas.realestate.tokenizeProperty({
            address: '1428 Elm Street, Miami, FL 33139',
            propertyType: 'residential',
            valuation: 850000,
            cadastralReference: 'CAD-FL-MIA-001428',
            legalDocuments: [
                'https://storage.bezhas.com/docs/deed_1428elm.pdf',
                'https://storage.bezhas.com/docs/inspection_1428elm.pdf',
                'https://storage.bezhas.com/docs/title_search_1428elm.pdf'
            ],
            metadata: {
                bedrooms: 4,
                bathrooms: 3,
                sqft: 2500,
                yearBuilt: 2020,
                parking: 2
            }
        });

        console.log('✅ Property tokenized:', property);
        // { tokenId: 'RE-NFT-001', txHash: '0x123...', contractAddress: '0xabc...' }

        return property;
    } catch (error) {
        console.error('❌ Error tokenizing property:', error.message);
    }
}

// Example 2: Fractionate property for 20 investors
async function fractionateProperty(tokenId) {
    try {
        const fractions = await bezhas.realestate.fractionateProperty(
            tokenId,
            20, // 20 investors
            {
                minInvestment: 42500, // $42.5k per fraction
                vestingPeriod: 365, // 1 year lock-up
                transferable: true
            }
        );

        console.log('✅ Property fractionated:', fractions);
        // { fractionTokens: ['FRAC-001', 'FRAC-002', ...], totalFractions: 20 }

        return fractions;
    } catch (error) {
        console.error('❌ Error fractionating:', error.message);
    }
}

// Example 3: Collect monthly rent from tenants
async function collectMonthlyRent(propertyId) {
    try {
        const rent = await bezhas.realestate.collectRent({
            propertyId: propertyId,
            amount: 4500, // $4,500/month
            month: '2026-01',
            tenantAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            distributionMode: 'automatic', // Auto-distribute to fraction holders
            deductions: {
                propertyTax: 450,
                insurance: 200,
                maintenance: 300
            }
        });

        console.log('✅ Rent collected and distributed:', rent);
        // { totalCollected: 4500, netDistributed: 3550, perFraction: 177.50 }

        return rent;
    } catch (error) {
        console.error('❌ Error collecting rent:', error.message);
    }
}

// Example 4: Get property investment history
async function getPropertyHistory(propertyId) {
    try {
        const history = await bezhas.realestate.getUserProperties({
            userAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
        });

        console.log('✅ User property portfolio:', history);
        // [ { propertyId: 'RE-NFT-001', fractions: 5, totalInvested: 212500 } ]

        return history;
    } catch (error) {
        console.error('❌ Error fetching history:', error.message);
    }
}

// Run complete workflow
async function runRealEstateWorkflow() {
    console.log('🏠 Starting Real Estate Tokenization Workflow...\n');

    // Step 1: Tokenize property
    const property = await tokenizeResidentialProperty();
    if (!property) return;

    // Step 2: Fractionate for investors
    const fractions = await fractionateProperty(property.tokenId);
    if (!fractions) return;

    // Step 3: Collect rent
    const rent = await collectMonthlyRent(property.tokenId);
    if (!rent) return;

    // Step 4: Check investment history
    await getPropertyHistory(property.tokenId);

    console.log('\n✅ Workflow completed successfully!');
}

// Execute
runRealEstateWorkflow();

module.exports = {
    tokenizeResidentialProperty,
    fractionateProperty,
    collectMonthlyRent,
    getPropertyHistory
};
