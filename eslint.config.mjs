import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'lib/gt-dsh/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } },
    rules: { 'no-unused-vars': 'error', 'no-unreachable': 'error' },
  },
];
