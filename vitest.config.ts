import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: [
        'order-splitter/**/*.ts',
        'api/controllers/orders.controller.ts',
        'api/services/**/*.ts',
        'api/middlewares/require-idempotency-key.ts',
        'api/middlewares/validate-split-order-body.ts',
      ],
      exclude: [
        'order-splitter/types/**',
        '**/*.d.ts',
        /** Re-export-only barrels (no executable logic). */
        'order-splitter/**/index.ts',
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
