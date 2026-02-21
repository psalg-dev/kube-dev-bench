import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./test.setup.js'],
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Only report coverage for source files inside src/ (excludes wailsjs/ bindings,
      // node_modules, build output, and anything else outside src/).
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Build / tooling config — no app logic
        'node_modules/',
        'dist/',
        'coverage/',
        'vite.config.*',
        'vitest.config.*',
        'test.setup.*',
        // Test files themselves
        '**/__tests__/**',
        // Style files (no JavaScript logic)
        '**/*.css',
        '**/*.scss',
        // TypeScript declaration-only files (.d.ts) — purely type metadata, no runtime code
        '**/*.d.ts',
        // Wails-generated frontend bindings (already outside src/, belt-and-suspenders)
        'wailsjs/**',
        // Wails binding re-export shim — just `export * from wailsjs/...`, no app logic
        'src/types/wails.ts',
        // React/Wails app entry point — framework bootstrap, not unit-testable
        'src/main.ts',
        // Declarative K8s table column configs — repetitive render-only code
        // better validated by E2E tests than unit tests
        'src/k8s/resources/**/*OverviewTable.tsx',
      ],
    },
  },
});
