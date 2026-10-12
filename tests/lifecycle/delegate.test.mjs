import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { delegate } from '../../lib/gt-dsh/adapter.js';
import { fixture } from '../helpers.mjs';

test('実childの終了コードを返し、失敗しても再投入しない', async (t) => {
  const f = fixture(t);
  const runner = join(f.root, 'child.mjs');
  const record = join(f.root, 'calls.txt');
  writeFileSync(runner, "import {appendFileSync} from 'node:fs'; appendFileSync(process.argv[2], 'once\\n'); process.exit(17);\n");
  const code = await delegate({ command: process.execPath, args: [runner, record], cwd: f.workspace, env: { SystemRoot: process.env.SystemRoot } });
  assert.equal(code, 17);
  assert.equal(readFileSync(record, 'utf8'), 'once\n');
});

test('child起動失敗を成功扱いにしない', async (t) => {
  const f = fixture(t);
  const code = await delegate({ command: join(f.root, 'missing-binary'), args: [], cwd: f.workspace, env: {} });
  assert.equal(code, 127);
});

test('SIGTERMを実childへ伝搬する（POSIX）', { skip: process.platform === 'win32' }, async (t) => {
  const f = fixture(t);
  const runner = join(f.root, 'wait.mjs');
  const ready = join(f.root, 'ready');
  writeFileSync(runner, "import {writeFileSync} from 'node:fs'; process.on('SIGTERM', () => process.exit(23)); writeFileSync(process.argv[2], 'ready'); setInterval(() => {}, 100);\n");
  const execution = delegate({ command: process.execPath, args: [runner, ready], cwd: f.workspace, env: {} });
  const deadline = Date.now() + 5000;
  while (!existsSync(ready) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  process.emit('SIGTERM');
  const code = await execution;
  assert.ok(existsSync(ready), 'Child did not become ready before signal test');
  assert.equal(code, 23);
});
