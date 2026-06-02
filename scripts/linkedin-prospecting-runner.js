import "dotenv/config";
import path from "node:path";
import { LinkedInClient, writeJsonReport } from "../integrations/linkedin/LinkedInClient.js";

const mode = readArg("--mode") || "prospecting";
const outDir = process.env.LINKEDIN_REPORT_DIR || "logs/linkedin";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = path.resolve(outDir, `${timestamp}-${mode}.json`);

const client = new LinkedInClient();
const report = {
  generatedAt: new Date().toISOString(),
  mode,
  dryRun: client.dryRun,
  docsBasis: [
    "https://learn.microsoft.com/en-us/linkedin/",
    "https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access",
    "https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication",
  ],
  capabilityChecks: {},
  decisions: [],
  nextActions: [],
};

if (!client.hasAppCredentials()) {
  report.decisions.push("LinkedIn app credentials missing. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.");
}

if (!client.hasAccessToken()) {
  report.decisions.push("No LINKEDIN_ACCESS_TOKEN found. OAuth authorization is required before API interaction.");
  report.nextActions.push("Run: npm run linkedin:oauth:url");
  report.nextActions.push("Authorize the app, then run: npm run linkedin:oauth:exchange -- --code <code>");
  report.nextActions.push("Save the returned token as LINKEDIN_ACCESS_TOKEN in .env.");
  finish(report);
}

report.capabilityChecks.openIdProfile = await safeCall("openIdProfile", () => client.getOpenIdProfile());
report.capabilityChecks.restMe = await safeCall("restMe", () => client.getRestMe());
report.capabilityChecks.organizationAcls = await safeCall("organizationAcls", () => client.getOrganizationAcls());
report.capabilityChecks.organizationPosts = await safeCall("organizationPosts", () => client.getOrganizationPosts());

report.linkedinPolicy = {
  prospectSearch:
    "Official LinkedIn APIs generally do not expose unrestricted people/prospect search. Use approved Sales/Marketing products only when your app has explicit access.",
  privateMessages:
    "Private LinkedIn messaging is not assumed available. The automation must prepare drafts/manual actions unless an approved messaging endpoint is present.",
  outbound:
    "Default is human-in-the-loop. No bulk DMs, scraping, or simulated browser actions.",
};

report.prospectingWorkflow = [
  "Read Codex automation prompt and BeZhas knowledge base.",
  "Use LinkedIn API only for approved capabilities detected above.",
  "For unavailable LinkedIn lead search, create a manual Sales Navigator/search task and enrich through compliant public sources or approved tools.",
  "Prepare LinkedIn connection/DM copy as draft unless API permissions explicitly allow the action.",
  "Register prospect, evidence URL, score, state, and next action in Google Sheets/HubSpot when those connectors are available.",
];

if (mode === "messages") {
  report.decisions.push("LinkedIn private messages are not enabled by this generic connector. Drafts only unless an approved API product is added.");
}

if (mode === "prospecting") {
  report.decisions.push("Prospecting runner is enabled. API capability report generated; lead search requires approved LinkedIn Sales/Marketing access or compliant external enrichment.");
}

finish(report);

async function safeCall(name, fn) {
  try {
    const result = await fn();
    return {
      available: Boolean(result?.ok),
      result,
    };
  } catch (error) {
    return {
      available: false,
      error: error.message,
      check: name,
    };
  }
}

function finish(data) {
  writeJsonReport(reportPath, data);
  console.log(`LinkedIn ${mode} report written to ${reportPath}`);
  console.log(JSON.stringify({
    generatedAt: data.generatedAt,
    mode: data.mode,
    dryRun: data.dryRun,
    decisions: data.decisions,
    nextActions: data.nextActions,
    reportPath,
  }, null, 2));
  process.exit(0);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
