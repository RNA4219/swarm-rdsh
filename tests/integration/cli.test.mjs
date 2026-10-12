import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { sha256 } from '../../lib/gt-dsh/adapter.js';
import test from 'node:test';
import { fixture } from '../helpers.mjs';

const cli = resolve(import.meta.dirname, '../../adapters/gt-dsh/bin/gt-dsh.mjs');
test('CLIの検査結果に秘密値を出さず、readiness合格を捏造しない', (t) => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, [cli, '--config', f.configPath, '--check'], { cwd: f.workspace, env: { ...process.env, ...f.env }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.preflightPassed, true);
  assert.equal(output.readinessVerified, false);
  assert.ok(!result.stdout.includes('canary-secret'));
});

test('未知引数・resumeを起動前に拒否する', (t) => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, [cli, '--config', f.configPath, '--resume', 'old'], { cwd: f.workspace, encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unsupported-argument/);
});

test('Gas Town設定がDSHを唯一のdefault agentにしている', () => {
  const settings = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../config/gastown/config.example.json'), 'utf8'));
  const agents = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../config/gastown/agents.json'), 'utf8'));
  assert.equal(settings.default_agent, 'dsh-worker');
  assert.equal(settings.scheduler.max_polecats, 1);
  assert.equal(agents.agents['dsh-worker'].command, 'gt-dsh');
  assert.equal(agents.agents['dsh-worker'].prompt_mode, 'arg');
  assert.equal(agents.agents['dsh-worker'].resume_flag, undefined);
});

test('通常CLI経路がPID・stdio・引数を保って固定runtimeへexecする（Linux）', { skip: process.platform !== 'linux', timeout: 10000 }, async (t) => {
  const f = fixture(t);
  const script = join(f.root, 'fake-rdsh.mjs');
  const binary = join(f.root, 'fake-rdsh');
  const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  writeFileSync(script, "let input=''; process.stdin.setEncoding('utf8'); process.stdin.on('data', x => input+=x); process.stdin.on('end', () => {console.log(JSON.stringify({pid:process.pid,args:process.argv.slice(2),cwd:process.cwd(),input})); process.exit(17);});\n");
  writeFileSync(binary, '#!/bin/sh\nexec ' + quote(process.execPath) + ' ' + quote(script) + ' "$@"\n');
  chmodSync(binary, 0o755);
  f.config.runtime.rdsh_bin = binary;
  f.lock.runtime_artifacts.rdsh = { path: binary, sha256: sha256(binary) };
  f.save();
  const child = spawn(process.execPath, [cli, '--config', f.configPath], { cwd: f.workspace, env: { ...process.env, ...f.env }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  let stdout = ''; let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  child.stdin.end('contract-input\n');
  const code = await new Promise((resolveCode, reject) => { child.once('error', reject); child.once('close', resolveCode); });
  assert.equal(code, 17, stderr);
  const output = JSON.parse(stdout);
  assert.equal(output.pid, child.pid);
  assert.deepEqual(output.args, ['--profile', 'deepflow-worker-v2_1']);
  assert.equal(output.cwd, f.workspace);
  assert.equal(output.input, 'contract-input\n');
});
