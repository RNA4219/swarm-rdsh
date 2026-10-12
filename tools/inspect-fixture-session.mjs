import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';
import { scanZstdFrames } from '/home/ryo-n/.local/share/deepflow-swarm/sources/dsh-d743267388641bc76f17c45ce8b4c231aed1d32c/packages/session/session-persistence-jsonl/src/zstd.ts';
const root = '/home/ryo-n/.local/share/deepflow-swarm/qualification-20261012';
const config = JSON.parse(readFileSync(join(root, 'worker-config.json'), 'utf8'));
const keyLine = readFileSync(new URL('../.env.deepinfra.local', import.meta.url), 'utf8').split(/\r?\n/).find((line) => line.startsWith('DEEPINFRA_API_KEY='));
const credential = keyLine?.slice('DEEPINFRA_API_KEY='.length).trim().replace(/^(['"])(.*)\1$/, '$2');
const sessions = join(config.runtime.dsh_home, 'sessions');
for (const workspace of readdirSync(sessions)) for (const id of readdirSync(join(sessions, workspace))) {
  const file = join(sessions, workspace, id, 'session.v4.jsonl.zstd');
  const bytes = readFileSync(file);
  const scan = scanZstdFrames(bytes);
  const decoded = scan.frames.map((frame) => zstdDecompressSync(bytes.subarray(frame.start, frame.end)).toString('utf8')).join('');
  if (credential && decoded.includes(credential)) throw new Error('Selected credential in Session; body was not displayed');
  const rows = decoded.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const counts = {};
  for (const row of rows) counts[row.type ?? row.kind ?? 'other'] = (counts[row.type ?? row.kind ?? 'other'] ?? 0) + 1;
  const calls = rows.filter((row) => row.type === 'tool/call').map((row) => ({ keys: Object.keys(row.data), call: row.data.call, toolName: row.data.toolName, name: row.data.name, args: row.data.args, arguments: row.data.arguments }));
  const output = { id, frames: scan.frames.length, torn: scan.tornStart !== undefined, rows: rows.length, counts, calls, last: rows.slice(-5).map((row) => ({ type: row.type, keys: Object.keys(row), dataKeys: Object.keys(row.data ?? {}) })) };
  console.log(JSON.stringify(output));
}
