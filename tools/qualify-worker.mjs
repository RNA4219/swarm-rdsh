// Gas Townが起動する公開fixture用の契約試験。通常deployment資格を偽装しない。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContractError, execDelegate, prepareFixtureLaunch, readJson, sha256, withStartupPrompt } from '../lib/gt-dsh/adapter.js';
try {
  const [configPath, envPath, prompt, ...extra] = process.argv.slice(2);
  if (extra.length || !prompt) throw new ContractError('missing-gastown-startup-prompt');
  const credentialLine = readFileSync(envPath, 'utf8').split(/\r?\n/).find((line) => line.startsWith('DEEPINFRA_API_KEY='));
  const credential = credentialLine?.slice('DEEPINFRA_API_KEY='.length).trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!credential || /[\r\n\0]/.test(credential)) throw new ContractError('missing-model-credential');
  const lock = readJson(readJson(configPath).runtime.deployment_lock);
  const plan = withStartupPrompt(prepareFixtureLaunch(configPath, process.cwd(), { ...process.env, DEEPINFRA_API_KEY: credential }), prompt);
  const prefix = lock.execution_boundary.runtime_root;
  const fixture = lock.execution_boundary.fixture_root;
  if (lock.runtime_artifacts.bwrap.sha256 !== sha256('/usr/bin/bwrap')) throw new ContractError('sandbox-artifact-mismatch');
  const bindings = ['sources', 'bin', 'toolchains', 'node-v24.15.0-linux-x64'].flatMap((name) => ['--ro-bind', join(prefix, name), join(prefix, name)]);
  const args = [
    '--die-with-parent', '--unshare-pid', '--unshare-uts', '--unshare-ipc',
    '--ro-bind', '/usr', '/usr', '--ro-bind', '/bin', '/bin', '--ro-bind', '/lib', '/lib', '--ro-bind', '/lib64', '/lib64',
    '--ro-bind', '/etc/ssl', '/etc/ssl', '--ro-bind', '/etc/resolv.conf', '/etc/resolv.conf',
    '--ro-bind', '/etc/hosts', '/etc/hosts', '--ro-bind', '/etc/nsswitch.conf', '/etc/nsswitch.conf',
    '--ro-bind', '/etc/passwd', '/etc/passwd', '--ro-bind', '/etc/group', '/etc/group',
    '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
    ...bindings, '--bind', fixture, fixture,
    // Unix socketの108-byte上限を避ける、fixture mount内だけのHOME変換。
    '--dir', '/df', '--bind', plan.env.HOME, '/df/home',
    '--chdir', plan.cwd, '--', plan.command, ...plan.args,
  ];
  execDelegate({ ...plan, env: { ...plan.env, HOME: '/df/home' }, command: '/usr/bin/bwrap', args });
} catch (error) {
  console.error(`gt-dsh-fixture: ${error instanceof ContractError ? error.code : 'fixture-launch-failed'}`);
  process.exitCode = 2;
}
