import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { LinkedInClient } from "../integrations/linkedin/LinkedInClient.js";

const code = readArg("--code");
const writeEnv = hasFlag("--write-env");

if (!code) {
  console.error("Usage: npm run linkedin:oauth:exchange -- --code YOUR_AUTHORIZATION_CODE [--write-env]");
  process.exit(1);
}

const client = new LinkedInClient();
const result = await client.exchangeCode(code);

if (!result.ok) {
  console.error("LinkedIn token exchange failed:");
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log("LinkedIn token exchange succeeded.");

if (writeEnv) {
  writeLinkedInAccessToken(result.payload.access_token);
  console.log("LINKEDIN_ACCESS_TOKEN saved to .env.");
} else {
  console.log("Access token received but not printed. Re-run with --write-env to save it to .env automatically.");
}

console.log("Response metadata:");
console.log(JSON.stringify(maskTokenFields(result.payload), null, 2));

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function writeLinkedInAccessToken(token) {
  if (!token) {
    throw new Error("LinkedIn response did not include access_token.");
  }

  const envPath = path.resolve(".env");
  const line = `LINKEDIN_ACCESS_TOKEN=${token}`;

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `${line}\n`, "utf8");
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const escapedKey = /^LINKEDIN_ACCESS_TOKEN=.*$/m;

  if (escapedKey.test(content)) {
    fs.writeFileSync(envPath, content.replace(escapedKey, line), "utf8");
    return;
  }

  const suffix = content.endsWith("\n") || content.endsWith("\r\n") ? "" : newline;
  fs.writeFileSync(envPath, `${content}${suffix}${line}${newline}`, "utf8");
}

function maskTokenFields(payload) {
  const clone = { ...payload };
  for (const key of Object.keys(clone)) {
    if (key.toLowerCase().includes("token")) {
      clone[key] = "[REDACTED]";
    }
  }
  return clone;
}
