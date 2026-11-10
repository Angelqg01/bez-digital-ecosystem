# LinkedIn Automation Setup

This integration enables Codex automations to use LinkedIn only where the official API and granted permissions allow it.

## Environment

Required in `.env`:

```env
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=http://localhost:3001/auth/linkedin/callback
LINKEDIN_SCOPES=openid profile email w_member_social
LINKEDIN_API_VERSION=202601
LINKEDIN_DRY_RUN=true
```

Optional:

```env
LINKEDIN_ACCESS_TOKEN=...
LINKEDIN_ORGANIZATION_ID=...
LINKEDIN_REPORT_DIR=logs/linkedin
```

## OAuth

1. Generate the authorization URL:

```bash
pnpm linkedin:oauth:url
```

2. Open the URL, approve the app, and copy the `code` query parameter from the callback.

3. Exchange the code:

```bash
pnpm linkedin:oauth:exchange --code YOUR_AUTHORIZATION_CODE
```

4. Prefer saving the token automatically:

```bash
pnpm linkedin:oauth:exchange:write --code YOUR_AUTHORIZATION_CODE
```

The command stores `LINKEDIN_ACCESS_TOKEN` in `.env` and does not print the token.

## Automation Runner

Prospecting capability check:

```bash
pnpm linkedin:prospecting
```

Message capability check:

```bash
pnpm linkedin:messages
```

The runner writes JSON reports under `logs/linkedin`. It never assumes that LinkedIn people search, private messaging, or Sales Navigator automation is available. If the API does not grant a capability, the automation must create drafts and manual review tasks.

## Compliance Rules

- Use OAuth tokens, not LinkedIn passwords.
- Do not scrape LinkedIn or automate the browser.
- Do not send bulk DMs.
- Keep human approval for first-contact outreach, regulated entities, C-level, investment terms, and sensitive M&A.
- Register evidence URLs, score, and next action for every prospect.
