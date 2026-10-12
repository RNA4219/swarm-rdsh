import { spawnSync } from 'node:child_process';
import { ContractError, execDelegate, prepareLaunch, withStartupPrompt } from './adapter.js';

export async function main(args: string[]): Promise<number> {
  if (args.length === 1 && args[0] === '--help') {
    console.log('gt-dsh [--config <absolute-path>] [--check] [<startup-prompt>]\ngt-dsh --doctor\n設定はGT_DSH_CONFIGでも指定可能。Gas Townの初期指示はDSH app argvへそのまま渡します。--checkはreadinessの証明ではありません。');
    return 0;
  }
  if (args.length === 1 && args[0] === '--doctor') {
    const tools = ['git', 'tmux', 'gt', 'bd', 'dolt', 'rdsh', 'dsh', 'node', 'pnpm'].map((tool) => {
      const result = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [tool], { encoding: 'utf8', timeout: 5000 });
      return { tool, available: result.status === 0 };
    });
    console.log(JSON.stringify({ platform: process.platform, node: process.version, tools, runtimeStarted: false }));
    return tools.every((tool) => tool.available) && process.platform === 'linux' ? 0 : 2;
  }
  let config = process.env.GT_DSH_CONFIG;
  let check = false;
  let prompt: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true;
    else if (args[i] === '--config' && args[i + 1]) config = args[++i];
    else if (!args[i]!.startsWith('-') && prompt === undefined) prompt = args[i];
    else { console.error('gt-dsh: unsupported-argument'); return 2; }
  }
  if (!config) { console.error('gt-dsh: missing-config'); return 2; }
  try {
    const plan = withStartupPrompt(prepareLaunch(config, process.cwd()), prompt);
    if (check) {
      console.log(JSON.stringify({ preflightPassed: true, readinessVerified: false, command: plan.command, args: prompt === undefined ? plan.args : [...plan.args.slice(0, -1), '[startup-prompt]'], startupPromptPresent: prompt !== undefined, environmentKeys: Object.keys(plan.env).sort() }));
      return 0;
    }
    if (process.platform !== 'linux') throw new ContractError('linux-runtime-required');
    return execDelegate(plan);
  } catch (error) {
    console.error(`gt-dsh: ${error instanceof ContractError ? error.code : 'preflight-failed'}`);
    return 2;
  }
}
