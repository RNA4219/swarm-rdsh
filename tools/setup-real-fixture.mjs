// 固定ソースの公開接続試験を準備する。既存town/repo/HOMEを使わない。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prefix = '/home/ryo-n/.local/share/deepflow-swarm';
const root = join(prefix, 'qualification-20261012');
const dshSource = join(prefix, 'sources/dsh-d743267388641bc76f17c45ce8b4c231aed1d32c');
const tuiSource = join(prefix, 'sources/dsh-tui-76c2a26b7f0d81e91b04c848e8aa9671f93ed046');
const node = join(prefix, 'node-v24.15.0-linux-x64/bin/node');
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
if (existsSync(root)) throw new Error('Refusing existing fixture; inspect previous result first');
mkdirSync(root, { mode: 0o700 });
json(join(root, 'PUBLIC_FIXTURE.json'), { scope: 'synthetic-public-fixture', task: 'Fix add(a,b) and pass node test', network_push: false });
const controllerHome = join(root, 'controller-home');
const home = join(root, 'worker-home');
const dshHome = join(root, 'dsh-home');
const profile = join(dshHome, 'profiles/deepflow-worker-v2_1');
for (const path of [controllerHome, home, profile, join(root, 'tmux'), join(root, 'evidence')]) mkdirSync(path, { recursive: true, mode: 0o700 });
writeFileSync(join(controllerHome, '.gitconfig'), '[user]\n name = DeepFlow Fixture\n email = fixture@example.invalid\n');
const env = { HOME: controllerHome, PATH: [dirname(node), join(prefix, 'bin'), '/usr/bin', '/bin'].join(':'), LANG: 'C.UTF-8', TMUX_TMPDIR: join(root, 'tmux'), GIT_AUTHOR_NAME: 'DeepFlow Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'DeepFlow Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
json(join(root, 'controller-env.json'), env);
for (const workerHome of [controllerHome, home]) {
  execFileSync(join(prefix, 'bin/dolt'), ['config', '--global', '--add', 'versioncheck.disabled', 'true'], { env, cwd: workerHome, stdio: 'ignore' });
}
const seed = join(root, 'seed');
mkdirSync(seed);
writeFileSync(join(seed, 'sum.mjs'), 'export const add = (a, b) => a - b;\n');
writeFileSync(join(seed, 'sum.test.mjs'), "import { strict as assert } from 'node:assert';\nimport { add } from './sum.mjs';\nassert.equal(add(2, 3), 5);\nassert.equal(add(-4, 7), 3);\nassert.equal(add(0, 0), 0);\nconsole.log('ACCEPTANCE_OK');\n");
writeFileSync(join(seed, 'AGENTS.md'), '# Public fixture\nImplement only the assigned arithmetic fix. Run `node sum.test.mjs`. Commit on the polecat branch and call `gt done`. Do not read environment variables or credentials. Do not merge or push main.\n');
execFileSync('git', ['init', '-q', '-b', 'main', seed], { env });
execFileSync('git', ['add', '.'], { cwd: seed, env });
execFileSync('git', ['commit', '-qm', 'Public arithmetic fixture'], { cwd: seed, env });
execFileSync('git', ['clone', '-q', '--bare', seed, join(root, 'origin.git')], { env });
copyFileSync(join(repo, 'config/dsh/worker-profile/cordis.patch.yml'), join(profile, 'cordis.patch.yml'));
copyFileSync(join(repo, 'config/dsh/worker-profile/fixture-only.patch.yml'), join(dshHome, 'fixture-only.patch.yml'));
writeFileSync(join(dshHome, 'cordis.patch.yml'), '# Machine layer intentionally empty.\n[]\n');
json(join(profile, 'package.json'), { name: 'deepflow-worker-v2_1', private: true, type: 'module', dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-harness-tui/dsh-tui'] } } });
const modules = join(profile, 'node_modules');
mkdirSync(modules, { recursive: true });
const candidates = [];
for (const parent of ['packages', 'vendor', 'apps', 'native/system/packages']) {
  const directory = join(dshSource, parent);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const first = join(directory, entry.name);
    if (existsSync(join(first, 'package.json'))) candidates.push(first);
    else for (const child of readdirSync(first, { withFileTypes: true })) if (child.isDirectory() && existsSync(join(first, child.name, 'package.json'))) candidates.push(join(first, child.name));
  }
}
for (const source of [...candidates, tuiSource]) {
  const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
  if (!manifest.name?.startsWith('@deepseek-')) continue;
  const target = join(modules, manifest.name);
  mkdirSync(dirname(target), { recursive: true });
  if (!existsSync(target)) symlinkSync(source, target, 'dir');
}
const dshBin = join(prefix, 'bin/dsh');
if (!existsSync(dshBin)) symlinkSync(join(dshSource, 'apps/cli/lib/bin.js'), dshBin);
const fixtureBin = join(prefix, 'bin/gt-dsh-fixture');
writeFileSync(fixtureBin, `#!/bin/sh\nexec '${node}' '${join(repo, 'tools/qualify-worker.mjs')}' '${join(root, 'worker-config.json')}' '${join(repo, '.env.deepinfra.local')}' "$@"\n`);
chmodSync(fixtureBin, 0o755);
const modelRoute = { provider: 'deepinfra', id: 'zai-org/GLM-5.3-Flash', endpoint: 'https://api.deepinfra.com/v1/openai', api_key_env: 'DEEPINFRA_API_KEY' };
const artifacts = {};
for (const [name, path] of Object.entries({ node, dsh: dshBin, rdsh: join(prefix, 'bin/rdsh'), gt: join(prefix, 'bin/gt'), bd: join(prefix, 'bin/bd'), dolt: join(prefix, 'bin/dolt'), bwrap: '/usr/bin/bwrap' })) artifacts[name] = { path, sha256: hash(path), ...(name === 'node' ? { version: '24.15.0' } : {}) };
const profileFiles = {};
for (const name of ['profiles/deepflow-worker-v2_1/package.json', 'profiles/deepflow-worker-v2_1/cordis.patch.yml', 'cordis.patch.yml', 'fixture-only.patch.yml']) profileFiles[name] = hash(join(dshHome, name));
json(join(root, 'fixture.lock.json'), {
  kind: 'qualification-fixture', status: 'testing', required_unresolved: ['privacy_canary', 'pty_e2e'],
  source_candidates: Object.entries({ gastown: '649b832b7672bc7a2dbef26f5983aba6198b819b', dsh: 'd743267388641bc76f17c45ce8b4c231aed1d32c', rustdsh: 'a1be438e232278add3ee130e7d77aaa02f9f68c5', 'dsh-tui': '76c2a26b7f0d81e91b04c848e8aa9671f93ed046' }).map(([name, commit]) => ({ name, commit })),
  model_route: modelRoute, runtime_artifacts: artifacts, profile_files: profileFiles,
  execution_boundary: { fixture_root: root, runtime_root: prefix, marker_sha256: hash(join(root, 'PUBLIC_FIXTURE.json')), mechanism: 'bubblewrap', production_qualified: false },
  qualification: { build: 'passed', profile_composition: 'pending', privacy_canary: 'pending', pty_e2e: 'pending' },
});
json(join(root, 'worker-config.json'), { version: 1, profile: 'deepflow-worker-v2_1', runtime: { rdsh_bin: join(prefix, 'bin/rdsh'), dsh_bin: dshBin, dsh_home: dshHome, worker_home: home, deployment_lock: join(root, 'fixture.lock.json'), path: [dirname(node), join(prefix, 'bin'), '/usr/bin', '/bin'] }, model: modelRoute });
console.log(JSON.stringify({ fixtureRoot: root, artifacts: Object.keys(artifacts), model: modelRoute.id, credentialStored: false }));
