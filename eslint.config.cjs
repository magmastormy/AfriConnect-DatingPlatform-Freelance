// ESLint flat config (ESLint 9). Enforces AGENTS.md Clause 2.8 style rules.
// Shared across all packages via the pnpm workspace.
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/generated/**',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
      // Test files are verified by jest, not ESLint. They are also excluded from
      // the build tsconfig, so the type-aware `projectService` cannot resolve
      // them (it would otherwise hard-error with "not found by the project
      // service"). Excluding them here is the standard escape hatch.
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        // Type-aware linting: resolves each file's types from the nearest
        // tsconfig via the TS project service. Enables no-floating-promises /
        // no-misused-promises so the class of bug fixed manually during the
        // audit is caught automatically going forward.
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-console': 'warn',
      'no-explicit-any': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      // A returned promise used as a statement with no await/.then/.catch is a
      // silent failure waiting to happen (e.g. a sign-out that never clears
      // tokens when the server call rejects).
      '@typescript-eslint/no-floating-promises': 'error',
      // Passes a promise-returning function where a non-promise is expected.
      // `attributes: false` exempts JSX event handlers (onClick/onSubmit), which
      // is the standard Next.js-compatible setting and avoids a false-positive
      // flood on async handlers.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];
