# BeZhas — Reactivation Strategy for Stalled Antwerp Deals
**Target Accounts: PSA Antwerp & DP World Antwerp**
*Date: June 1, 2026*
*Prepared by: BeZhas-ICA*
*Supervised by: Yoel A. Hernández, CEO & Founder*

---

## 1. Context & Diagnosis

Both deals have been stuck in the **Appointment Scheduled** stage in HubSpot since **May 14, 2026**. 
In enterprise sales targeting major global terminal operators (PSA and DP World), stagnation at this phase usually stems from three distinct corporate bottlenecks:
1. **Integration Anxiety:** The operational/IT teams fear that testing BeZhas will require complex integrations with their terminal operating systems (TOS) like Navis N4.
2. **Web3 Regulatory Compliance FUD:** Legal teams may flag "Web3/Blockchain" as high-risk or immature.
3. **Internal Priority Shifts:** The contact hasn't had the time to sell the pilot internally to the operations director.

### The Reactivation Angle: The Zero-Friction 14-Day Pilot
To break this silence, we must shift the narrative away from a "platform integration" to a **lightweight, non-intrusive parallel proof-of-concept (PoC)**:
* **0% TOS Code Changes:** We do not touch their internal databases or systems. We capture events via standard webhooks or simple physical spreadsheets.
* **1 Corridor / 1 Flow:** We track exactly one high-value cargo corridor or one specific documentary validation.
* **Quantifiable KPI:** We prove reduction in dispute times within 14 days.

---

## 2. Reactivation Drafts

These emails are written to be highly professional, avoiding any crypto-jargon and addressing the exact operational pain of each operator.

### 📧 Draft A: For PSA Antwerp (CFS — Container Freight Station)
* **Operational Pain:** Frictional handover documentation, manual checking of consolidation/deconsolidation states, and delay claims from cargo owners.
* **BeZhas Modules:** SupplyTracker + QualityEscrow + CustomsDeclarationNFT.

```text
Subject: BeZhas Pilot - Container Freight Station (CFS) friction reduction

Hi [Contact Name],

I hope you are having a productive week.

I am writing to follow up on our discussion in mid-May regarding the BeZhas pilot for PSA Antwerp's CFS operations. 

We understand that internal logistics priorities move fast. To make this as easy as possible for your operations team, we have designed a "Zero-Friction" pilot framework that bypasses internal IT queue delays entirely:
* Scope: 1 cargo corridor (CFS consolidation to export gate).
* IT Overhead: Zero. We use external webhook listeners or standard status spreadsheets to run parallel checks.
* Target: Automate the validation of consolidation handovers and immediately register auditable custody footprints to eliminate customer delay claims.
* Duration: 14 days.

We have compiled a brief 1-page integration brief showing how we isolate this test from your main TOS. 

Would you have 10 minutes this Thursday at 10:00 AM CET for a quick run-through?

Best regards,

Yoel A. Hernández
CEO & Founder, BeZhas
https://www.linkedin.com/in/yoel-a-hernandez/
```

---

### 📧 Draft B: For DP World Antwerp Gateway
* **Operational Pain:** Gate queue turnaround delays, truck carrier SLA compliance disputes, and intermodal connectivity visibility.
* **BeZhas Modules:** SupplyTracker + SLAMonitor.

```text
Subject: BeZhas Pilot - DP World Antwerp Gate SLA & turnaround verification

Hi [Contact Name],

I hope all is well.

Following up on our mid-May conversation regarding the BeZhas pilot at the Antwerp Gateway terminal.

Knowing that terminal efficiency and inland intermodal connectivity are key focuses this quarter, we have structured a highly targeted, 14-day parallel pilot specifically to monitor and verify carrier SLA compliance:
* Objective: Capture real-time gate entry/exit milestones and automatically certify carrier SLAs without touching your internal TOS database.
* Operation: We run a secure parallel compliance audit (via standard APIs) to pinpoint manual bottlenecks at the gate.
* Result: A simplified operations dashboard showcasing verified dispute resolution data in under 2 weeks.

Our technical brief details how we isolate this pilot from your core operating systems to ensure zero security friction.

Are you available for a brief, 10-minute update call this Thursday at 2:00 PM CET?

Best regards,

Yoel A. Hernández
CEO & Founder, BeZhas
https://www.linkedin.com/in/yoel-a-hernandez/
```

---

## 3. CRM Playbook & HubSpot Action Items

To keep the database updated and the orchestration engine synchronized:
1. **If No Response in 5 Days:** Set status to `followup_1` in HubSpot and flag in Slack.
2. **If Positive Response:** 
   * Move stage to `ready_to_contact` / `positive` in HubSpot.
   * Send the technical brief and the private calendar link.
   * Log the conversation thread URL in the CRM database under `gmail_thread_url`.
3. **If Objection Received:** 
   * Move stage to `objection`.
   * Trigger a compliance review by the `legal-agent` to draft tailored security/GDPR assurances.
