// exception: docs/conventions/toolchain.md, TypeScript
// ESLint loads a TypeScript config file only behind an unstable flag.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import importX from 'eslint-plugin-import-x';
import n from 'eslint-plugin-n';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist/', '**/node_modules/', '.claude/']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
      },
    },
  },
  {
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [importX.createNodeResolver()],
    },
  },
  comments.recommended,
  n.configs['flat/recommended'],
  {
    settings: {
      n: {
        resolverConfig: {
          // The plugin resolves an import without the development condition
          // and so looks for dist. Listing the condition keeps lint on the
          // same no-build path as tests and type checks. The rest are the
          // plugin's own defaults, which this setting replaces rather than
          // extends.
          conditionNames: ['development', 'node', 'require', 'import', 'types'],
        },
      },
    },
    rules: {
      'n/no-extraneous-import': 'error',
      'n/no-unsupported-features/node-builtins': 'error',
      'n/no-unsupported-features/es-syntax': 'error',
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/indent': ['error', 2],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/spaced-comment': ['error', 'always', { markers: ['/'] }],
      '@stylistic/multiline-comment-style': ['error', 'separate-lines'],
    },
  },
  {
    rules: {
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
      'object-shorthand': ['error', 'always'],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
  {
    rules: {
      'sort-imports': ['error', { ignoreDeclarationSort: true, ignoreCase: true }],
      'import-x/order': ['error', { 'newlines-between': 'never', alphabetize: { order: 'asc', caseInsensitive: true } }],
    },
  },
  {
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': ['error', {
        allowForKnownSafeCalls: [
          { from: 'package', package: 'node:test', name: ['describe', 'it', 'suite', 'test'] },
        ],
      }],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
