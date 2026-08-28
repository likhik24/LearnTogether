import { randomBytes } from 'node:crypto';
import { access, copyFile, chmod, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = path.join(root, 'deploy', 'env.production.example');
const outputPath = path.join(root, 'deploy', '.env.production');

try {
  await access(outputPath, constants.F_OK);
  console.error('deploy/.env.production already exists; refusing to overwrite it.');
  process.exit(1);
} catch {
  // Expected for the first run.
}

await copyFile(templatePath, outputPath);
let contents = await readFile(outputPath, 'utf8');
const secret = (bytes) => randomBytes(bytes).toString('base64url');
contents = contents
  .replace('generate-a-long-alphanumeric-secret', secret(24))
  .replace('generate-at-least-32-random-bytes', secret(48))
  .replace('generate-a-long-random-password', secret(24));
await writeFile(outputPath, contents, { mode: 0o600 });
await chmod(outputPath, 0o600);
console.log('Created deploy/.env.production with mode 0600.');
console.log('Add the Cloudflare Tunnel token locally; do not paste it into chat.');
