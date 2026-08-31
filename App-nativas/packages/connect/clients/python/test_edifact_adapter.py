"""Tests for the EDIFACT CUSDEC -> B-UID adapter. `python -m unittest`."""

import json
import unittest
from unittest import mock

import bezhas_connect as bz
from edifact_adapter import (
    parse_segments, cusdec_to_tx, submit_cusdec,
    message_type, edifact_to_action, submit_edifact,
)

# COPARN — container announcement (booking BM, gross weight 24t).
COPARN = (
    "UNH+1+COPARN:D:95B:UN'"
    "BGM+126+ANN0001+9'"
    "RFF+BM:ESDCL2026000789'"
    "EQD+CN+MSCU1234567+2200:102:5+++5'"
    "MEA+AAE+G+KGM:24000'"
    "UNT+6+1'"
)

# CODECO — gate movement / loaded onto vessel MSC OSCAR, voyage 0915E from Algeciras.
CODECO = (
    "UNH+1+CODECO:D:95B:UN'"
    "BGM+34+GATE0001+9'"
    "RFF+BM:ESDCL2026000789'"
    "TDT+20+0915E+1++MSC:172:20++9123456:146:11:MSC OSCAR'"
    "LOC+9+ESALG:139:6'"
    "LOC+11+MAPTM:139:6'"
    "UNT+6+1'"
)

# IFTSTA — in-transit status, tracking ref via RFF.
IFTSTA_TRANSIT = (
    "UNH+1+IFTSTA:D:95B:UN'"
    "BGM+23+STAT0001+9'"
    "RFF+BM:ESDCL2026000789'"
    "STS+1+3'"
    "TDT+30++3++DHL:172:20'"
    "UNT+5+1'"
)

# IFTSTA — delivered (POD status code 7).
IFTSTA_DELIVERED = (
    "UNH+1+IFTSTA:D:95B:UN'"
    "BGM+23+STAT0002+9'"
    "RFF+BM:ESDCL2026000789'"
    "STS+1+7'"
    "UNT+4+1'"
)

# A compact but realistic CUSDEC interchange (Spain/AEAT-style), default delimiters.
SAMPLE = (
    "UNB+UNOC:3+BROKER123:14+AEAT:ZZ+260618:1530+REF0001'"
    "UNH+1+CUSDEC:D:96B:UN'"
    "BGM+929+ESDCL2026000789+9'"
    "NAD+CZ+ACME ALGECIRAS SL::92'"
    "NAD+CN+TANGER MED LOGISTICS::92'"
    "MEA+AAE+G+KGM:450'"
    "MOA+39:15000.00'"
    "CUX+2:EUR:9'"
    "UNT+8+1'"
    "UNZ+1+REF0001'"
)


class ParseTests(unittest.TestCase):
    def test_tokenizes_segments(self):
        segs = parse_segments(SAMPLE)
        tags = [s.tag for s in segs]
        self.assertIn("BGM", tags)
        self.assertIn("NAD", tags)
        self.assertEqual(sum(1 for t in tags if t == "NAD"), 2)

    def test_release_char_is_honored(self):
        # A '?+' inside a value must not split the element.
        segs = parse_segments("BGM+ABC?+DEF+9'")
        bgm = [s for s in segs if s.tag == "BGM"][0]
        self.assertEqual(bgm.el(0, 0), "ABC+DEF")

    def test_una_overrides_delimiters(self):
        # Custom delimiters: comp=: elem=| seg=~
        edi = "UNA:|.? ~BGM|929|ESDCL1~"
        segs = parse_segments(edi)
        bgm = [s for s in segs if s.tag == "BGM"][0]
        self.assertEqual(bgm.el(1, 0), "ESDCL1")


class MappingTests(unittest.TestCase):
    def test_cusdec_maps_to_tx_body(self):
        body = cusdec_to_tx(SAMPLE)
        self.assertEqual(body["posRef"], "ESDCL2026000789")
        self.assertEqual(body["origin"], "ACME ALGECIRAS SL")
        self.assertEqual(body["destination"], "TANGER MED LOGISTICS")
        self.assertEqual(body["cargo"]["weight"], 450)
        self.assertEqual(body["cargo"]["value"], 15000)
        self.assertEqual(body["cargo"]["currency"], "EUR")
        self.assertEqual(body["posProvider"], "edifact-cusdec")

    def test_submit_calls_create_tx_with_role_key(self):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["url"] = req.full_url
            captured["auth"] = req.headers.get("Authorization")
            captured["body"] = json.loads(req.data)
            import io
            return _FakeResp(json.dumps({"success": True, "transaction": {"b_uid": "B-1"}}).encode())

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            client = bz.BeZhasConnect(api_key="sk", base_url="https://api.example")
            out = submit_cusdec(client, SAMPLE, role_key="customs_key_9")

        self.assertEqual(out["transaction"]["b_uid"], "B-1")
        self.assertEqual(captured["url"], "https://api.example/api/cargolink/v1/tx")
        self.assertEqual(captured["auth"], "Bearer customs_key_9")
        self.assertEqual(captured["body"]["posRef"], "ESDCL2026000789")

    def test_missing_bgm_raises(self):
        client = bz.BeZhasConnect(api_key="sk")
        with self.assertRaises(ValueError):
            submit_cusdec(client, "UNH+1+CUSDEC:D:96B:UN'NAD+CZ+X::92'", role_key="k")


class NavalTests(unittest.TestCase):
    def test_message_type_detection(self):
        self.assertEqual(message_type(COPARN), "COPARN")
        self.assertEqual(message_type(CODECO), "CODECO")
        self.assertEqual(message_type(IFTSTA_TRANSIT), "IFTSTA")

    def test_coparn_advances_to_stowed_as_carrier(self):
        a = edifact_to_action(COPARN)
        self.assertEqual(a["kind"], "advance")
        self.assertEqual(a["role"], "carrier")
        self.assertEqual(a["state"], "STOWED")
        self.assertEqual(a["ref"], "ESDCL2026000789")
        # one positioned item carrying the 24t gross weight, centred so COG verifies
        self.assertEqual(a["body"]["items"][0]["weight"], 24000)

    def test_codeco_advances_to_departed_with_vessel_and_voyage(self):
        a = edifact_to_action(CODECO)
        self.assertEqual(a["state"], "DEPARTED")
        self.assertEqual(a["role"], "carrier")
        self.assertEqual(a["body"]["voyage"], "0915E")
        self.assertEqual(a["body"]["vessel"], "MSC OSCAR")
        self.assertEqual(a["body"]["departurePort"], "ESALG")

    def test_iftsta_in_transit_as_logistics(self):
        a = edifact_to_action(IFTSTA_TRANSIT)
        self.assertEqual(a["state"], "IN_TRANSIT")
        self.assertEqual(a["role"], "logistics")
        self.assertEqual(a["body"]["trackingRef"], "ESDCL2026000789")
        self.assertEqual(a["body"]["carrier"], "DHL")

    def test_iftsta_delivered_upgrades_to_lastmile(self):
        a = edifact_to_action(IFTSTA_DELIVERED)
        self.assertEqual(a["state"], "DELIVERED")
        self.assertEqual(a["role"], "lastmile")
        self.assertEqual(a["body"]["podHash"], "ESDCL2026000789")

    def test_submit_edifact_calls_advance_with_ref_as_buid(self):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["url"] = req.full_url
            captured["auth"] = req.headers.get("Authorization")
            captured["body"] = json.loads(req.data)
            return _FakeResp(json.dumps({"success": True, "transaction": {"status": "DEPARTED"}}).encode())

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            client = bz.BeZhasConnect(api_key="sk", base_url="https://api.example")
            submit_edifact(client, CODECO, role_key="carrier_key")

        # advance_tx posts to /v1/tx/<ref>/advance with the carrier bearer
        self.assertEqual(captured["url"], "https://api.example/api/cargolink/v1/tx/ESDCL2026000789/advance")
        self.assertEqual(captured["auth"], "Bearer carrier_key")
        self.assertEqual(captured["body"]["vessel"], "MSC OSCAR")

    def test_unsupported_message_raises(self):
        with self.assertRaises(ValueError):
            edifact_to_action("UNH+1+ORDERS:D:96A:UN'BGM+220+PO1'")


class _FakeResp:
    def __init__(self, data): self._d = data
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def read(self): return self._d


if __name__ == "__main__":
    unittest.main()
