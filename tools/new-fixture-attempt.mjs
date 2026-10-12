import { copyFileSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const root = '/home/ryo-n/.local/share/deepflow-swarm/qualification-20261012';
const attempt = process.argv[2];
if (!/^[1-9]\d*$/.test(attempt ?? '')) throw new Error('Expected attempt number');
const target = join(root, 'attempts', attempt);
if (existsSync(target)) throw new Error('Attempt already exists; no resume/reuse');
const configPath = join(root, 'worker-config.json');
const lockPath = join(root, 'fixture.lock.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const dshHome = join(target, 'dsh-home');
const home = join(target, 'worker-home');
const profile = join(dshHome, 'profiles/deepflow-worker-v2_1');
mkdirSync(profile, { recursive: true, mode: 0o700 });
mkdirSync(home, { mode: 0o700 });
delete lock.worker_home_files;
for (const name of Object.keys(lock.profile_files)) {
  copyFileSync(join(config.runtime.dsh_home, name), join(dshHome, name));
  lock.profile_files[name] = createHash('sha256').update(readFileSync(join(dshHome, name))).digest('hex');
}
symlinkSync(join(config.runtime.dsh_home, 'profiles/deepflow-worker-v2_1/node_modules'), join(profile, 'node_modules'), 'dir');
config.runtime.dsh_home = dshHome;
config.runtime.worker_home = home;
lock.qualification.pty_e2e = 'pending';
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
console.log(JSON.stringify({ attempt, newHome: home, resumed: false }));
