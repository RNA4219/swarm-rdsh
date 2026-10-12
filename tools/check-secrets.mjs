// 値・行本文を出力せず、公開候補・Git object・配布物への秘密混入を検査する。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function findSecret(bytes, selectedSecrets = []) {
  for (const value of selectedSecrets) {
    for (const encoded of [value, Buffer.from(value).toString('base64'), encodeURIComponent(value)]) {
      if (bytes.includes(Buffer.from(encoded))) return 'selected-credential';
    }
  }
  const text = bytes.toString('utf8');
  if (/\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,})\b/.test(text)
    || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) return 'credential-pattern';
  return null;
}

export function checkSecrets({ root, archive, requireKey = false }) {
  const git = (args, options = {}) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024, ...options });
  const selected = [];
  let deepinfraKeyChecked = false;
  for (const name of ['.env', '.env.deepinfra.local']) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET))\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
      if (value.length < 12 || /^(?:your-|replace-|example|placeholder|local-)/i.test(value)) continue;
      selected.push(value);
      if (match[1] === 'DEEPINFRA_API_KEY') deepinfraKeyChecked = true;
    }
  }
  if (requireKey && !deepinfraKeyChecked) throw new Error('A selected DeepInfra credential was not available for local comparison');
  const failures = [];
  const inspect = (bytes, scope, id) => {
    const reason = findSecret(bytes, [...new Set(selected)]);
    if (reason) failures.push({ scope, id, reason });
  };
  const working = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean);
  for (const name of new Set(working)) if (existsSync(join(root, name))) {
    if (/^(?:\.env(?:$|\.)|.*\/\.env(?:$|\.))/.test(name) && !/\.env\.(?:example|sample)$/.test(name)) failures.push({ scope: 'working-tree', id: name, reason: 'private-env-tracked' });
    inspect(readFileSync(join(root, name)), 'working-tree', name);
  }
  const staged = git(['ls-files', '--stage', '-z']);
  const stageIds = staged.toString().split('\0').filter(Boolean).map((row) => row.split(' ')[1]);
  const history = git(['rev-list', '--objects', '--all']).toString().split('\n').filter(Boolean).map((row) => row.slice(0, 40));
  const objects = [...new Set([...stageIds, ...history])];
  const stream = git(['cat-file', '--batch'], { input: objects.join('\n') + '\n' });
  let offset = 0;
  for (const expected of objects) {
    const newline = stream.indexOf(10, offset);
    if (newline < 0) throw new Error('Incomplete Git object inspection');
    const [id, type, sizeText] = stream.subarray(offset, newline).toString().split(' ');
    const size = Number(sizeText);
    if (id !== expected || !['blob', 'tree', 'commit', 'tag'].includes(type) || !Number.isSafeInteger(size) || size < 0) throw new Error('Invalid Git object inspection');
    const contentStart = newline + 1;
    inspect(stream.subarray(contentStart, contentStart + size), 'git-object', id);
    offset = contentStart + size + 1;
  }
  let archiveFiles = 0;
  if (archive) {
    const members = execFileSync('tar', ['-tf', archive], { encoding: 'utf8', timeout: 15000 }).split(/\r?\n/).filter(Boolean);
    for (const member of members) {
      if (member.endsWith('/')) continue;
      if (!member.startsWith('package/') || member.includes('..') || /(?:^|\/)\.env(?:$|\.)|\.local\.(?:json|ya?ml)$|credentials/i.test(member)) failures.push({ scope: 'package', id: member, reason: 'private-package-entry' });
      inspect(execFileSync('tar', ['-xOf', archive, member], { maxBuffer: 16 * 1024 * 1024, timeout: 15000 }), 'package', member);
      archiveFiles++;
    }
  }
  const head = git(['rev-parse', 'HEAD']).toString().trim();
  const result = { status: failures.length ? 'failed' : 'passed', head, deepinfraKeyChecked, selectedCredentialCount: new Set(selected).size,
    workingFiles: new Set(working).size, gitObjects: objects.length, indexSha256: createHash('sha256').update(staged).digest('hex'), archiveFiles, failures };
  if (failures.length) { console.error(JSON.stringify(result)); throw new Error('Secret exclusion check failed; credential values were not printed'); }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const args = process.argv.slice(2);
  const requireKey = args.includes('--require-key');
  const archiveIndex = args.indexOf('--archive');
  const archive = archiveIndex >= 0 ? resolve(args[archiveIndex + 1] ?? '') : undefined;
  const valid = args.filter((_, index) => archiveIndex < 0 || (index !== archiveIndex && index !== archiveIndex + 1));
  if (valid.some((arg) => arg !== '--require-key')) throw new Error('Unknown secret-check argument');
  const result = checkSecrets({ root, archive, requireKey });
  mkdirSync(join(root, '.runtime'), { recursive: true });
  writeFileSync(join(root, '.runtime/secrets-check.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
