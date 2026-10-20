import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 30000,
    testTimeout: 30000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
