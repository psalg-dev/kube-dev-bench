import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test.setup.js'],
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        'vite.config.*',
        'vitest.config.*',
        'test.setup.*',
        '**/__tests__/**',
        '**/*.css',
        '**/*.scss',
        '**/*.d.ts',
        'wailsjs/**',
        'src/types/wails.ts',
        'src/main.ts',
        'src/k8s/resources/**/*OverviewTable.tsx',
      ]
    }
  }
});
