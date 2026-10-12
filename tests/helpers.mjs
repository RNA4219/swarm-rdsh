import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { PROFILE, SOURCE_COMMITS, sha256 } from '../lib/gt-dsh/adapter.js';

export function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'deepflow-contract-'));
  t.after(() => {
    const target = realpathSync(root);
    if (dirname(target) !== realpathSync(tmpdir()) || !basename(target).startsWith('deepflow-contract-')) throw new Error('Unexpected cleanup target');
    rmSync(target, { recursive: true, force: true });
  });
  const workspace = join(root, 'worktree');
  const home = join(root, 'home');
  const dshHome = join(root, 'dsh-home');
  for (const dir of [workspace, home, dshHome]) mkdirSync(dir, { recursive: true });
  const git = spawnSync('git', ['init', '--quiet', workspace]);
  if (git.status !== 0) throw new Error('Test Git initialization failed');
  const profiles = {};
  const files = {
    [`profiles/${PROFILE}/package.json`]: JSON.stringify({ dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-harness-tui/dsh-tui'] } } }),
    [`profiles/${PROFILE}/cordis.patch.yml`]: '# simulated profile only\n',
    'cordis.patch.yml': '# simulated final override only\n',
  };
  for (const [name, content] of Object.entries(files)) {
    const path = join(dshHome, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    profiles[name] = sha256(path);
  }
  const route = { provider: 'fixture', id: 'fixture-model', endpoint: 'http://127.0.0.1:9999/v1', api_key_env: 'FIXTURE_API_KEY' };
  const lockPath = join(root, 'deployment.lock');
  const binary = process.execPath;
  const lock = {
    kind: 'deployment', status: 'ready', required_unresolved: [], model_route: route,
    source_candidates: Object.entries(SOURCE_COMMITS).map(([name, commit]) => ({ name, commit })),
    runtime_artifacts: { rdsh: { path: binary, sha256: sha256(binary) }, dsh: { path: binary, sha256: sha256(binary) }, node: { path: binary, sha256: sha256(binary), version: process.versions.node } },
    profile_files: profiles,
    qualification: { build: 'passed', profile_composition: 'passed', privacy_canary: 'passed', pty_e2e: 'passed' },
  };
  const config = {
    version: 1, profile: PROFILE,
    runtime: { rdsh_bin: binary, dsh_bin: binary, dsh_home: dshHome, worker_home: home, deployment_lock: lockPath, path: [dirname(binary)] },
    model: { ...route },
  };
  const configPath = join(root, 'config.json');
  const save = () => { writeFileSync(lockPath, JSON.stringify(lock)); writeFileSync(configPath, JSON.stringify(config)); };
  save();
  const env = { GT_ROLE: 'fixture/polecats/one', GT_RIG: 'fixture', GT_POLECAT: 'one', GT_AGENT: 'dsh-worker', FIXTURE_API_KEY: 'canary-secret' };
  return { root, workspace, home, dshHome, lock, lockPath, config, configPath, save, env };
}
