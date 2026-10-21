"""Offline tests — patch urlopen, assert URL/headers/body + webhook HMAC. `python -m unittest`."""

import io
import json
import unittest
from unittest import mock

import bezhas_connect as bz


class FakeResponse(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self, *a): self.close()


def _ok(body):
    return mock.patch("urllib.request.urlopen", return_value=FakeResponse(json.dumps(body).encode()))


class PayTests(unittest.TestCase):
    def test_buy_posts_to_gateway_with_api_key(self):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["url"] = req.full_url
            captured["headers"] = req.headers
            captured["body"] = req.data
            return FakeResponse(json.dumps({"success": True, "paymentId": 7}).encode())

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            client = bz.BeZhasConnect(api_key="sk_test", base_url="https://api.example")
            out = client.pay.buy(amount_usd=49.9, payment_method="card", email="a@b.com")

        self.assertEqual(out["paymentId"], 7)
        self.assertEqual(captured["url"], "https://api.example/api/gateway/v1/payments/buy")
        # urllib title-cases header keys
        self.assertEqual(captured["headers"]["X-api-key"], "sk_test")
        self.assertEqual(json.loads(captured["body"])["paymentMethod"], "card")

    def test_buy_rejects_unknown_method_before_network(self):
        client = bz.BeZhasConnect(api_key="sk")
        with self.assertRaises(ValueError):
            client.pay.buy(amount_usd=10, payment_method="paypal")


class CargoLinkTests(unittest.TestCase):
    def test_sync_uses_role_key_as_bearer(self):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["url"] = req.full_url
            captured["auth"] = req.headers.get("Authorization")
            return FakeResponse(json.dumps({"success": True}).encode())

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            client = bz.BeZhasConnect(api_key="sk", base_url="https://api.example")
            client.cargolink.sync_orders(role_key="pos_key_123")

        self.assertEqual(captured["url"], "https://api.example/api/cargolink/v1/pos/sync")
        self.assertEqual(captured["auth"], "Bearer pos_key_123")


class WebhookTests(unittest.TestCase):
    def test_verify_matches_backend_and_prefix(self):
        secret = "s3cr3t"
        raw = json.dumps({"event": "ON_TRANSACTION_CREATED", "bUid": "B-1"})
        import hmac, hashlib
        hexsig = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
        self.assertTrue(bz.verify_webhook(raw, hexsig, secret))
        self.assertTrue(bz.verify_webhook(raw, f"sha256={hexsig}", secret))   # real wire form
        self.assertFalse(bz.verify_webhook(raw + " ", hexsig, secret))
        self.assertFalse(bz.verify_webhook(raw, hexsig, "wrong"))


if __name__ == "__main__":
    unittest.main()
