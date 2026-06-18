"""
iso20022_adapter — turn an institutional payment message into a BeZhas settlement.

Completes the connector trio (customs / naval / **institutions**). Banks and PSPs
emit ISO 20022 XML (SEPA `camt.054` credit notification, `pain.001` initiation) or
SWIFT `MT103`, not JSON. This adapter parses a credit and maps it onto the payload
the BeZhas bank webhook (`POST /api/webhooks/bank`) expects:

    { iban, amountCents, currency, reference, walletAddress, eventId }

…and signs it with the same HMAC-SHA256 scheme the backend verifies
(api/routes/webhooks.js verifyHmac — bare hex over the *compact* JSON body).

Pure stdlib (xml.etree, hmac, re). Settlement currency is BEZ-Coin v1.

NOTE: the live bank webhook currently accepts only USD (it rejects other
currencies until an FX oracle lands), while SEPA is EUR. The parser extracts the
real currency; gate on it before submitting in production.
"""

from __future__ import annotations

import re
import hmac
import json
import hashlib
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional


class CreditEntry:
    __slots__ = ("amount", "currency", "reference", "debtor", "debtor_iban", "creditor_iban")

    def __init__(self, amount, currency, reference=None, debtor=None, debtor_iban=None, creditor_iban=None):
        self.amount = amount
        self.currency = currency
        self.reference = reference
        self.debtor = debtor
        self.debtor_iban = debtor_iban
        self.creditor_iban = creditor_iban

    def as_dict(self) -> Dict[str, Any]:
        return {
            "amount": self.amount, "currency": self.currency, "reference": self.reference,
            "debtor": self.debtor, "debtorIban": self.debtor_iban, "creditorIban": self.creditor_iban,
        }


def _local(tag: str) -> str:
    """Strip the XML namespace: '{urn...}Ntry' -> 'Ntry'."""
    return tag.rsplit("}", 1)[-1]


def _find(el, name: str):
    for child in el.iter():
        if _local(child.tag) == name:
            return child
    return None


def _find_all(el, name: str):
    return [c for c in el.iter() if _local(c.tag) == name]


def parse_camt(xml: str) -> List[CreditEntry]:
    """Parse a camt.052/053/054 and return every CREDIT (CRDT) entry."""
    root = ET.fromstring(xml.encode("utf-8") if isinstance(xml, str) else xml)
    entries: List[CreditEntry] = []
    for ntry in _find_all(root, "Ntry"):
        ind = _find(ntry, "CdtDbtInd")
        if ind is None or (ind.text or "").strip().upper() != "CRDT":
            continue
        amt_el = _find(ntry, "Amt")
        amount = _num(amt_el.text) if amt_el is not None else None
        currency = amt_el.get("Ccy") if amt_el is not None else None

        ref = None
        for name in ("EndToEndId", "InstrId", "TxId", "AcctSvcrRef"):
            node = _find(ntry, name)
            if node is not None and node.text and node.text.strip().upper() != "NOTPROVIDED":
                ref = node.text.strip()
                break

        debtor = None
        dbtr = _find(ntry, "Dbtr")
        if dbtr is not None:
            nm = _find(dbtr, "Nm")
            debtor = nm.text.strip() if nm is not None and nm.text else None

        entries.append(CreditEntry(amount, currency, ref, debtor))
    return entries


def parse_mt103(text: str) -> CreditEntry:
    """Parse a SWIFT MT103 single customer credit transfer."""
    def field(tag: str) -> Optional[str]:
        m = re.search(r":" + re.escape(tag) + r":(.*?)(?=\n:|\n-|\Z)", text, re.S)
        return m.group(1).strip() if m else None

    amount = currency = None
    f32a = field("32A")  # YYMMDD + CCY(3) + amount (comma decimal)
    if f32a:
        m = re.match(r"\d{6}([A-Z]{3})([\d,\.]+)", f32a.replace("\n", ""))
        if m:
            currency = m.group(1)
            amount = _num(m.group(2).replace(",", "."))
    reference = field("20")
    remittance = field("70")
    beneficiary = field("59")
    return CreditEntry(amount, currency, reference or remittance, debtor=field("50K") or field("50A"),
                       creditor_iban=_iban(beneficiary))


def to_bank_event(entry: CreditEntry, wallet_address: str, event_id: str,
                  iban: Optional[str] = None) -> Dict[str, Any]:
    """Map a parsed credit to the /api/webhooks/bank payload."""
    if entry.amount is None:
        raise ValueError("credit entry has no amount")
    return {
        "iban": iban or entry.creditor_iban or "",
        "amountCents": int(round(entry.amount * 100)),
        "currency": entry.currency or "EUR",
        "reference": entry.reference or "",
        "walletAddress": wallet_address,
        "eventId": event_id,
    }


def sign_bank_event(payload: Dict[str, Any], secret: str) -> str:
    """
    HMAC-SHA256 (bare hex) over the COMPACT JSON body — matches what the backend
    re-stringifies and verifies (JSON.stringify has no spaces). Send the body with
    the same separators so the signature matches on the wire.
    """
    body = compact_json(payload)
    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


def compact_json(payload: Dict[str, Any]) -> str:
    """JSON with no whitespace — byte-compatible with JS JSON.stringify."""
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)


def _num(s):
    try:
        return float(str(s).strip())
    except (ValueError, TypeError):
        return None


def _iban(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    m = re.search(r"\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b", s.replace(" ", ""))
    return m.group(1) if m else None
