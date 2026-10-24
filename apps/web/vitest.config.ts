import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve the `@app/*` path alias (tsconfig.app.json) the same way vite.config
  // does, so tests that load modules using it (e.g. client.ts) work.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
