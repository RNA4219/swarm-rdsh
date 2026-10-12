import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const archive = process.argv[2] ? resolve(process.argv[2]) : resolve(root, `.runtime/distribution/${manifest.name}-${manifest.version}.tgz`);
const result = spawnSync('tar', ['-tf', archive], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
if (result.status !== 0) throw new Error('Package archive cannot be inspected');
const members = result.stdout.trim().split(/\r?\n/);
for (const required of ['package/lib/gt-dsh/cli.js', 'package/lib/gt-dsh/adapter.js', 'package/adapters/gt-dsh/bin/gt-dsh.mjs', 'package/LICENSE',
  'package/ACKNOWLEDGEMENTS.md', 'package/THIRD_PARTY_NOTICES.md', 'package/SECURITY.md', 'package/CHANGELOG.md', 'package/docs/RELEASE.md',
  'package/third_party/upstream-sources.json', 'package/third_party/adapter-dev.sbom.cdx.json', 'package/docs/evidence/qualification-20261013.json']) {
  if (!members.includes(required)) throw new Error(`Missing package entry: ${required}`);
}
if (members.some((name) => !name.startsWith('package/') || /(^|\/)\.env|\.py$|\.whl$|deerflow-models|\.\.\//.test(name))) {
  throw new Error('Unexpected private or legacy executable entry');
}
console.log(JSON.stringify({ packageContents: 'passed', members: members.length }));
