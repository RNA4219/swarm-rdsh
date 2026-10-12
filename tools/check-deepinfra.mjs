import { readFileSync } from 'node:fs';
const input = readFileSync(new URL('../.env.deepinfra.local', import.meta.url), 'utf8');
const line = input.split(/\r?\n/).find((item) => item.startsWith('DEEPINFRA_API_KEY='));
const key = line?.slice('DEEPINFRA_API_KEY='.length).trim().replace(/^(['"])(.*)\1$/, '$2');
if (!key) throw new Error('DEEPINFRA_API_KEY is empty');
const model = process.argv[2] ?? 'zai-org/GLM-5.3-Flash';
if (!['zai-org/GLM-5.3', 'zai-org/GLM-5.3-Flash', 'deepseek-ai/DeepSeek-V4.1-Flash'].includes(model)) throw new Error('Unconfigured model');
const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
  method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with READY only.' }], max_tokens: 256, temperature: 0, reasoning_effort: 'none' }),
  signal: AbortSignal.timeout(60000),
});
const result = await response.json();
const message = typeof result.error?.message === 'string' ? result.error.message.replaceAll(key, '[redacted]').replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]').slice(0, 300) : undefined;
console.log(JSON.stringify({ status: response.status, model: result.model, finishReason: result.choices?.[0]?.finish_reason, ready: result.choices?.[0]?.message?.content?.trim() === 'READY', usage: result.usage, errorType: result.error?.type, message }));
if (!response.ok) process.exitCode = 1;
