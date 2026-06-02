# Investor Closer Run - 2026-06-02

## Scope

- Automation: INVESTOR CLOSER (BeZhas_Blockchain)
- Source of truth: `D:\BeZhas-Blockchain\docs\Presentacion_Workflow_BeZhas_Blockchain_2026.md`
- Outreach rule: Gmail drafts only, no automatic sends.
- Compliance rule: no guaranteed returns, no invented claims, no Stripe link unless explicitly requested.
- Tooling limitation in this run: Gmail and Google Sheets tools were not exposed in the session. No remote CRM updates, Gmail searches, Gmail drafts, or Google Contacts checks were performed.

## Current Operating Status

- The automation memory available in `C:\Users\yoela\.codex\automations\investor-closer-bezhas-blockchain\memory.md` only contained campaign detail through 2026-05-25, although LinkedIn dry-run logs existed for 2026-05-29.
- The active cold cohort from prior runs should remain paused at `followup_3_final`: Arrington Capital, Artichoke Capital, 280 Capital, Lattice, and Xenith.
- New prospecting was expanded because the previous operating rule allows new lead research when no positive replies are available.
- No new Gmail drafts were created because email verification score >=80 is not available in this session.

## LinkedIn

- `pnpm run linkedin:prospecting` completed as dryRun.
- `pnpm run linkedin:messages` completed as dryRun.
- Current blocker remains missing `LINKEDIN_ACCESS_TOKEN`.
- Reports:
  - `D:\BeZhas-Blockchain\logs\linkedin\2026-06-02T06-48-08-458Z-prospecting.json`
  - `D:\BeZhas-Blockchain\logs\linkedin\2026-06-02T06-48-08-446Z-messages.json`

## New Qualified Prospects

These leads did not appear in the local automation memory or prior local investor closer briefings. They still need Gmail/Contacts history checks and email verification before any Gmail draft.

| Lead | Route | Fit | Urgency | Status | Rationale |
| --- | --- | ---: | ---: | --- | --- |
| Web3.com Ventures | Official pitch/contact page | 4 | 4 | `researching` | Official site focuses on AI, infrastructure and ZK, with portfolio spanning infrastructure and AI platforms. |
| Consensus Capital Holdings | Official apply / pitch route | 4 | 3 | `researching` | Official site lists early-stage infrastructure, middleware and due diligence process; typical check listed as $250K-$2M. |
| AGE Crypto Asset Investment Fund | Contact/team route | 4 | 3 | `researching` | Official portfolio includes DePIN, interoperability, Layer 1, DeFi and enterprise-adoption oriented infrastructure such as Casper. |
| Frachtis | Official Tally deck submission | 4 | 4 | `researching` | Official site states pre-seed focus on decentralized infrastructure, AI, middleware and technical diligence. |
| Ascentis Capital | Official application form | 5 | 4 | `researching` | Official site targets early to Series A technical founders in AI, blockchain, robotics and deep tech; check range $500K-$5M. |

## Evidence Used

- Web3.com Ventures: official site states it funds core layers including AI, decentralized infrastructure and zero-knowledge systems, and invests in infrastructure such as data availability, decentralized compute, modular stacks and core rails. Source: https://web3.com/
- Web3.com Ventures portfolio: official portfolio includes AI, infrastructure and ZK companies including Lombard, Hemi, Babylon, BoB and other infrastructure projects. Source: https://web3.com/portfolio
- Web3.com Ventures contact route: official contact page is a pitch page. Source: https://web3.com/contact
- Consensus Capital Holdings: official site describes early-stage investing in Web3/blockchain technology with focus on protocols, infrastructure and onchain applications. Source: https://www.consensuscapitalholdings.com/
- Consensus Capital Holdings investments: official investments page lists focus areas including Layer 1/Layer 2 protocols, staking infrastructure, zero-knowledge technologies, developer tools and middleware, with typical check range $250K-$2M. Source: https://www.consensuscapitalholdings.com/investments
- AGE Crypto Asset Investment Fund: official portfolio categories include DePIN, interoperability, Layer 1 and DeFi; portfolio includes Akash, Union, Casper and Tribal Credit. Source: https://age.fund/portfolio
- AGE contact/team route: official contact page lists General Partners Ethan Kravitz and Tyler Frank plus Venture Partner Justin Wasser. Source: https://age.fund/contact
- Frachtis: official site describes a crypto-native pre-seed fund supporting decentralized infrastructure, AI, middleware and consumer apps; it points founders to an official deck submission form. Source: https://frachtis.com/
- Frachtis submission route: official Tally form requests name, email, company, one-liner, website, deck link and additional context. Source: https://tally.so/r/w2o89M
- Ascentis Capital: official site states early to Series A focus, check sizes from $500K to $5M, and support around architecture, security, infrastructure scaling and go-to-market. Source: https://www.ascentis.capital/
- Ascentis portfolio: official portfolio includes AI + DePIN, L2/data composability, institutional financial products, stablecoin infrastructure and restaked rollup infrastructure. Source: https://www.ascentis.capital/portfolio
- Ascentis application route: official form asks for company profile, problem, solution, market opportunity, business model, traction, competitive landscape, team, amount and closing timeline. Source: https://www.ascentis.capital/contact

## Manual Outreach Copy

Use only after Yoel approval and only through the official form/manual route unless a verified email score >=80 is obtained.

### Web3.com Ventures

Hi Web3.com team,

BeZhas may fit your infrastructure and AI thesis. The platform turns enterprise operating events into verifiable evidence and automated execution across logistics, supply-chain, finance and real-asset workflows.

The opportunity is an adoption and validation layer for institutions that need traceability, due diligence records and a clear economic case around real operating activity.

If this is within scope, Yoel can share the private due diligence pack for a first review.

### Consensus Capital Holdings

Hi Consensus Capital team,

BeZhas may be relevant to your infrastructure and middleware lens. The platform is built to convert enterprise operating events into auditable evidence, automated agreement execution and asset-liquidity workflows.

The base case is institutional adoption through validation infrastructure: traceability, compliance records and an economic model tied to verified operational activity.

If useful, Yoel can provide the private pack for due diligence.

### AGE Crypto Asset Investment Fund

Hi AGE team,

BeZhas may fit your infrastructure and DePIN-style adoption thesis. The platform is designed for institutions that need verifiable operational evidence across logistics, supply-chain, finance and real assets.

The opportunity is a validation infrastructure layer where enterprise activity can support traceability, automated execution and a clear economic case.

If relevant, Yoel can share the private due diligence materials for a first screen.

### Frachtis

Hi Frachtis team,

BeZhas may be relevant to your early infrastructure and AI thesis. It is a validation layer for enterprise workflows, turning real operating events into auditable evidence and execution triggers.

The fit worth testing is whether BeZhas can support institutional adoption through traceability, due diligence records and a practical economic case around verified activity.

If this is within scope, Yoel can share the private pack for review.

### Ascentis Capital

Hi Ascentis team,

BeZhas may fit your computational infrastructure thesis. The platform converts enterprise events into verifiable evidence and automated execution across logistics, supply-chain, finance and real-asset workflows.

The opportunity is infrastructure for institutional adoption: traceability, validation, due diligence records and a base case tied to real operating activity.

If useful, Yoel can provide the private due diligence materials and walk through the economic case.

## CRM Import

- Prepared TSV: `D:\BeZhas-Blockchain\docs\investor_closer_2026-06-02_crm_import.tsv`
- Recommended CRM state for all five: `researching`.
- Do not mark `ready_to_contact` until Gmail/Contacts history is checked and the contact route has either an official manual form or email verification score >=80.
- Do not include Calendar until Fit Score >=4 route is actively engaged or there is a positive response. The manual copy above intentionally does not include Calendar or Stripe.

## Next Actions

1. Paste/import the TSV rows into Google Sheets only after checking the live CRM for duplicates.
2. Verify Gmail and Google Contacts history for each fund domain before any outreach.
3. Use Hunter/Dropcontact or equivalent for email score >=80 before creating Gmail drafts.
4. Use official manual forms for Web3.com, Frachtis and Ascentis only after Yoel approval.
5. Complete LinkedIn OAuth before API-backed prospecting.
