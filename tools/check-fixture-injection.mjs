// 上流の公開注入プロトコルを、合成fixtureの1回のturnで検証する。
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createConnection } from 'node:net';
import { zstdDecompressSync } from 'node:zlib';
import { scanZstdFrames } from '/home/ryo-n/.local/share/deepflow-swarm/sources/dsh-d743267388641bc76f17c45ce8b4c231aed1d32c/packages/session/session-persistence-jsonl/src/zstd.ts';
const root = '/home/ryo-n/.local/share/deepflow-swarm/qualification-20261012';
const config = JSON.parse(readFileSync(join(root, 'worker-config.json'), 'utf8'));
const servers = JSON.parse(readFileSync(join(config.runtime.worker_home, '.dsh-tui/inject/servers.json'), 'utf8'));
const records = servers.filter((record) => record.cwd === join(root, 'seed'));
if (records.length !== 1 || !/^[0-9a-f-]{36}$/.test(records[0].sessionId)
  || records[0].socketPath !== `/df/home/.dsh-tui/inject/${records[0].sessionId}.sock`) throw new Error('Unexpected fixture injection endpoint');
const socketPath = join(config.runtime.worker_home, '.dsh-tui/inject', basename(records[0].socketPath));
if (!statSync(socketPath).isSocket()) throw new Error('Injection socket is not listening');
const marker = `FIXTURE_INPUT_${Date.now()}`;
const sessions = join(config.runtime.dsh_home, 'sessions');
const projects = readdirSync(sessions).filter((name) => readdirSync(join(sessions, name)).includes(records[0].sessionId));
if (projects.length !== 1) throw new Error('Ambiguous DSH Session');
const session = join(sessions, projects[0], records[0].sessionId, 'session.v4.jsonl.zstd');
const original = process.cwd();
process.chdir(dirname(socketPath));
await new Promise((resolve, reject) => {
  const connection = createConnection({ path: basename(socketPath) });
  connection.setTimeout(5000, () => connection.destroy(new Error('Injection timeout')));
  connection.on('error', reject);
  connection.on('connect', () => connection.end([
    { type: 'prompt.append', text: `Reply with ${marker} only. Do not use tools.` },
    { type: 'command.execute', command: 'prompt.submit' },
  ].map((message) => JSON.stringify(message)).join('\n') + '\n'));
  connection.on('close', resolve);
});
process.chdir(original);
let result;
const deadline = Date.now() + 60000;
while (Date.now() < deadline) {
  const bytes = readFileSync(session);
  const scan = scanZstdFrames(bytes);
  const rows = scan.frames.map((frame) => zstdDecompressSync(bytes.subarray(frame.start, frame.end)).toString('utf8')).join('').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const accepted = rows.some((row) => row.type === 'user/message' && JSON.stringify(row.data).includes(marker));
  const response = rows.some((row) => row.type === 'assistant/message' && JSON.stringify(row.data).includes(marker));
  if (accepted && response) {
    result = { scope: 'synthetic-public-fixture', transport: 'upstream-dsh-tui-inject', sessionId: records[0].sessionId, inputAccepted: true, responseReceived: true, sessionSha256: createHash('sha256').update(bytes).digest('hex'), normalGasTownNudgeQualified: false };
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!result) throw new Error('Input receipt/response was not confirmed');
writeFileSync(join(root, 'evidence/injection-check.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
