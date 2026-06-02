/**
 * BeZhas bank transfer account for manual FIAT payments.
 * Use this only as the receiver account for BeZhas invoices/orders.
 */
const BANK_TRANSFER_DETAILS = Object.freeze({
    beneficiaryAlias: 'bez.digital',
    iban: 'ES77 1465 0100 91 1766376210',
    bic: 'INGDESMMXXX',
    currency: 'EUR',
    paymentRail: 'SEPA',
});

function buildBankTransferInstructions(reference) {
    return {
        ...BANK_TRANSFER_DETAILS,
        reference,
        instructions: 'Use the reference exactly so BeZhas can reconcile the bank transfer with the pending payment.',
    };
}

module.exports = {
    BANK_TRANSFER_DETAILS,
    buildBankTransferInstructions,
};
