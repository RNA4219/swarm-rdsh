import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { prepareFixtureLaunch, prepareLaunch, sha256 } from '../../lib/gt-dsh/adapter.js';
import { fixture } from '../helpers.mjs';

test('公開fixtureのRefineryには固定overlayを要求し、通常deploymentで受け付けない', { skip: process.platform !== 'linux' }, (t) => {
  const f = fixture(t);
  f.lock.kind = 'qualification-fixture'; f.lock.status = 'testing';
  f.lock.qualification.profile_composition = 'static-verified';
  const marker = join(f.root, 'PUBLIC_FIXTURE.json');
  writeFileSync(marker, JSON.stringify({ scope: 'synthetic-public-fixture' }));
  f.lock.execution_boundary = { fixture_root: f.root, marker_sha256: sha256(marker) };
  const env = { ...f.env, GT_ROLE: 'fixture/refinery' };
  f.save();
  assert.throws(() => prepareFixtureLaunch(f.configPath, f.workspace, env), { code: 'refinery-fixture-profile-missing' });
  const patch = join(f.dshHome, 'refinery-only.patch.yml');
  writeFileSync(patch, '# simulated fixture role overlay\n');
  f.lock.profile_files['refinery-only.patch.yml'] = sha256(patch); f.save();
  assert.ok(prepareFixtureLaunch(f.configPath, f.workspace, env).args.includes(patch));
  assert.throws(() => prepareFixtureLaunch(f.configPath, f.workspace, { ...env, GT_ROLE: 'other/refinery', GT_RIG: 'other' }), { code: 'outside-public-fixture' });
  assert.throws(() => prepareLaunch(f.configPath, f.workspace, env), { code: 'deployment-lock-not-ready' });
});

test('段階負荷fixtureはPolecatごとに隔離HOMEを割り当てる', { skip: process.platform !== 'linux' }, (t) => {
  const f = fixture(t);
  f.lock.kind = 'qualification-fixture'; f.lock.status = 'testing';
  f.lock.qualification.profile_composition = 'static-verified';
  const marker = join(f.root, 'PUBLIC_FIXTURE.json');
  writeFileSync(marker, JSON.stringify({ scope: 'synthetic-public-fixture', purpose: 'staged-load-qualification' }));
  const workerHomes = join(f.root, 'worker-homes');
  mkdirSync(workerHomes);
  f.lock.execution_boundary = {
    fixture_root: f.root,
    marker_sha256: sha256(marker),
    worker_home_mode: 'per-polecat',
    worker_home_root: workerHomes
  };
  f.save();
  const plan = prepareFixtureLaunch(f.configPath, f.workspace, f.env);
  assert.equal(plan.env.HOME, join(workerHomes, 'one'));
  mkdirSync(join(workerHomes, 'one', '.dsh-tui'));
  assert.throws(() => prepareFixtureLaunch(f.configPath, f.workspace, f.env), { code: 'saved-tui-state-not-allowed' });
});

test('Polecat識別不一致ではHOMEを作成しない', { skip: process.platform !== 'linux' }, (t) => {
  const f = fixture(t);
  f.lock.kind = 'qualification-fixture'; f.lock.status = 'testing';
  f.lock.qualification.profile_composition = 'static-verified';
  const marker = join(f.root, 'PUBLIC_FIXTURE.json');
  writeFileSync(marker, JSON.stringify({ scope: 'synthetic-public-fixture', purpose: 'staged-load-qualification' }));
  const workerHomes = join(f.root, 'worker-homes');
  mkdirSync(workerHomes);
  f.lock.execution_boundary = { fixture_root: f.root, marker_sha256: sha256(marker),
    worker_home_mode: 'per-polecat', worker_home_root: workerHomes };
  f.save();
  assert.throws(() => prepareFixtureLaunch(f.configPath, f.workspace, { ...f.env, GT_POLECAT: 'other' }), { code: 'inconsistent-gt-identity' });
  assert.equal(existsSync(join(workerHomes, 'one')), false);
  f.lock.execution_boundary.worker_home_root = join(f.root, '..');
  f.save();
  assert.throws(() => prepareFixtureLaunch(f.configPath, f.workspace, f.env), { code: 'fixture-worker-home-outside-root' });
  assert.equal(existsSync(join(workerHomes, 'one')), false);
});
