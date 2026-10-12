// TUIの開発用rc版ではなく、固定してビルドしたDSHをpeer解決先にする。
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const prefix = '/home/ryo-n/.local/share/deepflow-swarm';
const tui = join(prefix, 'sources/dsh-tui-76c2a26b7f0d81e91b04c848e8aa9671f93ed046/node_modules/@deepseek-ai');
const profile = join(prefix, 'qualification-20261012/dsh-home/profiles/deepflow-worker-v2_1/node_modules/@deepseek-ai');
const changed = [];
const backup = join(tui, '../.fixed-peer-backups');
mkdirSync(backup, { recursive: true });
for (const name of readdirSync(profile)) {
  const target = join(tui, name);
  const source = realpathSync(join(profile, name));
  try {
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) {
      if (realpathSync(target) === source) continue;
      unlinkSync(target);
    } else {
      const manifest = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
      if (manifest.name !== `@deepseek-ai/${name}` || !stat.isDirectory()) throw new Error(`Unexpected dependency ${name}`);
      renameSync(target, join(backup, name));
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  symlinkSync(source, target, 'dir');
  changed.push(name);
}
const version = JSON.parse(readFileSync(join(tui, 'dsh-agent/package.json'), 'utf8')).version;
if (version !== '0.2.1-alpha.2') throw new Error('Fixed peer binding did not apply');
writeFileSync(join(prefix, 'qualification-20261012/evidence/tui-peer-bindings.json'), JSON.stringify({ version, changed }, null, 2) + '\n');
console.log(JSON.stringify({ fixedPeerVersion: version, bindings: changed.length }));
