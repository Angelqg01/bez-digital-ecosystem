import fs from 'fs';
import path from 'path';

const root = process.cwd();

const docs = [
  "CHECKLIST_MIGRACION_BEZHAS_HUB.md",
  "MAPA_BEZHAS_HUB_KEEP_MIGRATE_DELETE.md",
  "hub-control-plane-migration/00-governance/MISSION.md",
  "hub-control-plane-migration/01-inventory/OWNERSHIP_MATRIX.yaml",
  "hub-control-plane-migration/02-architecture/TARGET_CONNECTIONS.yaml",
  "hub-control-plane-migration/03-integration/INTEGRATION_CONTRACT.json",
  "hub-control-plane-migration/04-execution/BACKLOG_NOW.md",
  "hub-control-plane-migration/05-validation/SMOKE_TESTS.md"
];

const existing = docs.filter((d) => fs.existsSync(path.join(root, d)));

console.log("==============================================");
console.log("Hub Control Plane - Migration Summary");
console.log("==============================================");
console.log(`Workspace: ${root}`);
console.log(`Docs detected: ${existing.length}/${docs.length}`);
console.log("----------------------------------------------");
for (const d of docs) {
  const ok = existing.includes(d) ? "OK" : "MISSING";
  console.log(`[${ok}] ${d}`);
}
console.log("----------------------------------------------");
console.log("Next commands:");
console.log("1) pnpm hub:migration:check");
console.log("2) pnpm hub:migration:summary");
console.log("3) Revisar y ejecutar BACKLOG_NOW.md");

