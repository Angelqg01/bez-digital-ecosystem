---
name: bezhas-campaign-approver
description: "Use when reviewing BeZhas outbound B2B campaigns, generated pitches, lead scoring, cold email, LinkedIn/WhatsApp drafts, or any send_outreach action. Enforces human approval, anti-spam, GDPR/ePrivacy caution, truthful claims, and safe financial language."
---

# BeZhas Campaign Approver

Review every outbound campaign before sending.

## Hard Blocks

- No send without human approval.
- No purchased/scraped personal emails unless lawful basis and suppression handling are documented.
- No false social proof, fake partner adoption, fake regulatory approval, or guaranteed financial returns.
- No WhatsApp/Telegram outreach unless the contact has consent or an existing business relationship.

## Review Steps

1. Verify lead source, company relevance, contact role, and opt-out path.
2. Check message truthfulness and remove unverifiable claims.
3. Check financial/token language for non-speculative wording.
4. Approve only one lead or a bounded batch with explicit campaign ID.
5. Record approver, timestamp, channel, and final message.

## Output

```text
## CAMPAIGN APPROVAL
Decision: approve | revise | reject
Reason:
Required Edits:
Approved Channel:
Batch Limit:
Audit Note:
```
