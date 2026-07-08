// Local dev launcher: points the server at the repo vault without needing env setup.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.OBSIDIAN_VAULT_PATH ||= path.resolve(here, '..', '..', 'docs', 'obsidian-vault');
process.env.MCP_PORT ||= '4007';

await import('../src/index.js');
