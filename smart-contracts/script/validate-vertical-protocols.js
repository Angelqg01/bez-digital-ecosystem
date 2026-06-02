import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "protocols", "vertical-protocols.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function walk(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, predicate, results);
    if (entry.isFile() && predicate(fullPath)) results.push(fullPath);
  }
  return results;
}

const contractIndex = new Map();
for (const file of walk(path.join(root, "src"), (filePath) => filePath.endsWith(".sol"))) {
  contractIndex.set(path.basename(file, ".sol"), file);
}

const errors = [];
const warnings = [];

function assertExists(relativePath, label, protocolId) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`[${protocolId}] Missing ${label}: ${relativePath}`);
  }
}

for (const required of [
  manifest.network.coreDeployScript,
  manifest.network.sectorDeployScript,
  manifest.network.deploymentParser
]) {
  assertExists(required, "network file", "network");
}

for (const protocol of manifest.verticals) {
  if (!protocol.id || !protocol.name) {
    errors.push("Protocol entry missing id or name");
    continue;
  }

  for (const contractName of protocol.contracts || []) {
    if (!contractIndex.has(contractName)) {
      errors.push(`[${protocol.id}] Missing contract in src: ${contractName}`);
    }
  }

  for (const testPath of protocol.tests || []) {
    assertExists(testPath, "test", protocol.id);
  }

  for (const docPath of protocol.docs || []) {
    assertExists(docPath, "CTO/CISO doc", protocol.id);
  }

  if (!protocol.deploy || !protocol.deploy.script) {
    errors.push(`[${protocol.id}] Missing deploy script metadata`);
  } else {
    assertExists(protocol.deploy.script, "deploy script", protocol.id);
  }

  if (!protocol.oracles || protocol.oracles.length === 0) {
    warnings.push(`[${protocol.id}] No oracle dependencies defined`);
  }

  if (!protocol.permissions || protocol.permissions.length === 0) {
    warnings.push(`[${protocol.id}] No permission actors defined`);
  }
}

const summary = {
  manifest: path.relative(root, manifestPath),
  verticals: manifest.verticals.length,
  sharedContracts: manifest.sharedControls.core.length + manifest.sharedControls.wallet.length,
  errors: errors.length,
  warnings: warnings.length
};

console.log(JSON.stringify(summary, null, 2));

if (warnings.length) {
  console.warn("\nWarnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("\nErrors:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("\nVertical protocol manifest is valid.");
