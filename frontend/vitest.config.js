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
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        'vite.config.*',
        'vitest.config.*',
        'test.setup.*',
        '**/__tests__/**'
      ]
    }
  }
});
