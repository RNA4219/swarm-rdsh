// 公開fixtureの既存Refinery/MQを検証する。実repositoryのmainには接続しない。
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const prefix = '/home/ryo-n/.local/share/deepflow-swarm';
const root = join(prefix, 'qualification-20261012');
const configPath = join(root, 'worker-config.json');
const lockPath = join(root, 'fixture.lock.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
if (lock.kind !== 'qualification-fixture' || lock.execution_boundary.fixture_root !== root) throw new Error('Refusing non-fixture configuration');
const town = join(root, 'town');
const env = JSON.parse(readFileSync(join(root, 'controller-env.json'), 'utf8'));
const queue = JSON.parse(execFileSync(join(prefix, 'bin/gt'), ['mq', 'list', 'fixture', '--json'], { env, cwd: town, encoding: 'utf8' }));
if (queue.length !== 1 || queue[0].id !== 'df-wisp-25v') throw new Error('Unexpected merge queue');
const yaml = createRequire(join(prefix, 'sources/dsh-d743267388641bc76f17c45ce8b4c231aed1d32c/package.json'))('js-yaml');
const schema = yaml.DEFAULT_SCHEMA.extend(new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: (value) => value }));
const base = yaml.load(readFileSync(join(config.runtime.dsh_home, 'profiles/deepflow-worker-v2_1/cordis.patch.yml'), 'utf8'), { schema })
  .flatMap((row) => row.insert ?? [row]).find((row) => row.id === 'preset-deepflow-worker').config;
const persona = `You are the Gas Town Refinery for a synthetic PUBLIC qualification fixture.
Follow gt prime and the standard Refinery flow; use the existing MQ.
Process only df-wisp-25v, then stop and report the result; do not patrol forever.
The controller authorizes the Refinery alone to merge and push this fixture main.
The repo's worker-only no-main instruction does not apply to this Refinery role.
Required acceptance is node sum.test.mjs, with all three assertions passing.
Never skip tests, accept a baseline failure, develop code, or delegate.
Use gt mq post-merge for verified cleanup. Do not inspect environment or credentials.`;
const overlay = yaml.dump([{ id: 'preset-deepflow-worker', config: { ...base, name: 'Gas Town Refinery fixture',
  description: 'Synthetic public fixture, one MR only', plugins: base.plugins.map((plugin) => plugin.id === 'persona' ? { ...plugin, config: { ...plugin.config, prefix: persona } } : plugin) } }]);
const patch = join(config.runtime.dsh_home, 'refinery-only.patch.yml');
writeFileSync(patch, overlay);
lock.profile_files['refinery-only.patch.yml'] = createHash('sha256').update(overlay).digest('hex');
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
const settingsPath = join(town, 'fixture/settings/config.json');
const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
settings.merge_queue = { ...(settings.merge_queue ?? {}), run_tests: true, test_command: 'node sum.test.mjs', merge_strategy: 'direct', auto_push: true };
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
const hook = join(root, 'origin.git/hooks/pre-receive');
const original = readFileSync(hook, 'utf8');
if (!original.includes('fixture main is protected')) throw new Error('Unexpected protection hook');
if (!existsSync(join(root, 'evidence/pre-refinery-protection-hook.txt'))) writeFileSync(join(root, 'evidence/pre-refinery-protection-hook.txt'), original);
writeFileSync(hook, '#!/bin/sh\nwhile read old new ref; do\n if [ "$ref" = refs/heads/main ] && [ "$GT_ROLE" != fixture/refinery ]; then echo "fixture main is protected: refinery role required" >&2; exit 1; fi\ndone\n');
console.log(JSON.stringify({ scope: 'synthetic-public-fixture', refineryOnly: true, testCommand: settings.merge_queue.test_command, protectedGitHubQualified: false }));
