import fs from 'fs';
import path from 'path';

const root = process.cwd();

const checks = [
  { type: 'dir', target: "Bezhas-Hub", critical: true },
  { type: 'dir', target: "bez-wallet", critical: true },
  { type: 'dir', target: "gas-tank-manager", critical: true },
  { type: 'dir', target: "edge-node-manager", critical: true },
  { type: 'dir', target: "bez-vision-scan", critical: true },
  { type: 'dir', target: "BZ Capital", critical: false },
  { type: 'file', target: "packages/api-gateway/src/server.js", critical: true },
  { type: 'file', target: "packages/platform-sdk/package.json", critical: true },
  { type: 'file', target: ".env.shared", critical: true },
  { type: 'file', target: "hub-control-plane-migration/03-integration/INTEGRATION_CONTRACT.json", critical: true }
];

const results = checks.map((c) => {
  const abs = path.join(root, c.target);
  const exists = fs.existsSync(abs);
  return { ...c, exists };
});

const missingCritical = results.filter((r) => !r.exists && r.critical);
const missingOptional = results.filter((r) => !r.exists && !r.critical);

console.log("==============================================");
console.log("BeZhas Hub Control Plane - Connection Check");
console.log("==============================================");

for (const r of results) {
  const icon = r.exists ? "PASS" : "MISS";
  console.log(`[${icon}] ${r.type.toUpperCase()} ${r.target}${r.critical ? " (critical)" : ""}`);
}

console.log("----------------------------------------------");
console.log(`Critical missing: ${missingCritical.length}`);
console.log(`Optional missing: ${missingOptional.length}`);

if (missingCritical.length > 0) {
  console.error("Status: NOT READY");
  process.exit(1);
}

console.log("Status: READY FOR MIGRATION EXECUTION");
process.exit(0);

