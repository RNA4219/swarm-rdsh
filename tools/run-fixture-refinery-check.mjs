// 既存Refineryを1回起動して読む有限のE2E検査。queue/lease/retryを所有しない。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSecret } from './check-secrets.mjs';
const prefix = '/home/ryo-n/.local/share/deepflow-swarm';
const root = join(prefix, 'qualification-20261012');
const town = join(root, 'town');
const env = JSON.parse(readFileSync(join(root, 'controller-env.json'), 'utf8'));
const run = (args, cwd = town) => execFileSync(join(prefix, 'bin/gt'), args, { env, cwd, encoding: 'utf8', timeout: 60000 });
const config = JSON.parse(readFileSync(join(root, 'worker-config.json'), 'utf8'));
function verifyMerged(started, elapsedScope = 'full-e2e') {
  const cwd = join(town, 'fixture/refinery/rig');
  const mergeRequest = JSON.parse(execFileSync(join(prefix, 'bin/bd'), ['show', 'df-wisp-25v', '--json'], { env, cwd, encoding: 'utf8' }))[0];
  const main = execFileSync('git', ['--git-dir=' + join(root, 'origin.git'), 'rev-parse', 'main'], { env, encoding: 'utf8' }).trim();
  execFileSync('git', ['--git-dir=' + join(root, 'origin.git'), 'merge-base', '--is-ancestor', 'af1af6f2f5ed3342c9979c559707c9ec7b93687c', main], { env });
  const acceptance = execFileSync(join(prefix, 'node-v24.15.0-linux-x64/bin/node'), ['sum.test.mjs'], { cwd, env, encoding: 'utf8' }).trim();
  if (mergeRequest.status !== 'closed' || acceptance !== 'ACCEPTANCE_OK' || main === '4a59ff06f9f0d21394a5f435bd258bf0386bcbdc') throw new Error('Queue removal was not a verified merge');
  const result = { scope: 'synthetic-public-fixture', outcome: 'refinery-merged-and-verified', mergeRequest: { id: mergeRequest.id, status: mergeRequest.status, closeReason: mergeRequest.close_reason }, main,
    submittedHead: 'af1af6f2f5ed3342c9979c559707c9ec7b93687c', submittedHeadInMain: true, acceptance, elapsedMs: Date.now() - started, elapsedScope, dshHome: config.runtime.dsh_home, protectedGitHubQualified: false };
  writeFileSync(join(root, 'evidence/refinery-check.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
if (process.argv[2] === '--verify-only') { run(['dolt', 'start']); verifyMerged(Date.now(), 'verification-only'); process.exit(0); }
const wrapper = join(prefix, 'bin/gt-dsh-fixture');
const original = readFileSync(wrapper, 'utf8');
const errorLog = join(root, 'evidence/refinery-startup.stderr');
const priorLogLength = existsSync(errorLog) ? readFileSync(errorLog).length : 0;
if (!original.includes('tools/qualify-worker.mjs')) throw new Error('Unexpected fixture wrapper');
writeFileSync(wrapper, original.trimEnd() + ` 2>>'${join(root, 'evidence/refinery-startup.stderr')}'\n`);
const started = Date.now();
try {
  run(['dolt', 'start']);
  run(['refinery', 'start', 'fixture', '--agent', 'dsh-worker']);
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    const queue = JSON.parse(run(['mq', 'list', 'fixture', '--json'])) ?? [];
    const status = JSON.parse(run(['refinery', 'status', 'fixture', '--json']));
    if (!queue.some((entry) => entry.id === 'df-wisp-25v')) {
      verifyMerged(started);
      break;
    }
    if (!status.running) {
      const path = join(root, 'evidence/refinery-startup.stderr');
      const error = existsSync(path) ? readFileSync(path).subarray(priorLogLength).toString('utf8') : '';
      const envFile = readFileSync(new URL('../.env.deepinfra.local', import.meta.url), 'utf8');
      const value = envFile.split(/\r?\n/).find((line) => line.startsWith('DEEPINFRA_API_KEY='))?.slice('DEEPINFRA_API_KEY='.length).trim().replace(/^(['"])(.*)\1$/, '$2');
      if (value && findSecret(Buffer.from(error), [value])) throw new Error('Private startup diagnostic contains a credential; body was not displayed');
      const safe = error.split('\n').filter((line) => !/Bearer|API_KEY|api.key|authorization|headers/i.test(line)).slice(-25).join('\n');
      console.log(JSON.stringify({ outcome: 'runtime-stopped-before-queue-completion', stderr: safe, elapsedMs: Date.now() - started }));
      throw new Error('Refinery Session/queue completion not confirmed');
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if ((JSON.parse(run(['mq', 'list', 'fixture', '--json'])) ?? []).some((entry) => entry.id === 'df-wisp-25v')) throw new Error('Refinery acceptance timeout');
} finally {
  writeFileSync(wrapper, original);
  run(['refinery', 'stop', 'fixture']);
}
