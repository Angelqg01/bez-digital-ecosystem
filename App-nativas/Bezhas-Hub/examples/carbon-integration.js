/**
 * BeZhas SDK - Carbon Credits Trading Example
 * Renewable Energy Project Certification & Credit Trading
 */

const BeZhasUniversal = require('@bezhas/universal-sdk');

const bezhas = new BeZhasUniversal({
    apiKey: process.env.BEZHAS_API_KEY,
    endpoint: 'https://api.bezhas.com/v1',
    debug: true
});

// Example 1: Certify reforestation project
async function certifyReforestationProject() {
    try {
        const project = await bezhas.carbon.certifyProject({
            projectName: 'Amazon Rainforest Reforestation 2026',
            projectType: 'reforestation',
            location: {
                country: 'Brazil',
                state: 'Amazonas',
                coordinates: { lat: -3.4653, lng: -62.2159 }
            },
            area: 10000, // hectares
            expectedReduction: 50000, // tons CO2 over 10 years
            methodology: 'VCS_VM0015', // Verra Methodology
            validationBody: 'Verra',
            projectStart: '2026-01-01',
            projectEnd: '2036-01-01',
            stakeholders: {
                developer: 'Green Earth Foundation',
                landOwner: 'Brazilian Government',
                verifier: 'Bureau Veritas'
            }
        });

        console.log('✅ Project certified:', project);
        // { projectId: 'CARBON-BRA-2026-001', status: 'certified', registryId: 'VCS-3456' }

        return project;
    } catch (error) {
        console.error('❌ Error certifying project:', error.message);
    }
}

// Example 2: Issue carbon credits
async function issueCredits(projectId) {
    try {
        const credits = await bezhas.carbon.issueCredits({
            projectId: projectId,
            creditAmount: 5000, // tons CO2
            projectType: 'reforestation',
            verifier: 'Verra',
            vintage: 2026,
            standard: 'VCS',
            serialNumbers: ['VCS-2026-BRA-001-5000'],
            issuanceDate: '2026-01-15'
        });

        console.log('✅ Credits issued:', credits);
        // { creditId: 'CC-VCS-2026-001', amount: 5000, tokenIds: ['CCT-001', 'CCT-002', ...] }

        return credits;
    } catch (error) {
        console.error('❌ Error issuing credits:', error.message);
    }
}

// Example 3: Trade carbon credits
async function tradeCarbonCredits(creditId) {
    try {
        // Company buys 1000 credits for offset
        const trade = await bezhas.carbon.tradeCredits({
            action: 'buy',
            creditId: creditId,
            quantity: 1000,
            price: 18.50, // $18.50 per ton
            buyer: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Tesla Inc.
            seller: '0x8E23Ee67d1332aD560396262C48ffbB273f626Ed', // Green Earth Foundation
            paymentMethod: 'USDC',
            tradeDate: '2026-01-20'
        });

        console.log('✅ Trade executed:', trade);
        // { tradeId: 'TRD-2026-001', totalCost: 18500, txHash: '0xabc...' }

        return trade;
    } catch (error) {
        console.error('❌ Error trading credits:', error.message);
    }
}

// Example 4: Verify and retire credits (offset)
async function retireCreditsForOffset(creditId) {
    try {
        const retirement = await bezhas.carbon.verifyOffset({
            creditId: creditId,
            retiredAmount: 1000,
            beneficiary: 'Tesla Inc.',
            retirementReason: 'Corporate Carbon Neutrality 2026',
            reportingPeriod: 'Q1-2026',
            registry: 'Verra'
        });

        console.log('✅ Credits retired:', retirement);
        // { retirementId: 'RET-2026-001', certificateUrl: 'https://...', permanent: true }

        return retirement;
    } catch (error) {
        console.error('❌ Error retiring credits:', error.message);
    }
}

// Example 5: Get current market price
async function getCreditMarketPrice() {
    try {
        const price = await bezhas.carbon.getCreditPrice(
            'reforestation',
            2026
        );

        console.log('✅ Current market price:', price);
        // { averagePrice: 18.50, volume24h: 125000, priceChange24h: +2.3 }

        return price;
    } catch (error) {
        console.error('❌ Error fetching price:', error.message);
    }
}

// Example 6: Generate compliance report
async function generateComplianceReport() {
    try {
        const report = await bezhas.carbon.reportCompliance({
            entityId: 'COMPANY-TESLA-USA',
            reportingPeriod: {
                start: '2025-01-01',
                end: '2025-12-31'
            },
            totalEmissions: 15000, // tons CO2
            offsetCredits: 16000, // tons CO2
            netEmissions: -1000, // Carbon negative!
            emissionSources: {
                manufacturing: 8000,
                logistics: 4000,
                offices: 3000
            },
            offsetProjects: [
                { projectId: 'CARBON-BRA-2026-001', credits: 10000 },
                { projectId: 'WIND-USA-2025-005', credits: 6000 }
            ]
        });

        console.log('✅ Compliance report generated:', report);
        // { compliant: true, status: 'carbon_negative', certificateUrl: '...' }

        return report;
    } catch (error) {
        console.error('❌ Error generating report:', error.message);
    }
}

// Run complete carbon credits workflow
async function runCarbonWorkflow() {
    console.log('🌱 Starting Carbon Credits Workflow...\n');

    // Step 1: Certify reforestation project
    const project = await certifyReforestationProject();
    if (!project) return;

    // Step 2: Issue carbon credits
    const credits = await issueCredits(project.projectId);
    if (!credits) return;

    // Step 3: Check market price
    await getCreditMarketPrice();

    // Step 4: Trade credits
    const trade = await tradeCarbonCredits(credits.creditId);
    if (!trade) return;

    // Step 5: Retire credits for offset
    await retireCreditsForOffset(credits.creditId);

    // Step 6: Generate compliance report
    await generateComplianceReport();

    console.log('\n✅ Carbon workflow completed!');
}

// Execute
runCarbonWorkflow();

module.exports = {
    certifyReforestationProject,
    issueCredits,
    tradeCarbonCredits,
    retireCreditsForOffset,
    getCreditMarketPrice,
    generateComplianceReport
};
