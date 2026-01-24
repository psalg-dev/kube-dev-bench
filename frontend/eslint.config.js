import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';

export default [
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'wailsjs/**',
      'logs/**',
      '*.config.js',
      '*.config.cjs',
      'scripts/**',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // React configuration
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      'react/prop-types': 'off', // Disable prop-types as we're not using them
      'react/jsx-uses-react': 'off', // Not needed with React 17+ JSX transform
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+ JSX transform
      'react/jsx-no-target-blank': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'off',

      // React Hooks rules
      ...reactHooksPlugin.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn', // Many deps are intentionally excluded to prevent infinite loops

      // React Refresh rules (for Vite HMR)
      'react-refresh/only-export-components': [
        'warn',
        { 
          allowConstantExport: true,
          allowExportNames: [
            // Context providers commonly export hooks and state alongside components
            'useClusterState',
            'useSwarmState',
            'useSwarmMetrics',
            'useHolmes',
            'useResourceCounts',
            'useSwarmResourceCounts',
            'useConnectionsState',
            'useMetricsState',
            'ClusterStateProvider',
            'SwarmStateProvider',
            'HolmesProvider',
            'ResourceCountsProvider',
            'SwarmResourceCountsProvider',
            'ConnectionsStateProvider',
            'MetricsStateProvider',
            // State objects and helpers
            'initialState',
            'reducer',
            'MetricsContext',
            'SwarmResourceCountsContext',
            'ClusterStateContext',
            'SwarmStateContext',
            'HolmesContext',
            'ResourceCountsContext',
            'ConnectionsStateContext',
            'useDockerMetrics',
            'useCPUMetrics', 
            'useMemoryMetrics',
            'useConnectionSettings',
            'useConnectionSettingsDispatch',
            'useClusterMetrics',
            'useServiceMetrics',
            'useNodeMetrics',
          ],
        },
      ],

      // General JS rules
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-empty': ['warn', { allowEmptyCatch: true }], // Allow empty catch blocks for fire-and-forget patterns
      'no-unsafe-finally': 'warn', // Downgrade to warning - some patterns intentionally use this
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],
      'no-trailing-spaces': 'warn',
      'semi': ['warn', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
    },
  },

  // Test files configuration
  {
    files: ['src/**/__tests__/**/*.{js,jsx}', 'src/**/*.test.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node, // For global object in tests
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        global: 'writable', // Node.js global object used in tests
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
