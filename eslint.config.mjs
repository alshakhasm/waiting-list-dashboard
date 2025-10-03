// Flat ESLint config for ESLint v9 (ESM)
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import jestPlugin from 'eslint-plugin-jest';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    // Broad ignore patterns to prevent linting built artifacts and dependencies anywhere in the repo
  ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/.vite/**']
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      jest: jestPlugin,
      'jsx-a11y': jsxA11yPlugin
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'prefer-const': 'warn',
      // Apply to JS files as well to avoid CI failures on helper scripts
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
);
