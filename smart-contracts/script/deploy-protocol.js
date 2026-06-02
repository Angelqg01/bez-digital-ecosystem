import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "protocols", "vertical-protocols.json"), "utf8")
);

const requestedId = process.argv[2] || "all";

const validation = spawnSync(process.execPath, ["script/validate-vertical-protocols.js"], {
  cwd: root,
  stdio: "inherit"
});

if (validation.status !== 0) {
  process.exit(validation.status || 1);
}

const protocols =
  requestedId === "all"
    ? manifest.verticals
    : manifest.verticals.filter((protocol) => protocol.id === requestedId);

if (protocols.length === 0) {
  console.error(`Unknown protocol id: ${requestedId}`);
  console.error(`Available: ${manifest.verticals.map((protocol) => protocol.id).join(", ")}`);
  process.exit(1);
}

const missingEnv = new Set();
for (const protocol of protocols) {
  for (const key of protocol.deploy.requiredEnv || []) {
    if (!process.env[key]) missingEnv.add(key);
  }
}

console.log("\nSelected protocols:");
for (const protocol of protocols) {
  console.log(`- ${protocol.id}: ${protocol.name}`);
}

if (missingEnv.size) {
  console.warn("\nMissing deployment environment variables:");
  for (const key of missingEnv) console.warn(`- ${key}`);
  console.warn("\nSet these values from a secure secret store before broadcasting.");
}

const scripts = [...new Set(protocols.map((protocol) => protocol.deploy.script))];

console.log("\nDeployment commands:");
for (const script of scripts) {
  const command =
    script === "script/DeploySectors.s.sol"
      ? "forge script script/DeploySectors.s.sol --rpc-url %RPC_URL% --private-key %PRIVATE_KEY% --broadcast"
      : "forge script script/DeployAll.s.sol --rpc-url %RPC_URL% --private-key %PRIVATE_KEY% --broadcast";
  console.log(`- ${command}`);
}

console.log("\nPost-deploy:");
console.log("- node script/parse-deployment.js <chainId>");
console.log("- forge test --match-path <protocol test path>");
console.log("- Archive the validation output with the release evidence package.");
