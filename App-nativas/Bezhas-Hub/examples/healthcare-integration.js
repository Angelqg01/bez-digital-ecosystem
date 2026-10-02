/**
 * BeZhas SDK - Healthcare Supply Chain Example
 * Pharmaceutical Cold Chain Tracking & HIPAA Compliance
 */

const BeZhasUniversal = require('@bezhas/universal-sdk');

const bezhas = new BeZhasUniversal({
    apiKey: process.env.BEZHAS_API_KEY,
    endpoint: 'https://api.bezhas.com/v1',
    debug: true
});

// Example 1: Verify digital prescription
async function verifyPrescription() {
    try {
        const prescription = await bezhas.healthcare.verifyPrescription({
            prescriptionId: 'RX-2026-001234',
            patientId: 'PAT-987654',
            medicationCode: 'NDC-0069-2587-01', // Lipitor 10mg
            prescribingDoctor: 'DR-FL-12345',
            pharmacy: 'CVS-MIAMI-001',
            quantity: 30,
            refills: 2
        });

        console.log('✅ Prescription verified:', prescription);
        // { valid: true, expiryDate: '2026-07-01', remainingRefills: 2 }

        return prescription;
    } catch (error) {
        console.error('❌ Error verifying prescription:', error.message);
    }
}

// Example 2: Track vaccine cold chain
async function trackVaccineColdChain() {
    try {
        const tracking = await bezhas.healthcare.trackSupply({
            batchId: 'VAC-COVID-2026-Q1-001',
            productType: 'vaccine',
            manufacturer: 'Pfizer Inc.',
            origin: {
                facility: 'Pfizer Manufacturing NY',
                address: '235 E 42nd St, New York, NY',
                coordinates: { lat: 40.7506, lng: -73.9756 }
            },
            destination: {
                facility: 'Jackson Memorial Hospital',
                address: '1611 NW 12th Ave, Miami, FL',
                coordinates: { lat: 25.7945, lng: -80.2103 }
            },
            temperatureRequirements: {
                min: -80,
                max: -60,
                unit: 'celsius'
            },
            checkpoints: [
                { location: 'NY Manufacturing', temp: -70, timestamp: '2026-01-05T08:00:00Z' },
                { location: 'JFK Cold Storage', temp: -72, timestamp: '2026-01-05T14:30:00Z' },
                { location: 'MIA Airport Hub', temp: -68, timestamp: '2026-01-05T18:45:00Z' },
                { location: 'Hospital Pharmacy', temp: -71, timestamp: '2026-01-06T09:15:00Z' }
            ]
        });

        console.log('✅ Cold chain tracked:', tracking);
        // { compliant: true, tempViolations: 0, eta: '2026-01-06T10:00:00Z' }

        return tracking;
    } catch (error) {
        console.error('❌ Error tracking supply:', error.message);
    }
}

// Example 3: Access patient medical records (HIPAA compliant)
async function accessMedicalRecords() {
    try {
        const records = await bezhas.healthcare.readMedicalRecords({
            patientId: 'PAT-987654',
            requesterId: 'DR-FL-12345',
            recordTypes: ['lab_results', 'imaging', 'prescriptions'],
            dateRange: {
                start: '2025-01-01',
                end: '2026-01-06'
            },
            auditReason: 'routine_checkup'
        });

        console.log('✅ Medical records accessed:', records);
        // { recordCount: 12, accessLogged: true, encryptionStatus: 'AES-256' }

        return records;
    } catch (error) {
        console.error('❌ Error accessing records:', error.message);
    }
}

// Example 4: HIPAA compliance audit
async function runComplianceAudit() {
    try {
        const audit = await bezhas.healthcare.auditCompliance({
            facilityId: 'HOSP-JACKSON-MIA',
            auditPeriod: {
                start: '2025-12-01',
                end: '2026-01-06'
            },
            auditScope: [
                'data_access_logs',
                'encryption_status',
                'breach_incidents',
                'staff_training'
            ]
        });

        console.log('✅ HIPAA audit completed:', audit);
        // { compliant: true, violations: 0, score: 98.5, nextAuditDue: '2026-04-01' }

        return audit;
    } catch (error) {
        console.error('❌ Error running audit:', error.message);
    }
}

// Run complete healthcare workflow
async function runHealthcareWorkflow() {
    console.log('🏥 Starting Healthcare Supply Chain Workflow...\n');

    // Step 1: Verify prescription
    await verifyPrescription();

    // Step 2: Track vaccine delivery
    await trackVaccineColdChain();

    // Step 3: Access patient records
    await accessMedicalRecords();

    // Step 4: Run compliance audit
    await runComplianceAudit();

    console.log('\n✅ Healthcare workflow completed!');
}

// Execute
runHealthcareWorkflow();

module.exports = {
    verifyPrescription,
    trackVaccineColdChain,
    accessMedicalRecords,
    runComplianceAudit
};
