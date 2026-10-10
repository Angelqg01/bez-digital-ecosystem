# BeZhas — Litepaper

> Draft v0.1 | September 2026 | For review before publication.
> Written for an international, non-technical audience — first distribution target:
> UAE / Jebel Ali free-zone trade operators (see Step 3, market prioritization).
> Once approved, hash this file and register it via `IPRegistryNFT`
> (`smart-contracts/script/RegisterMicaMemo.s.sol` is a working template for that flow).

---

## 1. The problem

Cross-border trade runs on paper that doesn't trust itself. A container leaving
Algeciras for Jebel Ali carries a bill of lading, a certificate of origin, a customs
declaration, and an insurance policy — four documents, four systems, four chances
for fraud, loss, or a multi-day delay at the border. The cost isn't abstract: it's
demurrage fees, rejected shipments, and trade finance that can't move until paper
catches up with cargo that already arrived.

This is the same friction whether the port is in the Strait of Gibraltar or the
Arabian Gulf. BeZhas was built to remove it — not to sell blockchain, but to make
the paper trustworthy enough to stop needing four copies of it.

## 2. What BeZhas is

BeZhas is a business network with its own settlement layer: an EVM-compatible L2
(BEZ is live on Polygon today; BNB Chain will be connected through a bridge, and a
dedicated corporate-validator layer is in development) plus a set of purpose-built modules — customs clearance certificates,
shipment tracking, quality certification, land title, invoice factoring, parametric
insurance — that turn a paper process into a verifiable on-chain record.

The company using BeZhas doesn't need to understand any of that. It logs a
shipment, and the certificate that used to take days to verify becomes something
a customs officer, an insurer, or a bank can check in seconds.

## 3. Where it already runs

BeZhas is live, not hypothetical, on the Algeciras–Gibraltar corridor: customs
clearance and cargo traceability for freight forwarders and exporters moving goods
through one of Europe's busiest ports. That deployment is the proof of the model,
not a pilot.

**Expansion target: Jebel Ali / DMCC, UAE.** The same customs-fraud, same-delay
problem, at higher volume, in a jurisdiction whose regulator (VARA) has an active
memorandum of understanding with DMCC to move physical commodity trade on-chain.
BeZhas isn't asking that market to adopt something new — it's offering the tool
that market's own regulator is already pointing toward.

## 4. BEZ-Coin: what it's for

BEZ-Coin is the network's fuel, not a bet on a chart. Every transaction on the
network — registering a certificate, settling a cross-border payment, staking to
become a validator — runs on BEZ. Holding it is holding the right to use the
network; it is not a claim on BeZhas the company, and it does not entitle the
holder to any guaranteed return.

**Real, disclosed fee model** (from the platform's live fee configuration, not a
marketing number): every payment processed carries a 2.5% platform fee, split:

| Allocation | Share of the fee | Purpose |
|---|---|---|
| Burn | 40% | Permanently removes supply — deflationary pressure tied to real usage |
| Staking rewards | 28% | Paid to validators securing the network |
| DAO treasury | 20% | Funds ecosystem grants and development, governed on-chain |
| Auto-liquidity | 12% | Deepens DEX liquidity automatically |

This is "real yield" in the literal sense: staking rewards come from fees paid by
companies actually using the network, not from inflationary token emission.

## 5. Governance and validators

BeZhas runs a hybrid Proof-of-Authority / Proof-of-Stake / Proof-of-Contribution
model. Companies — not anonymous nodes — stake BEZ to become validators, in four
tiers:

| Tier | Stake required | What it unlocks |
|---|---|---|
| Bronze | 10,000 BEZ | Base edge-node rewards |
| Silver | 50,000 BEZ | + DAO voting, transaction priority, 25% reward boost |
| Gold | 250,000 BEZ | + Sequencer candidacy, 50% reward boost |
| Platinum | 1,000,000 BEZ | + Active sequencer role, council seat, 100% reward boost |

Above a certain stake, a validator earns a seat at the table that governs network
upgrades — the same companies using the network for trade also help secure and
govern it.

## 6. Regulatory posture

BeZhas operates under Spanish/EU law today (MiCA, effective in full since July
2026) for any offer or sale of BEZ-Coin made to persons in the European Union.
International sales outside the EU — including in the UAE — follow the local
framework of that jurisdiction and are structured through a separate legal entity;
they are not, and are not represented to be, an EU-regulated offer.

**This document is a litepaper, not investment advice and not a formal MiCA white
paper.** It describes network mechanics and existing deployments; it makes no
promise of price appreciation, guaranteed yield, or investment return. Anyone
considering acquiring BEZ-Coin should review the full documentation and applicable
local law before doing so.

## 7. Roadmap (near-term)

- **Now** — Algeciras corridor live; DMCC/Jebel Ali relationship-building underway
- **Next** — A bridge connecting BEZ on Polygon to BNB Chain (BEZ is not deployed
  natively on BNB Chain); local commercial presence in a UAE free zone; qualified-investor and
  community funding rounds structured under the MiCA-exemption framework already
  in place for EU participants
- **Then** — Additional trade corridors (Latin America agri-export, West Africa
  trade finance) following the same playbook: solve the operational problem first,
  the token is the fuel, not the pitch

---

*Contact and full documentation: [add public URL before distribution].*
*This litepaper supersedes no prior document and creates no binding offer by itself.*
