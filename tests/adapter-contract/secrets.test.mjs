import test from 'node:test';
import assert from 'node:assert/strict';
import { findSecret } from '../../tools/check-secrets.mjs';

test('選択APIキーの平文とbase64、汎用tokenと秘密鍵を値の表示なしに検出する', () => {
  const value = 'synthetic-credential-for-scanner-test';
  assert.equal(findSecret(Buffer.from(`prefix ${value} suffix`), [value]), 'selected-credential');
  assert.equal(findSecret(Buffer.from(Buffer.from(value).toString('base64')), [value]), 'selected-credential');
  assert.equal(findSecret(Buffer.from('gh' + 'p_' + 'a'.repeat(36))), 'credential-pattern');
  assert.equal(findSecret(Buffer.from(['-----BEGIN ', 'OPENSSH PRIVATE KEY-----'].join(''))), 'credential-pattern');
  assert.equal(findSecret(Buffer.from('DEEPINFRA_API_KEY=\nOPENAI_API_KEY=your-api-key\n')), null);
});
