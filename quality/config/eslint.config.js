export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/wailsjs/**',
      '**/*.test.{js,jsx}',
      '**/__tests__/**'
    ]
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      'complexity': ['warn', 15],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', 100],
      'max-params': ['warn', 5],
      'no-console': 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
];
