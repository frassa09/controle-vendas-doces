const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: {
      // Promises em handlers de UI (onPress) são tratadas dentro das funções.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    },
  },
  {
    files: ['*.config.js', 'plugins/**/*.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'writable',
      },
    },
  },
  { ignores: ['android/*', 'dist/*', '.expo/*', 'expo-env.d.ts'] },
]);
