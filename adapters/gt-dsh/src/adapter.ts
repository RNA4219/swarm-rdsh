import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export const PROFILE = 'deepflow-worker-v2_1';
export const SOURCE_COMMITS = {
  gastown: '649b832b7672bc7a2dbef26f5983aba6198b819b',
  dsh: 'd743267388641bc76f17c45ce8b4c231aed1d32c',
  rustdsh: 'a1be438e232278add3ee130e7d77aaa02f9f68c5',
  'dsh-tui': '76c2a26b7f0d81e91b04c848e8aa9671f93ed046',
} as const;
export const IDENTITY_ENV = [
  'GT_ROLE', 'GT_RIG', 'GT_POLECAT', 'GT_CREW', 'GT_ROOT', 'GT_TOWN_ROOT', 'GT_SESSION', 'GT_AGENT',
  'GT_DOG_NAME', 'BD_ACTOR', 'BEADS_AGENT_NAME', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL',
  'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'TMUX', 'TMUX_TMPDIR',
  'GIT_CEILING_DIRECTORIES', 'BD_DOLT_AUTO_COMMIT', 'BD_BACKUP_ENABLED',
  'GT_DOLT_HOST', 'GT_DOLT_PORT', 'BEADS_DOLT_SERVER_HOST', 'BEADS_DOLT_AUTO_START',
] as const;
export const LOCALE_ENV = ['TERM', 'COLORTERM', 'LANG', 'LC_ALL', 'TZ'] as const;

export class ContractError extends Error {
  constructor(public readonly code: string) { super(code); }
}
type JsonObject = Record<string, unknown>;
function object(value: unknown, code: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContractError(code);
  return value as JsonObject;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim() || /[\0\r\n]/.test(value)) throw new ContractError(code);
  return value;
}
function absolute(value: unknown, code: string): string {
  const path = text(value, code);
  if (!isAbsolute(path)) throw new ContractError(code);
  return resolve(path);
}
export function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
export function readJson(path: string): JsonObject {
  try { return object(JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')), 'invalid-json'); }
  catch (error) { if (error instanceof ContractError) throw error; throw new ContractError('unreadable-json'); }
}
function inside(parent: string, child: string): boolean {
  const remainder = relative(parent, child);
  return !isAbsolute(remainder) && remainder !== '..' && !remainder.startsWith(`..${sep}`);
}
function existingDirectory(value: unknown, code: string): string {
  const path = absolute(value, code);
  if (!existsSync(path) || !statSync(path).isDirectory()) throw new ContractError(code);
  return realpathSync(path);
}
export interface WorkerConfig {
  rdsh: string; dsh: string; dshHome: string; home: string; lock: string;
  searchPath: string[]; provider: string; model: string; endpoint: string;
  credentialEnv: string | null;
}
export function parseConfig(input: JsonObject): WorkerConfig {
  if (input.version !== 1 || input.profile !== PROFILE) throw new ContractError('unsupported-config');
  const runtime = object(input.runtime, 'missing-runtime');
  const route = object(input.model, 'missing-model-route');
  const endpoint = text(route.endpoint, 'missing-model-endpoint');
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new ContractError('invalid-model-endpoint'); }
  if (url.username || url.password || url.search || url.hash) throw new ContractError('invalid-model-endpoint');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new ContractError('unprotected-model-endpoint');
  }
  const credentialEnv = route.api_key_env === null ? null : text(route.api_key_env, 'invalid-credential-env');
  if (credentialEnv !== null && !/^[A-Z][A-Z0-9_]*_API_KEY$/.test(credentialEnv)) throw new ContractError('invalid-credential-env');
  if (!Array.isArray(runtime.path) || !runtime.path.length) throw new ContractError('missing-runtime-path');
  return {
    rdsh: absolute(runtime.rdsh_bin, 'missing-rdsh'), dsh: absolute(runtime.dsh_bin, 'missing-dsh'),
    dshHome: existingDirectory(runtime.dsh_home, 'missing-dsh-home'),
    home: existingDirectory(runtime.worker_home, 'missing-worker-home'),
    lock: absolute(runtime.deployment_lock, 'missing-deployment-lock'),
    searchPath: runtime.path.map((entry) => existingDirectory(entry, 'invalid-runtime-path')),
    provider: text(route.provider, 'missing-model-provider'), model: text(route.id, 'missing-model-id'), endpoint, credentialEnv,
  };
}
export function validateIdentity(env: NodeJS.ProcessEnv): void {
  const role = text(env.GT_ROLE, 'missing-gt-role');
  const match = /^([^/]+)\/(polecats|crew)\/([^/]+)$/.exec(role);
  if (match && (env.GT_RIG !== match[1] || env[match[2] === 'polecats' ? 'GT_POLECAT' : 'GT_CREW'] !== match[3])) {
    throw new ContractError('inconsistent-gt-identity');
  }
  if (!match && !/^(mayor|deacon|deacon\/boot|dog|[^/]+\/(witness|refinery))$/.test(role)) throw new ContractError('unsupported-gt-role');
  if (env.GT_AGENT && env.GT_AGENT !== 'dsh-worker') throw new ContractError('unexpected-gt-agent');
}
export function validateWorkspace(cwd: string): string {
  const canonical = realpathSync(cwd);
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: canonical, encoding: 'utf8', timeout: 5000, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
  if (git.status !== 0 || !git.stdout.trim() || realpathSync(git.stdout.trim()) !== canonical) throw new ContractError('not-worktree-root');
  if (existsSync(join(canonical, '.env'))) throw new ContractError('project-dotenv-not-allowed');
  return canonical;
}
export function validateLock(config: WorkerConfig): void {
  const lock = readJson(config.lock);
  if (lock.kind !== 'deployment' || lock.status !== 'ready' || !Array.isArray(lock.required_unresolved) || lock.required_unresolved.length) {
    throw new ContractError('deployment-lock-not-ready');
  }
  validateRuntimeAssets(config, lock);
  const qualification = object(lock.qualification, 'qualification-missing');
  for (const test of ['build', 'profile_composition', 'privacy_canary', 'pty_e2e']) {
    if (qualification[test] !== 'passed') throw new ContractError('runtime-not-qualified');
  }
}
/** 初回契約試験でも実体・profile・モデル経路は通常起動と同じ検査を通す。 */
export function validateRuntimeAssets(config: WorkerConfig, lock: JsonObject): void {
  if (!Array.isArray(lock.source_candidates)) throw new ContractError('sources-not-locked');
  for (const [name, commit] of Object.entries(SOURCE_COMMITS)) {
    const matches = lock.source_candidates.filter((source) => object(source, 'invalid-source-lock').name === name);
    if (matches.length !== 1 || object(matches[0], 'invalid-source-lock').commit !== commit) throw new ContractError('source-commit-mismatch');
  }
  const route = object(lock.model_route, 'lock-model-route-missing');
  if (route.provider !== config.provider || route.id !== config.model || route.endpoint !== config.endpoint || route.api_key_env !== config.credentialEnv) {
    throw new ContractError('model-route-not-locked');
  }
  const artifacts = object(lock.runtime_artifacts, 'runtime-artifacts-not-locked');
  for (const [name, path] of [['rdsh', config.rdsh], ['dsh', config.dsh], ['node', process.execPath]] as const) {
    const artifact = object(artifacts[name], 'runtime-artifact-missing');
    if (artifact.path !== path || !existsSync(path) || !statSync(path).isFile() || artifact.sha256 !== sha256(path)) throw new ContractError('runtime-artifact-mismatch');
  }
  const nodeArtifact = object(artifacts.node, 'runtime-artifact-missing');
  if (nodeArtifact.version !== process.versions.node) throw new ContractError('node-version-mismatch');
  const profiles = object(lock.profile_files, 'profile-files-not-locked');
  const expectedManifest = `profiles/${PROFILE}/package.json`;
  const expectedPatch = `profiles/${PROFILE}/cordis.patch.yml`;
  if (!(expectedManifest in profiles) || !(expectedPatch in profiles) || !('cordis.patch.yml' in profiles)) throw new ContractError('required-profile-files-missing');
  for (const [name, hash] of Object.entries(profiles)) {
    const path = resolve(config.dshHome, name);
    if (!inside(config.dshHome, path) || !existsSync(path) || !inside(config.dshHome, realpathSync(path)) || typeof hash !== 'string' || sha256(path) !== hash) {
      throw new ContractError('profile-file-mismatch');
    }
  }
  const manifest = readJson(join(config.dshHome, expectedManifest));
  const profile = object(object(manifest.dsh, 'profile-manifest-missing').profile, 'profile-manifest-missing');
  if (!Array.isArray(profile.bundles) || profile.bundles[0] !== '@deepseek-ai/dsh-base' || profile.bundles[1] !== '@deepseek-harness-tui/dsh-tui' || profile.bundles.length !== 2) {
    throw new ContractError('unexpected-profile-bundles');
  }
  for (const name of ['.env', '.credentials.yaml']) {
    if (existsSync(join(config.dshHome, name)) || existsSync(join(config.home, name))) throw new ContractError('ambient-credentials-not-allowed');
  }
  if (existsSync(join(config.home, '.dsh-tui'))) throw new ContractError('saved-tui-state-not-allowed');
}
/** 未資格runtimeを公開fixtureだけで検証する入口。通常CLIからは呼ばない。 */
export function prepareFixtureLaunch(configPath: string, cwd: string, inherited = process.env): LaunchPlan {
  if (process.platform !== 'linux') throw new ContractError('linux-runtime-required');
  const config = parseConfig(readJson(absolute(configPath, 'config-path-must-be-absolute')));
  const lock = readJson(config.lock);
  if (lock.kind !== 'qualification-fixture' || lock.status !== 'testing') throw new ContractError('not-fixture-lock');
  validateRuntimeAssets(config, lock);
  const boundary = object(lock.execution_boundary, 'fixture-boundary-missing');
  const root = existingDirectory(boundary.fixture_root, 'fixture-root-missing');
  const marker = join(root, 'PUBLIC_FIXTURE.json');
  const markerData = readJson(marker);
  if (boundary.marker_sha256 !== sha256(marker) || markerData.scope !== 'synthetic-public-fixture') throw new ContractError('fixture-marker-mismatch');
  const workspace = validateWorkspace(cwd);
  const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: workspace, encoding: 'utf8', timeout: 5000 });
  if (!inside(root, workspace) || common.status !== 0 || !inside(root, realpathSync(common.stdout.trim()))
    || !inside(root, config.home) || !inside(root, config.dshHome)
    || inherited.GT_RIG !== 'fixture' || !/^(fixture\/polecats\/[^/]+|fixture\/refinery)$/.test(inherited.GT_ROLE ?? '')) throw new ContractError('outside-public-fixture');
  const qualification = object(lock.qualification, 'qualification-missing');
  if (qualification.build !== 'passed' || !['static-verified', 'passed-public-fixture', 'passed'].includes(String(qualification.profile_composition))) throw new ContractError('fixture-not-built');
  validateIdentity(inherited);
  let fixtureHome = config.home;
  if (boundary.worker_home_mode !== undefined) {
    if (boundary.worker_home_mode !== 'per-polecat' || markerData.purpose !== 'staged-load-qualification') {
      throw new ContractError('fixture-worker-home-mode-invalid');
    }
    const role = /^(fixture\/polecats\/([A-Za-z0-9][A-Za-z0-9_-]{0,63}))$/.exec(inherited.GT_ROLE ?? '');
    if (!role) throw new ContractError('fixture-worker-home-role-invalid');
    const polecat = role[2];
    if (!polecat) throw new ContractError('fixture-worker-home-role-invalid');
    const homeRoot = existingDirectory(boundary.worker_home_root, 'fixture-worker-home-root-missing');
    if (!inside(root, homeRoot)) throw new ContractError('fixture-worker-home-outside-root');
    const requestedHome = resolve(homeRoot, polecat);
    if (!inside(homeRoot, requestedHome)) throw new ContractError('fixture-worker-home-outside-root');
    mkdirSync(requestedHome, { recursive: true, mode: 0o700 });
    fixtureHome = realpathSync(requestedHome);
    if (!inside(homeRoot, fixtureHome)) throw new ContractError('fixture-worker-home-outside-root');
    for (const name of ['.env', '.credentials.yaml']) {
      if (existsSync(join(fixtureHome, name))) throw new ContractError('ambient-credentials-not-allowed');
    }
    if (existsSync(join(fixtureHome, '.dsh-tui'))) throw new ContractError('saved-tui-state-not-allowed');
  }
  const args = ['--profile', PROFILE, '--patch', join(config.dshHome, 'fixture-only.patch.yml')];
  if (inherited.GT_ROLE === 'fixture/refinery') {
    if (!object(lock.profile_files, 'profile-files-missing')['refinery-only.patch.yml']) throw new ContractError('refinery-fixture-profile-missing');
    args.push('--patch', join(config.dshHome, 'refinery-only.patch.yml'));
  }
  const env = buildEnvironment(config, inherited);
  env.HOME = fixtureHome;
  return { command: config.rdsh, args, cwd: workspace, env };
}
export function buildEnvironment(config: WorkerConfig, inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  validateIdentity(inherited);
  const env: NodeJS.ProcessEnv = {};
  for (const name of [...IDENTITY_ENV, ...LOCALE_ENV]) if (inherited[name] !== undefined && inherited[name] !== '') env[name] = text(inherited[name], 'invalid-environment-value');
  if (config.credentialEnv !== null) env[config.credentialEnv] = text(inherited[config.credentialEnv], 'missing-model-credential');
  Object.assign(env, {
    PATH: config.searchPath.join(process.platform === 'win32' ? ';' : ':'), HOME: config.home, DSH_HOME: config.dshHome,
    RDSH_ORIG_BIN: config.dsh, DSH_TELEMETRY_MODE: 'DISABLED', DSH_TELEMETRY_DISABLED: '1',
    DSH_TUI_BACKEND: 'dsh', DSH_TUI_HOST_ENTRY: '0', DSH_TUI_DISABLE_TERMINAL_IMAGES: '1',
    DEEPFLOW_MODEL_PROVIDER: config.provider, DEEPFLOW_MODEL_ID: config.model, DEEPFLOW_MODEL_ENDPOINT: config.endpoint,
  });
  return env;
}
export interface LaunchPlan { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }
export function withStartupPrompt(plan: LaunchPlan, prompt?: string): LaunchPlan {
  if (prompt === undefined) return plan;
  if (!prompt.trim() || prompt.includes('\0') || prompt.length > 65536) throw new ContractError('invalid-startup-prompt');
  return { ...plan, args: [...plan.args, '--', prompt] };
}
export function execDelegate(plan: LaunchPlan): never {
  if (process.platform !== 'linux' || !process.execve) throw new ContractError('execve-unavailable');
  process.chdir(plan.cwd);
  const env = Object.fromEntries(Object.entries(plan.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  return process.execve(plan.command, [plan.command, ...plan.args], env);
}
export function prepareLaunch(configPath: string, cwd: string, inherited = process.env): LaunchPlan {
  const config = parseConfig(readJson(absolute(configPath, 'config-path-must-be-absolute')));
  validateLock(config);
  const workspace = validateWorkspace(cwd);
  if (config.home === config.dshHome || inside(workspace, config.home) || inside(workspace, config.dshHome) || inside(config.home, workspace) || inside(config.dshHome, workspace)) throw new ContractError('home-must-be-outside-worktree');
  return { command: config.rdsh, args: ['--profile', PROFILE], cwd: workspace, env: buildEnvironment(config, inherited) };
}
export async function delegate(plan: LaunchPlan): Promise<number> {
  return new Promise((resolveExit) => {
    const child = spawn(plan.command, plan.args, { cwd: plan.cwd, env: plan.env, stdio: 'inherit', shell: false });
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    const cleanup = () => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); };
    child.once('error', () => { cleanup(); resolveExit(127); });
    child.once('exit', (code, signal) => { cleanup(); resolveExit(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1)); });
  });
}
