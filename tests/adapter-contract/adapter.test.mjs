import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildEnvironment, parseConfig, prepareLaunch, validateIdentity, validateLock } from '../../lib/gt-dsh/adapter.js';
import { fixture } from '../helpers.mjs';

test('固定profileへ委譲し、Session/worker IDを生成・上書きしない', (t) => {
  const f = fixture(t);
  const plan = prepareLaunch(f.configPath, f.workspace, f.env);
  assert.deepEqual(plan.args, ['--profile', 'deepflow-worker-v2_1']);
  assert.equal(plan.cwd, f.workspace);
  assert.equal(plan.env.GT_POLECAT, 'one');
  assert.equal(plan.env.DSH_SESSION_ID, undefined);
});

test('host credential・proxy・Node preload・保存済みSessionを継承しない', (t) => {
  const f = fixture(t);
  const env = buildEnvironment(parseConfig(f.config), { ...f.env, OPENAI_API_KEY: 'forbidden', GH_TOKEN: 'forbidden', NODE_OPTIONS: '--require=bad', HTTP_PROXY: 'forbidden', DSH_TUI_RESUME_SESSION: 'old', BEADS_DIR: 'wrong-database' });
  for (const key of ['OPENAI_API_KEY', 'GH_TOKEN', 'NODE_OPTIONS', 'HTTP_PROXY', 'DSH_TUI_RESUME_SESSION', 'BEADS_DIR']) assert.equal(env[key], undefined);
  assert.equal(env.FIXTURE_API_KEY, 'canary-secret');
  assert.equal(env.DSH_TELEMETRY_MODE, 'DISABLED');
  assert.equal(env.DSH_TUI_BACKEND, 'dsh');
});

test('Gas Townの複合roleと識別子の不一致を拒否する', () => {
  assert.throws(() => validateIdentity({ GT_ROLE: 'rig/polecats/a', GT_RIG: 'other', GT_POLECAT: 'a' }), /inconsistent-gt-identity/);
});

test('設計候補lockでは起動しない', (t) => {
  const f = fixture(t);
  f.lock.status = 'blocked'; f.save();
  assert.throws(() => prepareLaunch(f.configPath, f.workspace, f.env), /deployment-lock-not-ready/);
});

test('実体・profile・モデル経路の変更で旧lockを拒否する', (t) => {
  const f = fixture(t);
  f.lock.runtime_artifacts.rdsh.sha256 = '0'.repeat(64); f.save();
  assert.throws(() => validateLock(parseConfig(f.config)), /runtime-artifact-mismatch/);
  f.lock.runtime_artifacts.rdsh.sha256 = f.lock.runtime_artifacts.dsh.sha256;
  f.lock.model_route.id = 'changed'; f.save();
  assert.throws(() => validateLock(parseConfig(f.config)), /model-route-not-locked/);
  f.lock.model_route.id = f.config.model.id; f.save();
  writeFileSync(join(f.dshHome, 'cordis.patch.yml'), 'changed');
  assert.throws(() => validateLock(parseConfig(f.config)), /profile-file-mismatch/);
});

test('共有HOMEの保存設定とworktreeの.envを拒否する', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.workspace, '.env'), 'SECRET=canary');
  assert.throws(() => prepareLaunch(f.configPath, f.workspace, f.env), /project-dotenv-not-allowed/);
  writeFileSync(join(f.home, '.env'), 'SECRET=canary');
  assert.throws(() => validateLock(parseConfig(f.config)), /ambient-credentials-not-allowed/);
});

test('未指定・不正なendpointや任意credential envを拒否する', (t) => {
  const f = fixture(t);
  f.config.model.endpoint = 'https://example.com/v1?token=secret';
  assert.throws(() => parseConfig(f.config), /invalid-model-endpoint/);
  f.config.model.endpoint = 'http://example.com/v1';
  assert.throws(() => parseConfig(f.config), /unprotected-model-endpoint/);
  f.config.model.endpoint = 'http://127.0.0.1:9999';
  f.config.model.api_key_env = 'NODE_OPTIONS';
  assert.throws(() => parseConfig(f.config), /invalid-credential-env/);
});

test('profileのpath traversalと固定sourceのすり替えを拒否する', (t) => {
  const f = fixture(t);
  f.lock.source_candidates[0].commit = 'bad'; f.save();
  assert.throws(() => validateLock(parseConfig(f.config)), /source-commit-mismatch/);
  f.lock.source_candidates[0].commit = '649b832b7672bc7a2dbef26f5983aba6198b819b';
  f.lock.profile_files['../outside'] = 'bad'; f.save();
  assert.throws(() => validateLock(parseConfig(f.config)), /profile-file-mismatch/);
});

test('資格未完了と保存済みTUI設定を拒否する', (t) => {
  const f = fixture(t);
  f.lock.qualification.privacy_canary = 'not-run'; f.save();
  assert.throws(() => validateLock(parseConfig(f.config)), /runtime-not-qualified/);
  f.lock.qualification.privacy_canary = 'passed'; f.save();
  mkdirSync(join(f.home, '.dsh-tui'));
  assert.throws(() => validateLock(parseConfig(f.config)), /saved-tui-state-not-allowed/);
});
