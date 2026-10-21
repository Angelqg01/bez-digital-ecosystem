"""
bezhas_connect — BeZhas integration client for Python.

The same outward-facing surface as the JS @bezhas/connect, for the platforms that
speak Python: logistics data pipelines, customs/broker middleware, ERP glue.

Zero third-party dependencies — uses only the standard library (urllib, hmac),
so it drops into locked-down customs/bank environments where `pip install` is not
allowed. Python >= 3.8.

    from bezhas_connect import BeZhasConnect
    bz = BeZhasConnect(api_key="sk_live_...")
    order = bz.pay.buy(amount_usd=49.9, payment_method="card", email="a@b.com")
    print(order["checkoutUrl"])

Auth maps 1:1 to the gateway middleware:
    api_key    -> x-api-key       (registered, scoped app — server-to-server)
    user_token -> Authorization   (optional SSO JWT)
CargoLink role keys are passed per call as `role_key` (they ARE the bearer).
"""

from __future__ import annotations

import hmac
import json
import hashlib
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Mapping, Optional

DEFAULT_BASE_URL = "https://api.bez.digital"
PAYMENT_METHODS = ("card", "crypto", "qr", "bank")
RECEIVE_METHODS = ("card", "bank", "crypto")


class BeZhasApiError(Exception):
    """Raised for any non-2xx API response. Carries status + parsed body."""

    def __init__(self, message: str, status: int = 0, body: Any = None, endpoint: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.body = body
        self.endpoint = endpoint


class BeZhasConnect:
    def __init__(
        self,
        api_key: Optional[str] = None,
        user_token: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 15.0,
    ):
        self.api_key = api_key
        self.user_token = user_token
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.pay = _Pay(self)
        self.cargolink = _CargoLink(self)

    def request(
        self,
        method: str,
        path: str,
        query: Optional[Mapping[str, Any]] = None,
        body: Any = None,
        bearer: Optional[str] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Any:
        url = self.base_url + path
        if query:
            clean = {k: v for k, v in query.items() if v is not None}
            if clean:
                url += "?" + urllib.parse.urlencode(clean)

        hdrs = {"Accept": "application/json"}
        if headers:
            hdrs.update(headers)
        if self.api_key:
            hdrs["x-api-key"] = self.api_key
        token = bearer or self.user_token
        if token:
            hdrs["Authorization"] = "Bearer " + token

        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            hdrs["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8") if e.fp else ""
            try:
                parsed = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                parsed = {"raw": raw}
            msg = (parsed or {}).get("error") or (parsed or {}).get("message") or f"{e.code} {e.reason}"
            raise BeZhasApiError(f"BeZhas API {e.code}: {msg}", status=e.code, body=parsed, endpoint=path)
        except urllib.error.URLError as e:
            raise BeZhasApiError(f"Network error calling {path}: {e.reason}", status=0, endpoint=path)


class _Pay:
    def __init__(self, client: BeZhasConnect):
        self._c = client

    def buy(self, amount_usd: float, payment_method: str, wallet_address: Optional[str] = None,
            stripe_use_case: Optional[str] = None, email: Optional[str] = None) -> Any:
        if payment_method not in PAYMENT_METHODS:
            raise ValueError(f"payment_method must be one of {PAYMENT_METHODS}")
        if not amount_usd >= 1:
            raise ValueError("amount_usd must be >= 1")
        return self._c.request("POST", "/api/gateway/v1/payments/buy", body={
            "amountUSD": amount_usd,
            "paymentMethod": payment_method,
            "walletAddress": wallet_address,
            "stripeUseCase": stripe_use_case,
            "email": email,
        })

    def sell(self, wallet_address: str, amount_bez: float, receive_method: str) -> Any:
        if receive_method not in RECEIVE_METHODS:
            raise ValueError(f"receive_method must be one of {RECEIVE_METHODS}")
        return self._c.request("POST", "/api/gateway/v1/payments/sell", body={
            "walletAddress": wallet_address, "amountBEZ": amount_bez, "receiveMethod": receive_method,
        })

    def send(self, sender: str, recipient: str, amount: float, note: Optional[str] = None) -> Any:
        return self._c.request("POST", "/api/gateway/v1/payments/send", body={
            "sender": sender, "recipient": recipient, "amount": amount, "note": note,
        })

    def history(self, address: str, limit: Optional[int] = None) -> Any:
        return self._c.request("GET", f"/api/gateway/v1/payments/history/{address}", query={"limit": limit})

    def tokenomics(self, amount_usd: Optional[float] = None, price_usd: Optional[float] = None) -> Any:
        return self._c.request("GET", "/api/gateway/v1/payments/tokenomics",
                               query={"amountUSD": amount_usd, "priceUSD": price_usd})

    def price(self) -> Any:
        return self._c.request("GET", "/api/gateway/v1/token/price")


class _CargoLink:
    def __init__(self, client: BeZhasConnect, role_key: Optional[str] = None):
        self._c = client
        self.role_key = role_key

    def with_role_key(self, role_key: str) -> "_CargoLink":
        return _CargoLink(self._c, role_key)

    def _bearer(self, role_key: Optional[str]) -> Optional[str]:
        return role_key or self.role_key

    def health(self) -> Any:
        return self._c.request("GET", "/api/cargolink/health")

    def link_pos(self, base_url: str, provider: str = "generic", orders_path: str = "/orders",
                 api_key: Optional[str] = None, role_key: Optional[str] = None) -> Any:
        return self._c.request("POST", "/api/cargolink/v1/pos/link",
                               body={"baseUrl": base_url, "provider": provider, "ordersPath": orders_path, "apiKey": api_key},
                               bearer=self._bearer(role_key))

    def get_pos_link(self, role_key: Optional[str] = None) -> Any:
        return self._c.request("GET", "/api/cargolink/v1/pos/link", bearer=self._bearer(role_key))

    def sync_orders(self, role_key: Optional[str] = None) -> Any:
        return self._c.request("POST", "/api/cargolink/v1/pos/sync", bearer=self._bearer(role_key))

    def create_tx(self, tx: Mapping[str, Any], role_key: Optional[str] = None) -> Any:
        return self._c.request("POST", "/api/cargolink/v1/tx", body=dict(tx), bearer=self._bearer(role_key))

    def list_tx(self, query: Optional[Mapping[str, Any]] = None, role_key: Optional[str] = None) -> Any:
        return self._c.request("GET", "/api/cargolink/v1/tx", query=query, bearer=self._bearer(role_key))

    def get_tx(self, b_uid: str, role_key: Optional[str] = None) -> Any:
        return self._c.request("GET", f"/api/cargolink/v1/tx/{b_uid}", bearer=self._bearer(role_key))

    def advance_tx(self, b_uid: str, body: Optional[Mapping[str, Any]] = None, role_key: Optional[str] = None) -> Any:
        return self._c.request("POST", f"/api/cargolink/v1/tx/{b_uid}/advance",
                               body=dict(body or {}), bearer=self._bearer(role_key))

    def register_webhook(self, url: str, events: list, role_key: Optional[str] = None) -> Any:
        return self._c.request("POST", "/api/cargolink/v1/webhooks/register",
                               body={"url": url, "events": events}, bearer=self._bearer(role_key))


# ── Webhook verification ────────────────────────────────────────────────────────
# Mirrors fanoutWebhooks() in api/services/cargoLinkLifecycle.js:
#   header  X-BeZhas-Signature: sha256=<hex(hmacSha256(secret, rawBody))>
SIGNATURE_HEADER = "X-BeZhas-Signature"
EVENT_HEADER = "X-BeZhas-Event"


def _normalize_signature(value: str) -> str:
    s = str(value).strip()
    return (s.split("=", 1)[1] if "=" in s else s).lower()


def verify_webhook(raw_body, signature: str, secret: str) -> bool:
    """Timing-safe HMAC-SHA256 verification. Accepts `sha256=<hex>` and bare hex."""
    if not secret or not signature:
        return False
    if isinstance(raw_body, str):
        raw_body = raw_body.encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, _normalize_signature(signature))
