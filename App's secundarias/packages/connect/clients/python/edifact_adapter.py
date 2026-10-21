"""
edifact_adapter — turn a UN/EDIFACT customs message into a BeZhas B-UID transaction.

This is the concrete bridge behind clients/CONNECTORS.md: customs brokers and port
systems emit EDIFACT, not JSON. This adapter tokenizes a CUSDEC (Customs
Declaration) and maps the relevant segments onto the `cargolink.create_tx` body —
the same normalized shape api/services/cargoLinkPosConnector.normalizeOrder builds.

Pure stdlib. Tolerant by design: real CUSDEC files vary by national customs
profile (AEAT in Spain, NCTS in the EU), so we extract what is reliably present
(declaration ref, parties, measurements, value) and leave the rest as metadata.

    from bezhas_connect import BeZhasConnect
    from edifact_adapter import cusdec_to_tx, submit_cusdec
    tx = cusdec_to_tx(open("decl.edi").read())
    submit_cusdec(BeZhasConnect(api_key=...), open("decl.edi").read(), role_key="customs_...")

EDIFACT delimiters (defaults; overridden by a UNA segment if present):
    segment terminator  '      element separator  +
    component separator  :      release/escape     ?
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


class Segment:
    __slots__ = ("tag", "elements")

    def __init__(self, tag: str, elements: List[List[str]]):
        self.tag = tag
        self.elements = elements  # list of elements, each a list of components

    def el(self, i: int, j: int = 0, default: str = "") -> str:
        """Component j of element i, or default."""
        if i < len(self.elements) and j < len(self.elements[i]):
            return self.elements[i][j]
        return default

    def __repr__(self) -> str:
        return f"<Segment {self.tag} {self.elements}>"


def _delimiters(edifact: str):
    # UNA segment, when present, redefines the service characters.
    # Layout: UNA + comp + elem + decimal + release + (repeat/space) + segterm
    if edifact[:3] == "UNA" and len(edifact) >= 9:
        comp, elem, _dec, release, _rep, segterm = (edifact[3], edifact[4], edifact[5],
                                                     edifact[6], edifact[7], edifact[8])
        return segterm, elem, comp, release
    return "'", "+", ":", "?"


def parse_segments(edifact: str) -> List[Segment]:
    """Tokenize an EDIFACT interchange into segments, honoring the release char."""
    segterm, elemsep, compsep, release = _delimiters(edifact)
    body = edifact
    if body[:3] == "UNA":
        # drop the 9-char UNA segment itself before parsing the rest
        body = body[9:]

    segments: List[Segment] = []
    for raw in _split(body, segterm, release):
        raw = raw.strip("\r\n ").strip()
        if not raw or raw == "UNA":
            continue
        # Split segment -> elements -> components, preserving escape sequences at
        # every level; unescape only at the leaf (component) so an escaped
        # delimiter survives the outer splits intact.
        elements = [[_unescape(c, release) for c in _split(e, compsep, release)]
                    for e in _split(raw, elemsep, release)]
        tag = elements[0][0] if elements and elements[0] else ""
        segments.append(Segment(tag, elements[1:]))  # elements after the tag
    return segments


def _split(s: str, sep: str, release: str) -> List[str]:
    """Split on an unescaped `sep`, preserving escape sequences in the pieces."""
    out, buf, i = [], [], 0
    while i < len(s):
        ch = s[i]
        if ch == release and i + 1 < len(s):
            buf.append(ch)          # keep the release char...
            buf.append(s[i + 1])    # ...and the escaped char, for the leaf to resolve
            i += 2
            continue
        if ch == sep:
            out.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
        i += 1
    out.append("".join(buf))
    return out


def _unescape(s: str, release: str) -> str:
    """Resolve release sequences: `?+` -> `+`, `??` -> `?`, etc."""
    out, i = [], 0
    while i < len(s):
        if s[i] == release and i + 1 < len(s):
            out.append(s[i + 1])
            i += 2
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


def cusdec_to_tx(edifact: str) -> Dict[str, Any]:
    """
    Map a CUSDEC declaration to the create_tx body.

    Segments used (when present):
      BGM  — document/declaration number       -> posRef
      NAD  — name & address (CZ=consignor, CN=consignee) -> origin / destination
      MEA  — measurements (AAE/WT gross weight) -> cargo.weight
      MOA  — monetary amount                    -> cargo.value
      CUX  — currencies                         -> cargo.currency
    """
    segs = parse_segments(edifact)
    by_tag: Dict[str, List[Segment]] = {}
    for s in segs:
        by_tag.setdefault(s.tag, []).append(s)

    def first(tag: str) -> Optional[Segment]:
        return by_tag.get(tag, [None])[0]

    # BGM: element 1 component 0 is the document number
    bgm = first("BGM")
    pos_ref = (bgm.el(1, 0) or bgm.el(0, 0)) if bgm else ""

    origin = destination = None
    for nad in by_tag.get("NAD", []):
        qualifier = nad.el(0, 0)          # party function code
        party = nad.el(1, 0) or nad.el(2, 0)  # id or name
        if qualifier in ("CZ", "SE", "CS"):      # consignor / seller / consolidator
            origin = origin or party
        elif qualifier in ("CN", "BY", "DP"):    # consignee / buyer / delivery
            destination = destination or party

    weight = None
    for mea in by_tag.get("MEA", []):
        # MEA+AAE+G+KGM:1234.5  -> measurement purpose, dimension, value
        if mea.el(0, 0) in ("AAE", "WT", "AAF"):
            val = mea.el(2, 1) or mea.el(2, 0)
            weight = _num(val) if val else weight

    value = None
    for moa in by_tag.get("MOA", []):
        # MOA+39:1500.00  -> amount type qualifier : amount
        amt = moa.el(0, 1)
        if amt:
            value = _num(amt)
            break

    cux = first("CUX")
    currency = cux.el(0, 1) if cux else None

    body: Dict[str, Any] = {
        "posRef": pos_ref,
        "origin": origin,
        "destination": destination,
        "cargo": {"weight": weight, "value": value, "currency": currency},
        "posProvider": "edifact-cusdec",
    }
    return body


def _num(s: str):
    try:
        f = float(s)
        return int(f) if f.is_integer() else f
    except (ValueError, TypeError):
        return None


def submit_cusdec(client, edifact: str, role_key: Optional[str] = None):
    """Parse a CUSDEC and create the B-UID transaction in one call."""
    body = cusdec_to_tx(edifact)
    if not body["posRef"]:
        raise ValueError("CUSDEC has no BGM document number — cannot derive posRef")
    return client.cargolink.create_tx(body, role_key=role_key)


# ══════════════════════════════════════════════════════════════════════════════
#  Naval / liner EDIFACT — status advances on an existing B-UID.
#
#  Unlike CUSDEC (which creates), these messages move a B-UID along the lifecycle
#  CREATED → CUSTOMS_CLEARED → STOWED → DEPARTED → IN_TRANSIT → DELIVERED.
#  `advance_tx` auto-advances to the NEXT state per the server's TRANSITIONS, so
#  the body must carry the validator fields for that state and the role key must
#  match the transition's role. The routing table below encodes both.
# ══════════════════════════════════════════════════════════════════════════════

# message type (from UNH) -> { role, state it validates into }
MESSAGE_ROUTING = {
    "CUSDEC": {"kind": "create", "role": "pos"},
    "IFTMIN": {"kind": "create", "role": "pos"},        # booking instruction ≈ order entry
    "COPARN": {"kind": "advance", "role": "carrier", "state": "STOWED"},
    "COARRI": {"kind": "advance", "role": "carrier", "state": "DEPARTED"},
    "CODECO": {"kind": "advance", "role": "carrier", "state": "DEPARTED"},
    "IFTSTA": {"kind": "advance", "role": "logistics", "state": "IN_TRANSIT"},  # may upgrade to DELIVERED
}


def _index(edifact: str) -> Dict[str, List[Segment]]:
    by_tag: Dict[str, List[Segment]] = {}
    for s in parse_segments(edifact):
        by_tag.setdefault(s.tag, []).append(s)
    return by_tag


def message_type(edifact: str) -> Optional[str]:
    """The 6-letter message type from the UNH segment (CUSDEC, COPARN, IFTSTA…)."""
    unh = _index(edifact).get("UNH", [None])[0]
    return (unh.el(1, 0) or None) if unh else None


def _references(by_tag) -> Dict[str, str]:
    """RFF qualifier -> value, e.g. {'BM': 'BOOKING123', 'BN': '...'}."""
    refs = {}
    for rff in by_tag.get("RFF", []):
        q, v = rff.el(0, 0), rff.el(0, 1)
        if q and v:
            refs[q] = v
    return refs


def _transport(by_tag) -> Dict[str, Any]:
    """Vessel / voyage / carrier from the TDT segment."""
    tdt = by_tag.get("TDT", [None])[0]
    if not tdt:
        return {}
    voyage = tdt.el(1, 0) or None
    carrier = tdt.el(4, 0) or None
    # Vessel name lives in the transport-identification composite (C222), whose
    # element position shifts by national profile. Pick the last component that
    # actually reads like a name (has a letter, length > 3) — this skips numeric
    # ids/agency codes and the carrier code.
    vessel = None
    for el in tdt.elements:
        if el and el[-1] and len(el[-1]) > 3 and any(c.isalpha() for c in el[-1]):
            vessel = el[-1]
    return {"vessel": vessel, "voyage": voyage, "carrier": carrier}


def _ports(by_tag) -> Dict[str, Optional[str]]:
    """LOC qualifiers: 9 = place of departure/loading, 11 = place of discharge."""
    out = {"departurePort": None, "dischargePort": None}
    for loc in by_tag.get("LOC", []):
        q, code = loc.el(0, 0), loc.el(1, 0)
        if q == "9" and code:
            out["departurePort"] = out["departurePort"] or code
        elif q == "11" and code:
            out["dischargePort"] = out["dischargePort"] or code
    return out


def _gross_weight(by_tag):
    for mea in by_tag.get("MEA", []):
        if mea.el(0, 0) in ("AAE", "WT", "AAF"):
            v = mea.el(2, 1) or mea.el(2, 0)
            if v:
                return _num(v)
    return None


def _is_delivered(by_tag) -> bool:
    """IFTSTA carries a status (STS). Treat delivery/POD codes as terminal."""
    delivered_codes = {"7", "44", "45", "AG"}  # common 'delivered'/'POD' status codes
    for sts in by_tag.get("STS", []):
        for el in sts.elements:
            for comp in el:
                if comp in delivered_codes or comp.upper() in ("DELIVERED", "POD"):
                    return True
    return False


def edifact_to_action(edifact: str) -> Dict[str, Any]:
    """
    Parse any supported EDIFACT message into an actionable dict:
      { messageType, kind: 'create'|'advance', role, ref, body }
    `ref` is the booking/transport reference (RFF BM/BN or BGM) used to locate
    the B-UID. `role` is the role-scoped key the caller must use.
    """
    mtype = message_type(edifact)
    route = MESSAGE_ROUTING.get(mtype or "")
    if not route:
        raise ValueError(f"Unsupported or unrecognized EDIFACT message type: {mtype!r}")

    by_tag = _index(edifact)
    refs = _references(by_tag)
    bgm = by_tag.get("BGM", [None])[0]
    ref = refs.get("BM") or refs.get("BN") or refs.get("CN") or (bgm.el(1, 0) if bgm else None)

    if route["kind"] == "create":
        body = cusdec_to_tx(edifact)
        body["posProvider"] = f"edifact-{(mtype or '').lower()}"
        return {"messageType": mtype, "kind": "create", "role": route["role"], "ref": body["posRef"], "body": body}

    # advance
    state = route["state"]
    role = route["role"]
    body: Dict[str, Any] = {}

    if state == "STOWED":
        # COPARN announces equipment + gross mass; place it at container centre so
        # the COG check verifies (no per-item positions are carried in COPARN).
        weight = _gross_weight(by_tag) or 1
        container = {"length": 12, "width": 2.4}
        body = {
            "container": container,
            "items": [{"x": container["length"] / 2, "y": container["width"] / 2, "weight": weight}],
        }
    elif state == "DEPARTED":
        t = _transport(by_tag)
        p = _ports(by_tag)
        body = {"vessel": t.get("vessel"), "voyage": t.get("voyage"), "departurePort": p["departurePort"]}
    elif state == "IN_TRANSIT":
        t = _transport(by_tag)
        if _is_delivered(by_tag):
            state, role = "DELIVERED", "lastmile"
            # No geo in IFTSTA — record the carrier status reference as the POD hash.
            body = {"podHash": ref or refs.get("ACW") or "IFTSTA-STATUS"}
        else:
            body = {"trackingRef": ref or refs.get("CN"), "carrier": t.get("carrier")}

    return {"messageType": mtype, "kind": "advance", "role": role, "state": state, "ref": ref, "body": body}


def submit_edifact(client, edifact: str, role_key: Optional[str] = None, b_uid: Optional[str] = None):
    """
    Dispatch any supported EDIFACT message to the right lifecycle call.

    create  -> cargolink.create_tx
    advance -> cargolink.advance_tx(b_uid, ...)  (b_uid defaults to the parsed ref)

    The caller supplies the role-scoped `role_key` matching action['role'].
    """
    action = edifact_to_action(edifact)
    if action["kind"] == "create":
        if not action["ref"]:
            raise ValueError(f"{action['messageType']} has no document number — cannot derive posRef")
        return client.cargolink.create_tx(action["body"], role_key=role_key)

    target = b_uid or action["ref"]
    if not target:
        raise ValueError(f"{action['messageType']} has no booking/transport reference — pass b_uid explicitly")
    return client.cargolink.advance_tx(target, action["body"], role_key=role_key)
