"""Tests for the ISO 20022 / SWIFT institutional adapter. `python -m unittest`."""

import hmac
import json
import hashlib
import unittest

from iso20022_adapter import (
    parse_camt, parse_mt103, to_bank_event, sign_bank_event, compact_json,
)

CAMT054 = """<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.08">
  <BkToCstmrDbtCdtNtfctn><Ntfctn>
    <Ntry>
      <Amt Ccy="EUR">1500.00</Amt>
      <CdtDbtInd>CRDT</CdtDbtInd>
      <NtryDtls><TxDtls>
        <Refs><EndToEndId>BEZ-INV-789</EndToEndId></Refs>
        <RltdPties><Dbtr><Nm>ACME ALGECIRAS SL</Nm></Dbtr></RltdPties>
      </TxDtls></NtryDtls>
    </Ntry>
    <Ntry>
      <Amt Ccy="EUR">99.00</Amt>
      <CdtDbtInd>DBIT</CdtDbtInd>
    </Ntry>
  </Ntfctn></BkToCstmrDbtCdtNtfctn>
</Document>"""

MT103 = (
    ":20:BEZREF0001\n"
    ":23B:CRED\n"
    ":32A:260618EUR1500,00\n"
    ":50K:/ES7714650100911766376210\nACME ALGECIRAS SL\n"
    ":59:/ES9121000418450200051332\nBEZHAS SL\n"
    ":70:INVOICE BEZ-INV-789\n"
    ":71A:OUR\n"
)


class CamtTests(unittest.TestCase):
    def test_only_credit_entries_parsed(self):
        entries = parse_camt(CAMT054)
        self.assertEqual(len(entries), 1)               # DBIT entry skipped
        e = entries[0]
        self.assertEqual(e.amount, 1500.0)
        self.assertEqual(e.currency, "EUR")
        self.assertEqual(e.reference, "BEZ-INV-789")
        self.assertEqual(e.debtor, "ACME ALGECIRAS SL")


class Mt103Tests(unittest.TestCase):
    def test_parses_amount_currency_reference(self):
        e = parse_mt103(MT103)
        self.assertEqual(e.currency, "EUR")
        self.assertEqual(e.amount, 1500.0)
        self.assertEqual(e.reference, "BEZREF0001")
        self.assertEqual(e.creditor_iban, "ES9121000418450200051332")


class BankEventTests(unittest.TestCase):
    def test_maps_to_bank_webhook_payload(self):
        e = parse_camt(CAMT054)[0]
        payload = to_bank_event(e, wallet_address="0xabc", event_id="evt_1",
                                iban="ES7714650100911766376210")
        self.assertEqual(payload["amountCents"], 150000)
        self.assertEqual(payload["currency"], "EUR")
        self.assertEqual(payload["reference"], "BEZ-INV-789")
        self.assertEqual(payload["walletAddress"], "0xabc")
        self.assertEqual(payload["eventId"], "evt_1")

    def test_signature_matches_backend_compact_hmac(self):
        payload = {"iban": "ES77", "amountCents": 150000, "currency": "USD",
                   "reference": "R1", "walletAddress": "0xabc", "eventId": "evt_1"}
        sig = sign_bank_event(payload, "s3cr3t")
        # Backend computes hmac over JSON.stringify(body): compact, no spaces.
        body = json.dumps(payload, separators=(",", ":"))
        expected = hmac.new(b"s3cr3t", body.encode(), hashlib.sha256).hexdigest()
        self.assertEqual(sig, expected)
        self.assertNotIn(" ", compact_json(payload))   # truly compact


if __name__ == "__main__":
    unittest.main()
