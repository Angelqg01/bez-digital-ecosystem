---
name: bezhas-go-nogo-matrix
description: "Decision matrix for evaluating which sectors, prospects, and integration patterns to pursue first. Scores technical readiness, market demand, and revenue potential."
---

# BeZhas Go/No-Go Decision Matrix

## Sector Readiness Scoring

Score each sector 1-5 on three dimensions. **Go = 10+, Conditional = 7-9, No-Go = <7**

| Sector | Tech Ready (contracts+tests+SDK) | Market Demand | Revenue Potential | **Total** | **Verdict** |
|--------|:---:|:---:|:---:|:---:|:---:|
| **Logistics / Supply Chain** | 5 (8 contracts, SDK, Edge Node) | 5 (massive digitization wave) | 4 (mid-high ticket) | **14** | **GO** |
| **Finance / Factoring** | 5 (4 contracts, 64+ tests) | 5 (fintech boom, T+0 demand) | 5 (high willingness to pay) | **15** | **GO** |
| **Insurance** | 5 (4 contracts, parametric ready) | 4 (growing insurtech) | 5 (high-ticket enterprise) | **14** | **GO** |
| **Healthcare** | 5 (4 contracts, SBT records) | 4 (HIPAA pressure) | 4 (regulated = slow sales) | **13** | **GO** |
| **Energy** | 5 (4 contracts, ESG oracle) | 4 (carbon credits hot) | 4 (mid-ticket) | **13** | **GO** |
| **Manufacturing** | 5 (4 contracts, IoT twins) | 3 (slower adopters) | 4 (high-value deals) | **12** | **GO** |
| **Agriculture** | 5 (4 contracts, land titles) | 3 (emerging markets) | 3 (price-sensitive) | **11** | **GO** |
| **Real Estate** | 4 (SDK module, no dedicated .sol) | 4 (tokenization trend) | 5 (very high ticket) | **13** | **GO** |
| **Government** | 5 (4 contracts, voting, budget DAO) | 3 (long sales cycles) | 3 (procurement-heavy) | **11** | **CONDITIONAL** |
| **Legal** | 5 (4 contracts, evidence vault) | 3 (conservative sector) | 3 (mid-ticket) | **11** | **CONDITIONAL** |
| **Education** | 5 (4 contracts, SBT badges) | 3 (budget-constrained) | 2 (low willingness to pay) | **10** | **CONDITIONAL** |
| **Entertainment** | 5 (4 contracts, tickets, royalties) | 4 (NFT fatigue but utility rising) | 3 (project-based) | **12** | **GO** |
| **Automotive** | 5 (4 contracts, EV charging) | 3 (OEM cycles = 2+ years) | 4 (high-value) | **12** | **GO** |
| **Services** | 5 (4 contracts, freelance, SLA) | 3 (fragmented market) | 3 (mid-ticket) | **11** | **CONDITIONAL** |
| **Other (Loyalty, Crowdfunding)** | 5 (4 contracts) | 3 (niche) | 2 (low-ticket) | **10** | **CONDITIONAL** |

### Recommended Launch Sequence

| Wave | Timing | Sectors | Rationale |
|------|--------|---------|-----------|
| **Wave 1** | Weeks 1-4 | Logistics, Finance, Insurance | Highest combined score, fastest path to revenue |
| **Wave 2** | Weeks 5-8 | Healthcare, Energy, Real Estate | Strong tech + regulatory tailwinds |
| **Wave 3** | Weeks 9-12 | Manufacturing, Entertainment, Automotive | Needs industry-specific demos |
| **Wave 4** | Month 4+ | Government, Legal, Education, Services, Other | Long sales cycles, build pipeline now |

---

## Prospect Go/No-Go Checklist

Before investing effort in a specific prospect, verify:

| # | Criterion | Go | No-Go | Weight |
|---|-----------|:---:|:---:|:---:|
| 1 | Company revenue > $5M/year | Yes | No | 3x |
| 2 | Processing > 100 txs/month (or equivalent) | Yes | N/A but preferred | 2x |
| 3 | Has REST API-capable tech stack | Yes | Legacy-only with no API | 3x |
| 4 | Decision-maker identified (Director+) | Yes | No access beyond analyst | 3x |
| 5 | Active pain point matching our sectors | Yes | "Just exploring" | 2x |
| 6 | Budget cycle allows evaluation within 90 days | Yes | Next FY only | 1x |
| 7 | No competing blockchain project underway | Yes | Deep into Hyperledger/R3 | 2x |
| 8 | Regulatory environment permits blockchain | Yes | Banned or heavily restricted | 3x |

- **Score 15+/19**: Strong Go — prioritize and fast-track
- **Score 10-14**: Conditional — engage but with lower priority
- **Score <10**: No-Go — nurture or deprioritize

---

## Integration Pattern Decision Tree

```
Does the client have developers?
├── YES: Can they install npm packages?
│   ├── YES → Pattern 2: SDK Deep Integration (1-2 weeks)
│   │         Best for: SaaS, fintech, custom platforms
│   └── NO → Pattern 1: Quick API Integration (3-5 days)
│             Best for: Low-code platforms, existing REST consumers
├── NO: Do they have an ERP/WMS with webhooks?
│   ├── YES → Pattern 4: Edge Node Integration (1 week)
│   │         Best for: SAP, Oracle, legacy supply chain
│   └── NO → Pattern 3: White-Label Deployment (2-4 weeks)
│             Best for: Government, large enterprise wanting branded experience
```

---

## Pricing Go/No-Go

| Deal Size | Minimum Viable? | Action |
|-----------|:---:|--------|
| < $10K annual | No | Offer self-serve SDK access only |
| $10K-$25K | Conditional | Starter tier, minimal custom work |
| $25K-$75K | Yes | Growth tier, 1-3 sectors |
| $75K-$200K | Strong Yes | Enterprise tier, dedicated support |
| > $200K | Priority | Custom contracts + white-label |

---

## Risk Assessment per Vertical

| Sector | Top Risk | Mitigation |
|--------|----------|------------|
| Logistics | Client's ERP too legacy | Edge Node webhooks bypass ERP limitations |
| Finance | Regulatory uncertainty | Non-custodial design, on-chain audit, partner with local counsel |
| Insurance | Long compliance review | Pre-build compliance docs, offer sandbox-only pilot |
| Healthcare | HIPAA/data privacy | SoulBound tokens = no PII on-chain, hash-only approach |
| Energy | Grid operator integration | Start with carbon credits (off-grid), expand later |
| Real Estate | Property law jurisdictional | Focus on secondary market trading, not primary issuance |
| Government | Procurement bureaucracy | Target innovation labs/sandboxes first, not core ops |
| Manufacturing | IoT device compatibility | Standard MQTT/HTTP sensors work with Edge Node |

---

## Weekly Review Questions

Every Friday, the Growth Operator should answer:

1. How many new qualified leads entered the pipeline this week?
2. Which leads moved stages? Which are stuck? Why?
3. Are we winning on the right verticals? (Check matrix scores)
4. What objections came up this week? Do we need new responses?
5. Is the tech stack keeping up with commercial promises?
6. What do we need from the dev team for next week's demos?
