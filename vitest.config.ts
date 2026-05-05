import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
      'server-only': path.resolve(root, 'tests/server-only-shim.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
  },
});
