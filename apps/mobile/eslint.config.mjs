import base from '../../eslint.config.mjs';

export default [
  ...base,
  {
    // Node-run config and tooling scripts.
    files: ['*.config.js', 'scripts/**'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  { ignores: ['dist/**', 'dist-native/**', '.expo/**'] },
];
