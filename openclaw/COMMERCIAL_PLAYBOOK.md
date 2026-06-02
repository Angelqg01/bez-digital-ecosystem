---
name: bezhas-commercial-playbook
description: "90-day B2B go-to-market playbook for BeZhas Blockchain commercial expansion. Covers vertical prioritization, ICP definition, outreach cadence, pilot structure, and conversion framework."
---

# BeZhas Commercial Playbook — 90-Day GTM

## Phase 1: Foundation (Weeks 1-2)

### 1.1 — Choose 3 Launch Verticals

Based on stack readiness (contracts deployed + SDK modules + API routes), the recommended launch order:

| Priority | Vertical | Why First | Key Contracts | SDK Module |
|----------|----------|-----------|---------------|------------|
| 1 | **Logistics / Supply Chain** | Most mature: 8 contracts, Edge Node, Maersk/TNT SDK, full traceability | SupplyTracker, ProcurementNFT, WarehouseManager, SupplierScoreOracle | LogisticsManager, Tier2Modules |
| 2 | **Finance / Factoring** | High pain (T+30 settlement), high willingness to pay | InvoiceFactoring, MicroLendingPool, TreasuryVault, CreditScoreOracle | Tier3Modules |
| 3 | **Insurance** | Parametric insurance is hot, low competition in blockchain | PolicyNFT, ClaimAdjuster, ReinsurancePool, ParametricInsurance | Tier2Modules |

### 1.2 — Build ICP (Ideal Customer Profile)

**Logistics ICP:**
- Revenue: $10M–$500M
- Processes: >200 shipments/month
- Tech: Uses ERP/WMS with REST API capability (SAP, Oracle, NetSuite, Odoo)
- Pain: Manual proof-of-delivery, dispute resolution, carrier compliance
- Decision-maker: VP Supply Chain, CTO, Head of Innovation
- Geography: LATAM (Spanish-speaking), Spain, EU, US

**Finance ICP:**
- Revenue: $5M–$200M
- Processes: Invoice factoring, micro-lending, treasury management
- Pain: T+30 settlement, credit scoring opacity, manual reconciliation
- Decision-maker: CFO, Head of Treasury, CTO
- Geography: LATAM, EU fintech hubs

**Insurance ICP:**
- Revenue: $20M–$1B
- Processes: Claims processing, policy management, reinsurance
- Pain: Adjuster overhead, fraud, parametric triggers without automation
- Decision-maker: Chief Underwriting Officer, CTO, VP Claims
- Geography: Global (parametric insurance is sector-agnostic)

### 1.3 — Build Account Lists (100 per vertical)

**Sources to mine:**
- LinkedIn Sales Navigator (filter by industry + company size + technologies)
- Crunchbase (filter by funding stage + sector)
- Industry conferences attendee lists (LogiMAT, InsurTech Connect, LendIt Fintech)
- GitHub (companies building logistics/finance tools — potential SDK partners)
- Gartner/Forrester reports (companies mentioned as innovators)

**Per account, capture:**
| Field | Example |
|-------|---------|
| Company | TransLogistica S.A. |
| Revenue | $45M |
| HQ | Barcelona, Spain |
| Employees | 200 |
| Tech Stack | SAP EWM, custom TMS, REST APIs |
| Pain Signal | LinkedIn post about digitization, job posting for blockchain dev |
| Decision-Maker 1 | María López, CTO, maria@translog.com |
| Decision-Maker 2 | Carlos Ruiz, VP Supply Chain, carlos@translog.com |
| Decision-Maker 3 | Ana Fernández, CFO, ana@translog.com |

### 1.4 — Prepare Sales Assets

| Asset | Format | Owner |
|-------|--------|-------|
| 2-page sector brief (per vertical) | PDF/Notion | Growth Operator |
| Technical integration guide | Markdown (link to SDK docs) | Solutions Engineer |
| ROI calculator template | Spreadsheet | Deal Bridge |
| Demo video (SDK integration in 5 min) | Loom/Video | Solutions Engineer |
| Case study template (for post-pilot) | PDF | Deal Bridge |

---

## Phase 2: Outreach & Discovery (Weeks 3-6)

### 2.1 — Outreach Cadence

**Per account, 5-touch sequence over 21 days:**

| Day | Channel | Action | Skill |
|-----|---------|--------|-------|
| 1 | Email | Cold email — sector-specific hook | `/sdr-outreach` |
| 1 | LinkedIn | Connection request with context | `/sdr-outreach` |
| 3 | Email | Follow-up with specific use case | `/sdr-outreach` |
| 7 | LinkedIn | DM with 2-page brief | `/sdr-outreach` |
| 14 | Email | Social proof + last offer | `/sdr-outreach` |
| 21 | Email | Break-up email | `/sdr-outreach` |

**Target metrics for Phase 2:**
- 300 accounts contacted (100 × 3 verticals)
- 15% response rate → 45 responses
- 33% meeting conversion → 15 discovery calls
- 60% qualification → 9 qualified opportunities

### 2.2 — Discovery Call Framework

**Before the call** (Growth Operator prepares):
1. Company brief (revenue, tech stack, pain signals)
2. Relevant contracts + SDK modules mapped
3. 5 discovery questions

**During the call** (30 min structure):
| Minute | Topic | Goal |
|--------|-------|------|
| 0-5 | Rapport + agenda setting | Build trust, set expectations |
| 5-15 | Discovery questions (pain, current solution, budget, timeline) | Qualify BANT+ |
| 15-25 | Solution mapping (show relevant contracts, demo SDK) | Create technical curiosity |
| 25-30 | Next steps (pilot proposal, technical deep-dive, or disqualify) | Clear action item |

**After the call** (Solutions Engineer):
1. Technical scope document
2. Effort estimate
3. Pilot proposal draft

### 2.3 — Qualification Scoring

| Criteria | Score | Details |
|----------|-------|---------|
| Budget confirmed ($50K+) | 2 pts | Decision-maker confirmed budget availability |
| Authority (Director+ engaged) | 2 pts | At least 1 C-level or VP on thread |
| Need (pain maps to our contracts) | 2 pts | Specific use case identified |
| Timeline (<90 days) | 1 pt | Active evaluation underway |
| Tech fit (REST API / npm capable) | 1 pt | Can integrate SDK without major rebuild |
| **Total** | **8 pts** | **6+ = Hot, 4-5 = Warm, <4 = Nurture** |

---

## Phase 3: Pilots (Weeks 7-10)

### 3.1 — Pilot Structure

**Duration:** 4-6 weeks
**Scope:** 1 sector, 1-2 contracts, 1 integration pattern
**Cost:** $5,000-$15,000 (covers setup + gas prepay + support)

**Pilot deliverables:**
1. Enterprise account provisioned (admin wallet, API key, gas tank)
2. 1-2 contracts deployed on BeZhas L2 (or testnet)
3. SDK integrated into client's staging environment
4. 1 production flow operational (e.g., proof-of-delivery, invoice factoring)
5. Dashboard showing real-time metrics
6. KPI report at pilot end

**Pilot KPIs (agreed upfront):**
| KPI | Logistics Example | Finance Example | Insurance Example |
|-----|------------------|-----------------|-------------------|
| Primary | Time to proof-of-delivery | Settlement time | Claim processing time |
| Secondary | Dispute reduction % | Reconciliation errors | Fraud detection rate |
| Operational | Transactions/day processed | API uptime | Policy issuance throughput |
| Adoption | % of shipments on-chain | % of invoices tokenized | % of claims automated |

### 3.2 — Pilot Onboarding Checklist

```
Week 1: Setup
□ Create enterprise record in BeZhas API
□ Generate admin wallet (SmartWalletFactory.createWallet)
□ Fund gas tank (Paymaster.deposit)
□ Issue API key + JWT credentials
□ Deploy sector contracts to testnet
□ SDK npm install in client staging

Week 2-3: Integration
□ Connect client ERP/WMS via Edge Node webhooks OR REST API
□ Configure Paymaster whitelist (client users + target contracts)
□ Test end-to-end flow on testnet
□ Set up monitoring (Aegis anomaly detection)

Week 4-5: Production
□ Deploy contracts to BeZhas L2 mainnet
□ Migrate from testnet to mainnet
□ Run production flow with real data
□ Daily KPI tracking

Week 6: Review
□ Generate KPI report
□ Present results to client stakeholders (use /deal-bridge)
□ Propose annual contract terms
□ Collect testimonial (for case study)
```

---

## Phase 4: Conversion (Weeks 11-12)

### 4.1 — Annual Contract Tiers

| Tier | Monthly | Annual | Includes |
|------|---------|--------|----------|
| **Starter** | $2,500 | $25,000 | 1 sector, 4 contracts, 5K tx/month, email support |
| **Growth** | $7,500 | $75,000 | 3 sectors, 12 contracts, 50K tx/month, Slack support, SLA 99.5% |
| **Enterprise** | $20,000 | $200,000 | All sectors, unlimited contracts, unlimited tx, dedicated SE, SLA 99.9%, custom contracts |

**Gas pricing:** BEZ tokens at market rate, pre-purchased in bulk (10% discount on annual prepay).

### 4.2 — Conversion Framework

| Pilot Outcome | Action |
|---------------|--------|
| KPIs met + stakeholder enthusiasm | Propose Growth or Enterprise tier |
| KPIs partially met | Extend pilot 2 weeks, adjust scope |
| KPIs not met | Post-mortem, offer different use case or graceful exit |
| Client ghosts | Break-up sequence via `/sdr-outreach`, revisit in 90 days |

### 4.3 — Post-Conversion Upsell Path

```
Month 1-3:   Stabilize + optimize initial sector
Month 4-6:   Add 2nd sector (cross-sell)
Month 7-9:   Add AI capabilities (Aegis monitoring, MCP tools)
Month 10-12: Enterprise tier upgrade + custom contract development
Year 2:      White-label deployment + multi-chain expansion
```

---

## Metrics Dashboard

Track these weekly in the OpenClaw morning briefing:

| Metric | Target (90 days) |
|--------|-----------------|
| Accounts contacted | 300 |
| Discovery calls booked | 30 |
| Qualified opportunities | 15 |
| Proposals sent | 10 |
| Pilots started | 5 |
| Pilots converted | 3 |
| ARR generated | $75K-$200K |
| Pipeline value | $500K+ |

---

## Tools & Automation Summary

| Task | Tool | Frequency |
|------|------|-----------|
| Lead research | OpenClaw + LinkedIn | Daily |
| Outreach generation | `/sdr-outreach` skill | Daily |
| Lead qualification | `/bezhas-growth` skill | Per lead |
| Technical scoping | `/solutions-engineer` skill | Per opportunity |
| Executive communications | `/deal-bridge` skill | Per proposal |
| Pipeline tracking | CommercialAPIClient.js | Continuous |
| Morning briefing | OpenClaw cron job | Daily 9 AM |
| Pilot provisioning | CommercialAPIClient.provisionPilot() | Per pilot |
| KPI reporting | API analytics + Deal Bridge | Weekly during pilot |
