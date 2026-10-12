// 初回E2EのCLI契約試験。状態・投入・完了は既存gt/bdへ委譲する。
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const prefix = '/home/ryo-n/.local/share/deepflow-swarm';
const root = join(prefix, 'qualification-20261012');
const town = join(root, 'town');
const env = JSON.parse(readFileSync(join(root, 'controller-env.json'), 'utf8'));
const run = (name, args, cwd = town) => execFileSync(join(prefix, 'bin', name), args, { env, cwd, encoding: 'utf8', timeout: 120000 });
switch (process.argv[2]) {
  case 'init': {
    if (existsSync(town)) throw new Error('Town already exists; inspect before retrying');
    writeFileSync(join(root, 'evidence/town-install.log'), run('gt', ['install', town, '--name', 'deepflow-fixture', '--owner', 'fixture@example.invalid', '--dolt-port', '13317'], root));
    console.log('TOWN_READY');
    break;
  }
  case 'rig': {
    if (existsSync(join(town, 'fixture'))) throw new Error('Rig directory already exists; inspect before retrying');
    writeFileSync(join(root, 'evidence/rig-add.log'), run('gt', ['rig', 'add', 'fixture', `file://${join(root, 'origin.git')}`, '--branch', 'main', '--prefix', 'df']));
    writeFileSync(join(town, 'settings/agents.json'), JSON.stringify({ version: 1, agents: { 'dsh-worker': { name: 'dsh-worker', command: join(prefix, 'bin/gt-dsh-fixture'), args: [], prompt_mode: 'arg', supports_hooks: false, hooks_informational: true, process_names: ['bwrap', 'MainThread', 'rdsh', 'node'], instructions_file: 'AGENTS.md', ready_delay_ms: 5000, escape_cancels_request: false } } }, null, 2));
    run('gt', ['config', 'set', 'default_agent', 'dsh-worker']);
    run('gt', ['config', 'set', 'scheduler.max_polecats', '1']);
    console.log('TOWN_AND_RIG_READY');
    break;
  }
  case 'dump': {
    const config = JSON.parse(readFileSync(join(root, 'worker-config.json'), 'utf8'));
    const result = execFileSync(join(prefix, 'bin/dsh'), ['--profile', config.profile, '--dump-config'], { env: { ...env, DSH_HOME: config.runtime.dsh_home, DEEPFLOW_MODEL_PROVIDER: config.model.provider, DEEPFLOW_MODEL_ID: config.model.id, DEEPFLOW_MODEL_ENDPOINT: config.model.endpoint }, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
    const output = result;
    writeFileSync(join(root, 'evidence/effective.cordis.yml'), output);
    console.log('PROFILE_COMPOSITION_WRITTEN');
    break;
  }
  case 'allow-fixture-version': {
    const config = JSON.parse(readFileSync(join(root, 'worker-config.json'), 'utf8'));
    console.log(execFileSync(join(prefix, 'bin/dsh'), ['plugin', '--profile', config.profile, 'allow-version', '@deepseek-harness-tui/dsh-tui@0.14.0', '--dsh-version', '0.2.1-alpha.2', '--accept-risk'], { env: { ...env, DSH_HOME: config.runtime.dsh_home }, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }));
    break;
  }
  case 'bead': {
    const bead = run('bd', ['create', 'Fix addition in public fixture', '--type', 'task', '--priority', '2', '--description', 'Change add(a,b) in sum.mjs to addition. Run node sum.test.mjs; all three assertions must pass. Commit on your polecat branch, then run gt done. No main merge. Do not inspect environment variables or credentials.', '--silent'], join(town, 'fixture')).trim();
    writeFileSync(join(root, 'evidence/bead-id.txt'), bead + '\n');
    console.log(bead);
    break;
  }
  case 'dispatch': {
    const hookPath = join(root, 'origin.git/hooks/pre-receive');
    if (existsSync(hookPath)) throw new Error('Origin hook already exists; inspect before replacing');
    writeFileSync(hookPath, '#!/bin/sh\nwhile read old new ref; do\n if [ "$ref" = refs/heads/main ]; then echo "fixture main is protected" >&2; exit 1; fi\ndone\n');
    chmodSync(hookPath, 0o755);
    const bead = readFileSync(join(root, 'evidence/bead-id.txt'), 'utf8').trim();
    console.log(run('gt', ['sling', bead, 'fixture', '--agent', 'dsh-worker', '--hook-raw-bead', '--no-boot', '--owned', '--merge', 'mr']));
    console.log(run('gt', ['scheduler', 'run', '--batch', '1']));
    break;
  }
  case 'status': {
    const beadPath = join(root, 'evidence/bead-id.txt');
    console.log(run('gt', ['scheduler', 'status']));
    console.log(run('gt', ['polecat', 'list', 'fixture']));
    if (existsSync(beadPath)) console.log(run('bd', ['show', readFileSync(beadPath, 'utf8').trim(), '--json'], join(town, 'fixture')));
    break;
  }
  case 'probe-start': {
    const probeEnv = { ...env, GT_ROLE: 'fixture/polecats/contract', GT_RIG: 'fixture', GT_POLECAT: 'contract', GT_AGENT: 'dsh-worker', GT_ROOT: town, GT_TOWN_ROOT: town };
    execFileSync('tmux', ['-L', 'deepflow-fixture-contract', 'new-session', '-d', '-s', 'contract', '-x', '100', '-y', '35', '-c', join(root, 'seed'), join(prefix, 'bin/gt-dsh-fixture'), 'Reply with READY only. Do not use tools.'], { env: probeEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('CONTRACT_PTY_STARTED');
    break;
  }
  case 'probe-capture': {
    const output = execFileSync('tmux', ['-L', 'deepflow-fixture-contract', 'capture-pane', '-p', '-t', 'contract', '-S', '-100'], { env, encoding: 'utf8' });
    writeFileSync(join(root, 'evidence/contract-pane.txt'), output);
    console.log(output.slice(-7000));
    console.log(execFileSync('tmux', ['-L', 'deepflow-fixture-contract', 'list-panes', '-t', 'contract', '-F', '#{pane_current_command} #{pane_pid} #{pane_dead}'], { env, encoding: 'utf8' }));
    break;
  }
  case 'probe-stop': {
    execFileSync('tmux', ['-L', 'deepflow-fixture-contract', 'kill-session', '-t', 'contract'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('CONTRACT_PTY_STOPPED');
    break;
  }
  case 'retry-dispatch': {
    console.log(run('gt', ['scheduler', 'run', '--batch', '1']));
    break;
  }
  case 'refresh-profile': {
    const config = JSON.parse(readFileSync(join(root, 'worker-config.json'), 'utf8'));
    const repoProfile = new URL('../config/dsh/worker-profile/cordis.patch.yml', import.meta.url);
    writeFileSync(join(config.runtime.dsh_home, 'profiles/deepflow-worker-v2_1/cordis.patch.yml'), readFileSync(repoProfile));
    const agentsPath = join(town, 'settings/agents.json');
    const agents = JSON.parse(readFileSync(agentsPath, 'utf8'));
    agents.agents['dsh-worker'].process_names = ['bwrap', 'MainThread', 'rdsh', 'node'];
    agents.agents['dsh-worker'].escape_cancels_request = false;
    agents.agents['dsh-worker'].prompt_mode = 'arg';
    writeFileSync(agentsPath, JSON.stringify(agents, null, 2) + '\n');
    const wrapper = join(prefix, 'bin/gt-dsh-fixture');
    const node = join(prefix, 'node-v24.15.0-linux-x64/bin/node');
    const sourceRepo = new URL('..', import.meta.url).pathname;
    writeFileSync(wrapper, `#!/bin/sh\nexec '${node}' '${join(sourceRepo, 'tools/qualify-worker.mjs')}' '${join(root, 'worker-config.json')}' '${join(sourceRepo, '.env.deepinfra.local')}' "$@"\n`);
    chmodSync(wrapper, 0o755);
    console.log('PROFILE_AND_OBSERVED_PROCESS_NAMES_UPDATED');
    break;
  }
  case 'exclude-scaffolding': {
    const path = join(town, 'fixture/.repo.git/info/exclude');
    const original = readFileSync(path, 'utf8');
    const patterns = ['/.beads/', '/.runtime/', '/CLAUDE.md'];
    const existing = original.split(/\r?\n/);
    const missing = patterns.filter((pattern) => !existing.includes(pattern));
    if (missing.length) writeFileSync(path, original + '\n# Gas Town-managed fixture scaffolding\n' + missing.join('\n') + '\n');
    console.log('GAS_TOWN_SCAFFOLDING_EXCLUDED');
    break;
  }
  case 'finish-nudge': {
    console.log(run('gt', ['nudge', 'fixture/rust', 'The controller configured the shared Git info/exclude for Gas Town-managed .beads/, .runtime/, and CLAUDE.md. Your arithmetic fix is already committed and acceptance passes. Confirm git status is clean, run node sum.test.mjs, then run gt done once. Do not repeat the implementation or investigate further. Do not merge main.', '--mode', 'immediate']));
    break;
  }
  case 'finish-recovery-stop': {
    const queue = run('gt', ['mq', 'list', 'fixture', '--json']);
    writeFileSync(join(root, 'evidence/mq-before-recovery.json'), queue);
    const state = run('gt', ['polecat', 'git-state', 'fixture/rust', '--json']);
    writeFileSync(join(root, 'evidence/git-state-before-recovery.json'), state);
    console.log(queue);
    console.log(run('gt', ['session', 'stop', 'fixture/rust', '--force']));
    const bead = readFileSync(join(root, 'evidence/bead-id.txt'), 'utf8').trim();
    console.log(run('bd', ['update', bead, '--append-notes', 'CONTROLLER RESOLUTION: the shared .repo.git/info/exclude now ignores Gas Town-managed .beads/, .runtime/, and CLAUDE.md. git status is clean outside the agent. The code fix is committed as af1af6f and node sum.test.mjs passes. No MR existed before recovery. Do not repeat implementation or debug; verify status/test then submit with normal gt done.'], join(town, 'fixture')));
    break;
  }
  case 'finish-recovery-start': {
    console.log(run('gt', ['session', 'start', 'fixture/rust']));
    break;
  }
  case 'mq': {
    const output = run('gt', ['mq', 'list', 'fixture', '--json']);
    writeFileSync(join(root, 'evidence/mq-after-done.json'), output);
    console.log(output);
    break;
  }
  case 'refinery-start': {
    console.log(run('gt', ['refinery', 'start', 'fixture', '--agent', 'dsh-worker']));
    break;
  }
  case 'refinery-status': {
    console.log(run('gt', ['refinery', 'status', 'fixture', '--json']));
    console.log(run('gt', ['mq', 'list', 'fixture', '--json']));
    break;
  }
  case 'refinery-stop': {
    console.log(run('gt', ['refinery', 'stop', 'fixture']));
    break;
  }
  case 'refinery-debug-start': {
    execFileSync('tmux', ['new-session', '-d', '-s', 'df-qualification-keeper'], { env });
    execFileSync('tmux', ['set-option', '-g', 'remain-on-exit', 'on'], { env });
    console.log(run('gt', ['refinery', 'start', 'fixture', '--agent', 'dsh-worker']));
    break;
  }
  case 'refinery-capture': {
    const output = execFileSync('tmux', ['capture-pane', '-p', '-t', 'df-refinery', '-S', '-60'], { env, encoding: 'utf8' });
    writeFileSync(join(root, 'evidence/refinery-pane.txt'), output);
    console.log(output);
    break;
  }
  case 'refinery-debug-probe': {
    const cwd = join(town, 'fixture/refinery/rig');
    const debugEnv = { ...env, GT_ROLE: 'fixture/refinery', GT_RIG: 'fixture', GT_AGENT: 'dsh-worker', GT_ROOT: town, GT_TOWN_ROOT: town };
    execFileSync('tmux', ['new-session', '-d', '-s', 'df-refinery-debug', '-c', cwd, join(prefix, 'bin/gt-dsh-fixture'), 'Run gt prime --hook and process the single existing merge request.'], { env: debugEnv });
    console.log('REFINERY_DIAGNOSTIC_PTY_STARTED');
    break;
  }
  case 'refinery-debug-capture': {
    const output = execFileSync('tmux', ['capture-pane', '-p', '-t', 'df-refinery-debug', '-S', '-50'], { env, encoding: 'utf8' });
    console.log(output);
    break;
  }
  default: throw new Error('Expected init, dump, bead, dispatch, or status');
}
