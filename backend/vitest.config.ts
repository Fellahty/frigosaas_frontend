import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
    },
    setupFiles: ['./tests/setup.ts'],
    globalTeardown: ['./tests/globalTeardown.ts'],
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30000,
  },
});
