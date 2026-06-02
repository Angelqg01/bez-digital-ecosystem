# Investor Closer Run - 2026-05-25

## Scope

- Automation: INVESTOR CLOSER (BeZhas_Blockchain)
- CRM: Google Sheet `BeZhas Investor Pipeline` / tab `Investor Pipeline`
- Source of truth: `D:\BeZhas-Blockchain\docs\Presentacion_Workflow_BeZhas_Blockchain_2026.md`
- Outreach rule: Gmail drafts only, no automatic sends.
- Compliance rule: no guaranteed returns, no invented claims, no Stripe link unless explicitly requested.

## Gmail Review

- Investor inbox search after 2026-05-23 found no positive investor replies, no due-diligence intent, no allocation requests and no bounce signal for the active investor cohort.
- Active Gmail drafts are unrelated to investor outreach: Blue Core, local logistics/account routes, Jose Baqueiro and Jacobo Camba. They were not modified.
- Attempted final reply draft creation was rejected by Gmail because subject threading did not match. After reading the sent follow-up messages, no extra final email was created because the 2026-05-18 follow-up already used final closeout language.

## CRM Updates

Rows 37, 38, 39, 40 and 42 were updated:

| Row | Fund | New state | Reason |
| --- | --- | --- | --- |
| 37 | Arrington Capital | `followup_3_final` | No investor reply by 2026-05-25; followup_2 already contained closeout language. |
| 38 | Artichoke Capital | `followup_3_final` | No investor reply by 2026-05-25; followup_2 already contained closeout language. |
| 39 | 280 Capital | `followup_3_final` | No investor reply by 2026-05-25; followup_2 already contained closeout language. |
| 40 | Lattice | `followup_3_final` | No investor reply by 2026-05-25; followup_2 already contained closeout language. |
| 42 | Xenith | `followup_3_final` | No investor reply by 2026-05-25; followup_2 already contained closeout language. |

Rows 79-82 were added as `researching` only:

| Row | Fund | Route | Fit | Urgency | Next action |
| --- | --- | --- | ---: | ---: | --- |
| 79 | Tioga Capital | `pitch@tioga.capital` | 4 | 3 | Verify email score >=80 before Gmail draft. |
| 80 | RockawayX | Manual web form / Get in Touch | 5 | 4 | Prepare form brief for Yoel approval. |
| 81 | Breed VC | Manual web route | 4 | 3 | Resolve exact official email or warm intro before drafting. |
| 82 | Nascent | Manual social / warm intro | 4 | 3 | Identify exact partner route; no guessed email. |

No Gmail drafts were created for the new rows because no Hunter/Dropcontact-style verification score >=80 was available.

## Evidence Used

- Tioga Capital: official page states seed to Series A mandate, up to $5M checks, and themes including open finance and coordination networks. Source: https://www.tioga.capital/about
- RockawayX: official 2025 fund announcement states ~$2B AUM, $125M fund, and focus on liquidity provision, infrastructure and early-stage projects. Source: https://www.rockawayx.com/insights/rockawayx-announces-the-close-of-its-new-125m-crypto-venture-fund
- RockawayX vault page: official source describes RWA vaults, risk curation, legal/compliance review and institutional standards. Source: https://www.rockawayx.com/vaults
- Breed VC: official site describes a crypto-native early-stage fund and published agentic-finance thesis. Source: https://breed.vc/
- Breed VC portfolio: official portfolio includes RWA.xyz, Credora, Astria, Spearbit, Plume, T1 Protocol and One Balance. Source: https://breed.vc/portfolio
- Nascent: official site describes venture/liquid strategies and portfolio including Morpho, Ethena, Optimism, Etherscan, Aztec, Obol and Flashbots. Source: https://nascent.xyz/

## Manual Outreach Copy For New Prospects

### Tioga Capital

Hi Tioga team,

I am reaching out because Tioga's published focus on open finance and coordination networks appears aligned with what BeZhas is building: infrastructure that turns enterprise operational events into verifiable evidence and automated execution across logistics, supply-chain, finance and real-asset workflows.

The opportunity is not a market narrative. It is an adoption and validation layer designed for institutions that need traceability, due diligence records and a clear economic case around real operating activity.

If this fits your current mandate, Yoel can share the private due diligence pack and walk through the base case.

### RockawayX

Hi RockawayX team,

BeZhas may be relevant to your infrastructure and risk-curation lens. The platform is built around verifiable operating events, asset-liquidity workflows and automated agreement execution for enterprise use cases.

The fit worth testing is whether BeZhas can become a validation infrastructure layer for institutional adoption, with due diligence centered on real usage, compliance, and the economic case rather than speculative positioning.

If useful, Yoel can provide the private pack for review.

### Breed VC

Hi Breed team,

I am reaching out because Breed's work around agentic finance and early-stage infrastructure maps closely to BeZhas' direction: enterprise infrastructure where operational events can become verifiable evidence and execution triggers.

The opportunity is a private access review of the adoption, validation and economic case behind BeZhas, especially where machine-economy workflows, asset liquidity and institutional due diligence overlap.

If this is within scope, Yoel can share the due diligence materials.

### Nascent

Hi Nascent team,

BeZhas may fit your open-market infrastructure lens. It is a validation layer for enterprise workflows, turning business events into auditable evidence and execution logic for sectors like logistics, supply chain, finance and real assets.

The base case to review is adoption-driven infrastructure: traceability, agreement automation and an economic model tied to validated operational activity.

If relevant, Yoel can share the private due diligence pack for a first screen.

## LinkedIn

- `pnpm run linkedin:prospecting` completed as dryRun.
- `pnpm run linkedin:messages` completed as dryRun.
- Current blocker remains missing `LINKEDIN_ACCESS_TOKEN`.
- Reports:
  - `D:\BeZhas-Blockchain\logs\linkedin\2026-05-25T12-41-32-352Z-prospecting.json`
  - `D:\BeZhas-Blockchain\logs\linkedin\2026-05-25T12-41-32-732Z-messages.json`

## Next Actions

1. Verify `pitch@tioga.capital` with Hunter/Dropcontact or equivalent; minimum score 80%.
2. Prepare manual form submissions for RockawayX, Breed VC and Nascent only after Yoel approval.
3. Keep Arrington, Artichoke, 280, Lattice and Xenith paused unless there is an inbound signal or material milestone.
4. Complete LinkedIn OAuth before API-backed prospecting.
