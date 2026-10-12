import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';
import { withStartupPrompt } from '../../lib/gt-dsh/adapter.js';
import { fixture } from '../helpers.mjs';

test('Gas Town初期指示を一つのliteral app argvとして渡す', () => {
  const plan = { command: '/rdsh', args: ['--profile', 'worker'], cwd: '/work', env: {} };
  const prompt = 'gt prime\nLiteral $(whoami) `unchanged`';
  assert.deepEqual(withStartupPrompt(plan, prompt).args, ['--profile', 'worker', '--', prompt]);
  assert.deepEqual(plan.args, ['--profile', 'worker']);
  assert.throws(() => withStartupPrompt(plan, 'bad\0input'), /invalid-startup-prompt/);
  assert.throws(() => withStartupPrompt(plan, 'a'.repeat(65537)), /invalid-startup-prompt/);
});

test('起動前検査に初期指示本文を出さず、fixture資格を通常deploymentで受け付けない', (t) => {
  const f = fixture(t);
  const cli = resolve(import.meta.dirname, '../../adapters/gt-dsh/bin/gt-dsh.mjs');
  const args = [cli, '--config', f.configPath, '--check', 'canary-secret-prompt'];
  const result = spawnSync(process.execPath, args, { cwd: f.workspace, env: { ...process.env, ...f.env }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).startupPromptPresent, true);
  assert.ok(!result.stdout.includes('canary-secret-prompt'));
  f.lock.kind = 'qualification-fixture'; f.lock.status = 'testing'; f.save();
  const rejected = spawnSync(process.execPath, args, { cwd: f.workspace, env: { ...process.env, ...f.env }, encoding: 'utf8' });
  assert.equal(rejected.status, 2);
  assert.match(rejected.stderr, /deployment-lock-not-ready/);
});
