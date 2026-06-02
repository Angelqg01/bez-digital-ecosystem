import "dotenv/config";
import { LinkedInClient } from "../integrations/linkedin/LinkedInClient.js";

const client = new LinkedInClient();

if (!client.hasAppCredentials()) {
  console.error("Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET in .env");
  process.exit(1);
}

console.log("Open this URL to authorize LinkedIn:");
console.log(client.authorizationUrl(process.env.LINKEDIN_OAUTH_STATE));
console.log("");
console.log("After approving, copy the callback 'code' value and run:");
console.log("npm run linkedin:oauth:exchange:write -- --code YOUR_CODE");
