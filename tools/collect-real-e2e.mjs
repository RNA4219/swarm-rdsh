// DSH Session・Beads・Git・既存MQを照合し、会話の第二の正本を作らず検証結果だけ保存する。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zstdDecompressSync } from 'node:zlib';
import { scanZstdFrames } from '/home/ryo-n/.local/share/deepflow-swarm/sources/dsh-d743267388641bc76f17c45ce8b4c231aed1d32c/packages/session/session-persistence-jsonl/src/zstd.ts';
const prefix = '/home/ryo-n/.local/share/deepflow-swarm';
const root = join(prefix, 'qualification-20261012');
const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const town = join(root, 'town');
const workspace = join(town, 'fixture/polecats/rust/fixture');
const env = JSON.parse(readFileSync(join(root, 'controller-env.json'), 'utf8'));
const run = (name, args, cwd = town) => execFileSync(name, args, { cwd, env, encoding: 'utf8', timeout: 30000 }).trim();
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const beadId = readFileSync(join(root, 'evidence/bead-id.txt'), 'utf8').trim();
const bead = JSON.parse(run(join(prefix, 'bin/bd'), ['show', beadId, '--json'], join(town, 'fixture')))[0];
const queue = JSON.parse(run(join(prefix, 'bin/gt'), ['mq', 'list', 'fixture', '--json']));
const head = run('git', ['rev-parse', 'HEAD'], workspace);
const base = run('git', ['rev-parse', 'HEAD'], join(root, 'seed'));
const main = run('git', ['--git-dir=' + join(root, 'origin.git'), 'rev-parse', 'main']);
const branch = run('git', ['branch', '--show-current'], workspace);
const published = run('git', ['--git-dir=' + join(root, 'origin.git'), 'rev-parse', branch]);
const acceptance = run(join(prefix, 'node-v24.15.0-linux-x64/bin/node'), ['sum.test.mjs'], workspace);
if (bead.status !== 'closed' || queue.length !== 1 || !queue[0].description.includes(`source_issue: ${beadId}`)
  || !queue[0].description.includes(`commit_sha: ${head}`) || main !== base || published !== head
  || run('git', ['status', '--porcelain'], workspace) || acceptance !== 'ACCEPTANCE_OK') throw new Error('E2E state reconciliation failed');
const keyLine = readFileSync(join(repo, '.env.deepinfra.local'), 'utf8').split(/\r?\n/).find((line) => line.startsWith('DEEPINFRA_API_KEY='));
const key = keyLine.slice('DEEPINFRA_API_KEY='.length).trim().replace(/^(['"])(.*)\1$/, '$2');
const sessionEvidence = [];
for (const attempt of [5, 6]) {
  const directory = join(root, `attempts/${attempt}/dsh-home/sessions`);
  for (const project of readdirSync(directory)) for (const id of readdirSync(join(directory, project))) {
    const path = join(directory, project, id, 'session.v4.jsonl.zstd');
    const bytes = readFileSync(path);
    const scan = scanZstdFrames(bytes);
    if (scan.tornStart !== undefined) throw new Error('Torn DSH session record');
    const decoded = scan.frames.map((frame) => zstdDecompressSync(bytes.subarray(frame.start, frame.end)).toString('utf8')).join('');
    if (key && decoded.includes(key)) throw new Error('Selected credential appeared in session log');
    const rows = decoded.split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const calls = rows.filter((row) => row.type === 'tool/call').map((row) => ({ name: row.data.name, arguments: JSON.parse(row.data.arguments) }));
    const commandExists = (text) => calls.some((call) => typeof call.arguments.command === 'string' && call.arguments.command.includes(text));
    const header = rows.find((row) => row.type === 'request/header')?.data;
    sessionEvidence.push({ attempt, id, sourcePath: path, sha256: digest(path), records: rows.length,
      toolCalls: calls.length, toolNamesUsed: [...new Set(calls.map((call) => call.name))],
      primeExecuted: commandExists('gt prime'), acceptanceExecuted: commandExists('node sum.test.mjs'), doneInvoked: commandExists('gt done'),
      requestHeaderFields: Object.keys(header ?? {}), usageRecords: rows.filter((row) => row.type === 'assistant/message').map((row) => row.data.usage).filter(Boolean),
      selectedCredentialInHistory: false, toolResultAfterFinalDonePresent: attempt === 5,
    });
  }
}
if (!sessionEvidence.every((session) => session.primeExecuted && session.doneInvoked)) throw new Error('Missing real DSH command evidence');
const lock = JSON.parse(readFileSync(join(root, 'fixture.lock.json'), 'utf8'));
lock.qualification.profile_composition = 'passed-public-fixture';
lock.qualification.pty_e2e = 'passed-with-manual-recovery';
lock.required_unresolved = ['production-compatibility', 'privacy_canary', 'nudge-terminal-contract', 'automatic-recovery', 'refinery-merge'];
const runtime = { ...lock.runtime_artifacts };
for (const [name, path] of Object.entries({ git: '/usr/bin/git', tmux: '/usr/bin/tmux', go: join(prefix, 'toolchains/go1.26.2/bin/go'), rustc: join(prefix, 'toolchains/rustup/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin/rustc') })) runtime[name] = { path, sha256: digest(path) };
const sourceRoots = {
  dsh: join(prefix, 'sources/dsh-d743267388641bc76f17c45ce8b4c231aed1d32c'),
  tui: join(prefix, 'sources/dsh-tui-76c2a26b7f0d81e91b04c848e8aa9671f93ed046'),
  rustdsh: join(prefix, 'sources/rustdsh-a1be438e232278add3ee130e7d77aaa02f9f68c5'),
};
const sourceLocks = { dsh: digest(join(sourceRoots.dsh, 'pnpm-lock.yaml')), tui: digest(join(sourceRoots.tui, 'pnpm-lock.yaml')), rustdsh: digest(join(sourceRoots.rustdsh, 'Cargo.lock')) };
const result = { scope: 'synthetic-public-fixture', outcome: 'worker-completed-and-refinery-queue-submitted',
  bead: { id: bead.id, status: bead.status, closedAt: bead.closed_at },
  mergeRequest: { id: queue[0].id, status: queue[0].status, branch, target: 'main', commit: head },
  acceptance: { assertions: 3, result: acceptance }, base, main, publishedCommit: published, mainChanged: false,
  model: lock.model_route, sessionEvidence, runtime, sourceLocks,
  nativeAssets: Object.fromEntries(['landlock-run', 'glibc/system.node', 'musl/system.node'].map((name) => [name, digest(join(sourceRoots.dsh, 'native/system/packages/linux-x64/bin', name))])),
  manualRecovery: ['Git info/exclude for managed scaffolding', 'Gas Town session stop/start with a fresh DSH Session'],
  nudgeTerminalContract: 'failed-enter-receipt-verification', injectionContract: 'failed-long-unix-socket-path',
  privacyQualification: 'not-complete', integrationMerged: false, productionQualified: false,
};
writeFileSync(join(root, 'fixture.lock.json'), JSON.stringify(lock, null, 2) + '\n');
writeFileSync(join(root, 'evidence/REAL_E2E.json'), JSON.stringify(result, null, 2) + '\n');
writeFileSync(join(repo, '.runtime/REAL_E2E.json'), JSON.stringify(result, null, 2) + '\n');
writeFileSync(join(repo, '.runtime/fixture.lock.json'), JSON.stringify(lock, null, 2) + '\n');
console.log(JSON.stringify({ outcome: result.outcome, bead: result.bead, mergeRequest: result.mergeRequest, acceptance: result.acceptance, mainChanged: false, productionQualified: false }));
